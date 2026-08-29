/**
 * VARIANTS AND THE EIGHT STATES.
 *
 * A design system is not a set of components, it is a set of components in
 * every state they can be in. The states are where systems actually fail: the
 * resting look gets designed, hover and focus get added by whoever needed them,
 * disabled gets an opacity, and loading gets reused from disabled — at which
 * point an in-flight action reads as "you cannot do this" instead of "this is
 * happening". None of that is visible in a screenshot of the resting state,
 * which is why it survives review.
 *
 * So states are DECLARED per unit, the selectors are fixed here rather than
 * chosen per component, and a unit that says it is interactive is checked for
 * the ones it must have.
 *
 * The selectors are opinionated on purpose:
 *
 *   focus     `:focus-visible`, never `:focus` — a mouse click should not draw
 *             a focus ring, and `:focus` is why so many systems have one that
 *             everybody then removes with `outline: none`.
 *   disabled  matches the attribute AND `aria-disabled`, because a non-button
 *             cannot carry `disabled` and half of them get it wrong.
 *   loading   `[aria-busy="true"]` — a distinct state from disabled, and the
 *             screen-reader announcement comes free.
 *   selected  `[aria-selected]` and `[aria-pressed]`, the two ARIA spellings of
 *             the same idea, so a toggle and a tab share one declaration.
 */
import type { Decl } from './brand/types.js'

/** The eight states every interactive unit is measured against. */
export type StateName =
	| 'default'
	| 'hover'
	| 'focus'
	| 'active'
	| 'disabled'
	| 'loading'
	| 'error'
	| 'selected'

/** How each state is selected in CSS, relative to the unit's own class. */
export const STATE_SELECTORS: Record<Exclude<StateName, 'default'>, string> = {
	hover: ':hover:not([disabled]):not([aria-disabled="true"])',
	focus: ':focus-visible',
	active: ':active:not([disabled]):not([aria-disabled="true"])',
	disabled: '[disabled], &[aria-disabled="true"]',
	loading: '[aria-busy="true"]',
	error: '[data-state~="error"], &[aria-invalid="true"]',
	/* Three attributes, because 'this is the current one' is spelled three ways
	   and each is correct in its own place. `aria-selected` belongs to a tab, an
	   option, a grid cell; `aria-pressed` to a toggle button; and `aria-current`
	   to a link in a navigation — the current PAGE is not a selected option, and
	   putting `aria-selected` on an `<a>` is invalid ARIA that axe rejects. A
	   sidebar could therefore document a selected state, declare it, mark its
	   current item the only correct way, and render nothing.
	   `:not([aria-current="false"])` because `aria-current="false"` is the
	   attribute's own way of saying 'not this one', and a bare `[aria-current]`
	   would match it. */
	selected:
		'[aria-selected="true"], &[aria-pressed="true"], &[aria-current]:not([aria-current="false"])'
}

/**
 * The states an interactive unit must declare.
 *
 * Four, not eight. `loading` only means something for an async action, `error`
 * only for something that takes input, and `selected` only for something
 * selectable — requiring them everywhere would produce declarations written to
 * satisfy a checker, which is worse than not having them.
 */
export const REQUIRED_INTERACTIVE_STATES: StateName[] = ['hover', 'focus', 'active', 'disabled']

/** What a unit declares about how it varies and how it responds. */
export type UnitStyling = {
	/** The resting look. */
	base?: Decl
	/** Named axes of variation: `variant: { primary, secondary, danger }`. */
	variants?: Record<string, Record<string, Decl>>
	/** Per-state overrides. `default` is a synonym for `base`. */
	states?: Partial<Record<StateName, Decl>>
	/**
	 * Named sub-elements, `part -> declarations`.
	 *
	 * A unit larger than one tag has interior pieces — a field's label, hint
	 * and error; a toast's title and dismiss — and they need names for the same
	 * reason the unit does. Emitted as `.<unit>-<part>`, so `field-label` is a
	 * class a view can carry and a caller can never invent.
	 *
	 * A variant or state may target one part with `$part`, which is how "the
	 * invalid field reddens its CONTROL and not its label" is expressible.
	 */
	parts?: Record<string, Decl>
	/**
	 * Animations this unit owns, `name -> { offset: declarations }`.
	 *
	 * Here rather than in a global stylesheet because a unit that animates and
	 * a keyframe that defines the animation are one thing: shipping the unit
	 * without its keyframes gives you a spinner that does not spin, silently.
	 */
	keyframes?: Record<string, Record<string, Decl>>
	/**
	 * What this unit does under `prefers-reduced-motion: reduce`.
	 *
	 * Required for any unit that animates, and it is a DECLARATION rather than
	 * a blanket `animation: none`, because the right answer differs: a spinner
	 * slows down (a still spinner says nothing), a skeleton stops pulsing, a
	 * drawer still moves (removing its transform leaves it off-screen).
	 */
	reducedMotion?: Decl
	/**
	 * Whether this unit is operated by a person.
	 *
	 * Set it and the four required states are enforced. It is explicit rather
	 * than inferred from the tag, because a `div` with a click handler is
	 * interactive and a `button` used purely as a label is not.
	 */
	interactive?: boolean
}

/**
 * The keys `styling` may contain.
 *
 * Checked, not documented. Twelve units were once written against a contract
 * that did not yet have `parts`, `keyframes` or `reducedMotion`; the compiler
 * ignored all three and emitted CSS that looked complete and was missing half
 * of every unit. Nothing reported it, because dropping an unknown key is
 * indistinguishable from not having one.
 */
const STYLING_KEYS = new Set([
	'base',
	'variants',
	'states',
	'parts',
	'keyframes',
	'reducedMotion',
	'interactive',
	'$description'
])

/**
 * Compile a unit's styling into the flat `components` map the style engine
 * already understands.
 *
 * Variants become modifier classes (`btn--danger`), states become selectors on
 * the base class. Nothing here invents a CSS mechanism: it decides the NAMES
 * and the SELECTORS once, centrally, so two components cannot spell the same
 * state differently.
 */
export function compileUnitStyling(name: string, styling: UnitStyling): Record<string, Decl> {
	const out: Record<string, Decl> = {}

	/* Stripped, like every other block. `base` was the one that was not, so a
	   `$description` on the resting look reached the stylesheet as a declaration
	   and postcss refused the file. Third variant of the same bug: something
	   written for a reader ending up in the output. */
	const base: Decl = {
		...strip(styling.base ?? {}),
		...strip(styling.states?.default ?? {})
	}

	const partStates: Record<string, Decl> = {}
	for (const [state, decl] of Object.entries(styling.states ?? {})) {
		if (state === 'default' || !decl) continue
		const selector = STATE_SELECTORS[state as Exclude<StateName, 'default'>]
		if (!selector) continue
		const { $part, ...rest } = decl as Decl & { $part?: string }
		if ($part) {
			/* The state lives on the PART's class — `.field-control:focus` — not
			   on the unit's, because the thing that takes focus is the input. */
			const key = `${name}-${$part}`
			const existing = partStates[key] ?? {}
			existing[`&${selector}`] = strip(rest)
			partStates[key] = existing
		} else base[`&${selector}`] = strip(rest)
	}

	if (styling.reducedMotion)
		base['@media (prefers-reduced-motion: reduce)'] = strip(styling.reducedMotion)

	if (Object.keys(base).length) out[name] = base

	/* Parts: `.field-label`, `.toast-title`. A flat class rather than a nested
	   selector, so a part can be styled wherever it is placed — including
	   through a slot, where a descendant selector would not reach it. */
	for (const [part, decl] of Object.entries(styling.parts ?? {}))
		out[`${name}-${part}`] = strip(decl)

	/* Merged, not assigned, and AFTER the parts loop: a part usually declares
	   both a resting look and a state, and assigning either one over the other
	   silently drops it. */
	for (const [key, decl] of Object.entries(partStates)) out[key] = { ...out[key], ...decl }

	for (const [axis, options] of Object.entries(styling.variants ?? {})) {
		if (axis.startsWith('$')) continue
		for (const [option, decl] of Object.entries(options)) {
			/* An axis may document itself. `$description` sitting beside the options
			   is not an option, and emitting it produced `.section--measure-$description`
			   — a `$` in a selector, which takes the whole stylesheet down. */
			if (option.startsWith('$')) continue
			/* `variant` is the default axis and is not repeated in the class name,
			   so the common case reads `btn--danger` rather than `btn--variant-danger`. */
			const suffix = axis === 'variant' ? option : `${axis}-${option}`
			const { $part, ...rest } = decl as Decl & { $part?: string }
			/*
			 * A variant may dress ONE part: `size: sm` on a field shrinks the
			 * control, not the label; `tone: accent` on a stat colours the number,
			 * not the caption.
			 *
			 * The class still goes on the UNIT, and the rule reaches the part as a
			 * descendant. Putting it on the part instead — `.stat-value--tone-accent`
			 * — compiles fine and is a bad interface: the caller has to know which
			 * interior piece carries which variant, which is exactly the knowledge a
			 * unit exists to hold. States are the other way round, because the thing
			 * that takes focus really is the input.
			 */
			out[`${name}--${suffix}`] = $part
				? ({ [`& .${name}-${$part}`]: strip(rest) } as Decl)
				: strip(rest)
		}
	}

	for (const [animation, frames] of Object.entries(styling.keyframes ?? {})) {
		const compiled: Decl = {}
		for (const [offset, decl] of Object.entries(frames)) compiled[offset] = strip(decl)
		out[`@keyframes ${animation}`] = compiled
	}

	return out
}

/** Drop the documentation keys, which are for a reader and not for a browser. */
function strip(decl: Decl): Decl {
	const out: Decl = {}
	for (const [k, v] of Object.entries(decl)) if (!k.startsWith('$')) out[k] = v
	return out
}

/**
 * Check a unit's styling against the contract, returning every problem.
 *
 * Two checks that are not about completeness, and matter more than it:
 *
 * `loading` must not simply reuse `disabled`'s declarations. Dimming a control
 * while its action is in flight tells the user the wrong thing — the control
 * should stay at full strength and swap its label for a spinner.
 *
 * `focus` must actually draw something. A focus state that only changes a
 * background colour is invisible to the people who need it, so it has to touch
 * `outline` or `box-shadow`.
 */
export function checkStateContract(name: string, styling: UnitStyling): string[] {
	const problems: string[] = []

	/*
	 * An unknown key is a typo or a feature the compiler does not have, and both
	 * produce the same thing: declarations that vanish. This check exists
	 * because twelve units were once written with `parts`, `keyframes` and
	 * `reducedMotion` against a compiler that had none of them, and every one of
	 * them compiled cleanly while emitting half its CSS.
	 */
	for (const key of Object.keys(styling))
		if (!STYLING_KEYS.has(key))
			problems.push(
				`"${name}" declares \`styling.${key}\`, which nothing compiles — it would be dropped silently`
			)

	/*
	 * A unit that animates must say what it does under `reduce`. Not a nicety:
	 * an entrance animation is often the only thing that reveals the content, so
	 * a blanket `animation: none` applied by a user's setting can leave the
	 * element invisible. Saying it per unit is the only way to get it right.
	 */
	const animates =
		styling.keyframes ||
		JSON.stringify({ b: styling.base, v: styling.variants, p: styling.parts }).match(
			/"(animation|transition)[A-Za-z]*":/
		)
	if (animates && !styling.reducedMotion)
		problems.push(
			`"${name}" animates but declares no \`reducedMotion\` — say what it does under reduce`
		)

	if (!styling.interactive) return problems

	const declared = styling.states ?? {}
	for (const state of REQUIRED_INTERACTIVE_STATES)
		if (!declared[state])
			problems.push(`"${name}" is interactive but declares no \`${state}\` state`)

	const focus = declared.focus
	if (focus && !Object.keys(focus).some((p) => /outline|box-shadow|border/i.test(p)))
		problems.push(
			`"${name}" declares a \`focus\` state that draws no ring — it must set outline, box-shadow or border`
		)

	const loading = declared.loading
	const disabled = declared.disabled
	if (loading && disabled && JSON.stringify(loading) === JSON.stringify(disabled))
		problems.push(
			`"${name}" gives \`loading\` the same declarations as \`disabled\` — an action in flight must not read as unavailable`
		)

	return problems
}

/** The class list for a placement: the unit's class plus its chosen variants. */
export function variantClasses(name: string, chosen: Record<string, string> = {}): string {
	const parts = [name]
	for (const [axis, option] of Object.entries(chosen)) {
		if (!option) continue
		parts.push(`${name}--${axis === 'variant' ? option : `${axis}-${option}`}`)
	}
	return parts.join(' ')
}
