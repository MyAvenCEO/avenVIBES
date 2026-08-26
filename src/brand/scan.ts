/**
 * Find the classes a source tree actually uses.
 *
 * The utility generator emits CSS for a set of class names, so something has to
 * produce that set. Doing it with a one-off grep is how the first pass reported
 * 212 "unknown" classes, 46 of which were not classes at all but fragments of
 * template expressions — noise that hides the real findings underneath it.
 *
 * So the scanner ships WITH the generator. One implementation, used by every
 * surface, and the unknown list it feeds means something.
 */

/**
 * Where a class name came from, and how sure we are that it IS one.
 *
 * `certain` marks a name read from a `class` attribute or a `class:` directive.
 * Those must resolve — a `class="bg-nonsense"` is a bug and the build should
 * say so. Everything else is a CANDIDATE: a string literal somewhere else in
 * the file that merely looks like a class.
 *
 * The distinction is not pedantry. Half the app's state colours live in
 * script-level maps —
 *
 *   const ACCENT = { running: { edge: 'border-l-progress' }, … }
 *
 * — and a scanner that only reads markup never sees them, so those rules are
 * never generated and every state accent silently falls back to the default
 * border. But a scanner that treats every string as a class would fail the
 * build on `'application/pdf'`. Candidates are generated when they resolve and
 * ignored when they do not, which is the only honest thing to do with a guess.
 */
export interface ClassUse {
	name: string
	file: string
	certain: boolean
}

/**
 * A plausible class name: an identifier, optional variants, optional alpha.
 *
 * The leading `-` is not decoration. `-left-[13px]` and `-translate-x-1/2` are
 * classes, and requiring a letter first made the scanner skip them — which meant
 * the generator never saw them, the build never failed, and eight negative
 * offsets went missing from the layout with nothing to say so. A filter meant to
 * cut noise had started cutting evidence.
 */
const PLAUSIBLE = /^-?[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z0-9_.-]+)*$/

/** Class attributes in all four spellings, quoted or braced. */
const ATTR = /\bclass\s*=\s*(?=["'{])/g

/** `class:selected={expr}` — the CLASS is the name after the colon. */
const DIRECTIVE = /\bclass:([A-Za-z0-9_-]+)/g

/** String literals, in any of the three quote styles. */
const STRINGS = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g

/** Mask `[...]` so an arbitrary value's punctuation does not fail the shape test. */
function maskArbitrary(token: string): string {
	return token.replace(/\[[^\]]*\]/g, '\u00a7')
}

/**
 * Is this token a class name?
 *
 * The alpha suffix is checked SEPARATELY from the base, because `foo/65` is only
 * meaningful when `foo` is a colour utility. Accepting it blindly is how
 * `eyebrow-accent/65` — an opacity suffix on a component class, which does
 * nothing at all — sat in the markup without anyone noticing.
 */
function plausible(token: string): boolean {
	const masked = maskArbitrary(token)
	/*
	 * A dot is only ever part of a NUMBER in a class name — `py-1.5`, `gap-2.5`.
	 * Anywhere else it means a property access that got picked up from an
	 * expression, like `stage.key`.
	 *
	 * Rejecting the dot outright was simpler and silently deleted every half-step
	 * in the spacing scale: 150-odd `py-0.5`, `gap-1.5`, `size-3.5` classes across
	 * the app and the site, which is most of the vertical rhythm in a dense UI.
	 * The buttons that lost their padding are how it surfaced.
	 */
	if (masked.replace(/\d\.\d/g, '').includes('.')) return false
	if (masked.includes('\u00a7')) return /^-?[A-Za-z_][A-Za-z0-9_:-]*\u00a7$/.test(masked)
	const [base, alpha, ...extra] = masked.split('/')
	if (extra.length) return false
	if (alpha !== undefined && !/^\d+$/.test(alpha)) return false
	return PLAUSIBLE.test(base)
}

/** Read a balanced `{...}` / quoted attribute value starting at `from`. */
function readValue(source: string, from: number): { value: string; end: number; braced: boolean } {
	const open = source[from]
	if (open === '"' || open === "'") {
		const end = source.indexOf(open, from + 1)
		return { value: source.slice(from + 1, end), end: end + 1, braced: false }
	}
	let depth = 0
	let i = from
	for (; i < source.length; i++) {
		if (source[i] === '{') depth++
		else if (source[i] === '}' && --depth === 0) break
	}
	return { value: source.slice(from + 1, i), end: i + 1, braced: true }
}

/**
 * Mine an expression for the class names inside it.
 *
 * Only string LITERALS can hold class names, and not even all of those: in
 * `class={linkCls(active === 'pricing')}` the literal is a comparison operand,
 * not a class. Skipping operands of `==`/`!=` is what separates a real unknown
 * class from a status enum that merely sits near one.
 */
function fromExpression(expression: string, file: string, found: ClassUse[]): void {
	const dataArrays: Array<[number, number]> = []
	for (let i = 0; i < expression.length; i++) {
		if (expression[i] !== '[') continue
		let depth = 0
		let j = i
		for (; j < expression.length; j++) {
			if (expression[j] === '[') depth++
			else if (expression[j] === ']' && --depth === 0) break
		}
		if (expression[j + 1] === '.') dataArrays.push([i, j])
	}

	for (const literal of expression.matchAll(STRINGS)) {
		const at = literal.index as number
		const before = expression.slice(Math.max(0, at - 4), at).trimEnd()
		const after = expression.slice(at + literal[0].length).trimStart()
		if (/[=!]=$/.test(before) || /^[=!]==?/.test(after)) continue
		/* An array that gets a method called on it is a DATA list, not a class
		   list — `['paused', 'past_due'].includes(status)`. Classes are assembled
		   with templates and ternaries, never with `.includes`. */
		if (dataArrays.some(([from, to]) => at > from && at < to)) continue
		const text = (literal[1] ?? literal[2] ?? literal[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
		for (const token of text.split(/\s+/))
			if (token && plausible(token)) found.push({ name: token, file, certain: true })
	}
}

/**
 * Walk one file's source and return every class name in it.
 *
 * Template holes are dropped rather than guessed at: a class built by
 * interpolation cannot be resolved statically, and inventing a name for it would
 * put a phantom into the very list that exists to catch phantoms.
 */
export function scanSource(input: string, file = ''): ClassUse[] {
	const found: ClassUse[] = []
	/* Comments first. A prose comment that happens to contain the word `class`
	   followed by an equals sign is not markup, and reading it as markup put the
	   word `standing` into the unknown list off the back of a tooltip note. */
	const source = input.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

	for (const match of source.matchAll(DIRECTIVE))
		found.push({ name: match[1], file, certain: true })

	for (const match of source.matchAll(ATTR)) {
		const at = match.index + match[0].length
		const { value, braced } = readValue(source, at)
		if (braced) {
			fromExpression(value, file, found)
			continue
		}
		/* A quoted value may still interpolate: `class="p-4 {cond ? 'a' : 'b'}"`.
		   The literal text between the holes is classes; each hole is an expression. */
		let cursor = 0
		while (cursor < value.length) {
			const hole = value.indexOf('{', cursor)
			const text = value.slice(cursor, hole === -1 ? undefined : hole)
			for (const token of text.split(/\s+/))
				if (token && plausible(token)) found.push({ name: token, file, certain: true })
			if (hole === -1) break
			const { end } = readValue(value, hole)
			fromExpression(value.slice(hole + 1, end - 1), file, found)
			cursor = end
		}
	}

	return found
}

/*
 * Regions a candidate string must NOT come from: an import specifier, or a URL.
 * Both are full of slashes and dashes and would otherwise read as classes.
 */
const NON_CLASS_CONTEXT = /\bfrom\s*$|\bimport\s*\(\s*$|https?:$|url\(\s*$/

/**
 * String literals anywhere in the file that could be classes.
 *
 * Deliberately generous — resolution decides. A candidate that means nothing to
 * the generator costs nothing; a candidate that resolves is a rule that would
 * otherwise have gone missing.
 */
export function scanCandidates(input: string, file = ''): ClassUse[] {
	const source = input.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
	const found: ClassUse[] = []
	for (const literal of source.matchAll(STRINGS)) {
		const at = literal.index as number
		if (NON_CLASS_CONTEXT.test(source.slice(Math.max(0, at - 12), at))) continue
		const text = (literal[1] ?? literal[2] ?? literal[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
		for (const token of text.split(/\s+/))
			if (token && plausible(token)) found.push({ name: token, file, certain: false })
	}
	return found
}

/** Every distinct class name across a set of files, sorted. */
export function scanFiles(files: Iterable<{ path: string; source: string }>): ClassUse[] {
	const all: ClassUse[] = []
	for (const { path, source } of files) all.push(...scanSource(source, path))
	return all
}

/*
 * Selectors in a stylesheet: `.site-card`, `.device-flow__code:hover`.
 *
 * Escaped punctuation is skipped, so a generated utility rule such as
 * `.text-\[length\:var\(--fs-body\)\]` does not read as a component class.
 */
const SELECTOR = /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g

/** `<style>` blocks, wherever a component keeps its own CSS. */
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/g

/**
 * Every class a stylesheet DECLARES.
 *
 * This is the other half of the coverage check. A surface's own component
 * classes are not utilities and never will be, so without this they show up as
 * unknown and bury the findings that matter — a phantom token, or a colour that
 * belongs to no brand — under a hundred lines of its own vocabulary.
 */
export function scanDeclaredClasses(css: string): string[] {
	const found = new Set<string>()
	const sources = [css, ...[...css.matchAll(STYLE_BLOCK)].map((m) => m[1])]
	for (const source of sources)
		for (const match of source.matchAll(SELECTOR)) {
			// A preceding backslash means the dot is part of an escaped class name.
			if (source[(match.index as number) - 1] === '\\') continue
			found.add(match[1])
		}
	return [...found].sort()
}
