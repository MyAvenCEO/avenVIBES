/**
 * ICONS — the one place a view is allowed to produce an SVG.
 *
 * `SAFE_TAGS` admits no SVG element, and that is not an oversight. An `<svg>`
 * can carry `<script>`, a `<foreignObject>` full of HTML, an `xlink:href` to a
 * remote document, and event handlers on any node — so a view that can emit
 * arbitrary SVG can emit arbitrary code, and views are exactly the thing this
 * engine is built to accept from places it does not fully trust.
 *
 * The answer is not to loosen the allowlist. It is to make icons a different
 * kind of thing: a REGISTRY of path data, sanitised once when it is registered
 * rather than every time it is rendered, and referenced by name. A view says
 * `{ icon: 'check' }` and cannot say anything else — there is no hole to reach
 * through, because the view never supplies markup at all.
 *
 * What a registered icon may contain is deliberately tiny: a viewBox and path
 * geometry. No fills, no styles, no nested documents. Colour comes from
 * `currentColor`, which is what makes one icon work in both themes and is the
 * reason this exists rather than an `<img>`.
 */

/**
 * One path.
 *
 * A bare string in the common case. The object form exists for duotone sets,
 * where a backing shape sits under the figure at a lower opacity — a number,
 * validated as a number, so there is still no string here a caller controls.
 *
 * `fill` overrides the icon's paint mode for this path alone, which is what a
 * duotone STROKE icon needs: the figure is drawn with `fill="none"`, and its
 * backing has to be a solid shape or there is nothing to see at 0.2. Both
 * paths are still `currentColor` — duotone here is two opacities of one
 * colour, never two colours, because two colours cannot be themed.
 */
export type IconPath = string | { d: string; opacity: number; fill?: boolean }

/** One icon: the box its geometry is drawn in, and the geometry. */
export type IconDef = {
	/** e.g. `0 0 24 24`. Four numbers, nothing else. */
	viewBox: string
	/** One or more path `d` strings. Geometry only. */
	paths: IconPath[]
	/** What a screen reader should say, if the icon is not decorative. */
	title?: string
	/** Stroke-drawn rather than filled. Most line icon sets are. */
	stroke?: boolean
	/**
	 * How far the FIGURE is inset inside its duotone backing, 0 to 0.4.
	 *
	 * A stroked figure and its backing are drawn on the same 24 grid, so the
	 * strokes run right to the backing's edge — a hamburger fills its slab and an
	 * X touches its disc, which reads as cramped rather than as a pair. Scaling
	 * the figure about the centre gives the two shapes room between them without
	 * redrawing either.
	 *
	 * Applied only to paths that are NOT the backing, since the backing is the
	 * thing being inset from.
	 */
	inset?: number
}

export type IconRegistry = Record<string, IconDef>

/** `0 0 24 24` and nothing more adventurous. */
const VIEWBOX = /^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/

/**
 * Path data, restricted to the SVG path grammar's own alphabet.
 *
 * Commands, numbers, and separators. A `d` attribute has no legitimate reason
 * to contain a letter outside `MmLlHhVvCcSsQqTtAaZz`, and anything that does is
 * either malformed or trying something.
 */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9,.\-+eE\s]+$/

/**
 * Refuse an icon that is not purely geometry.
 *
 * Runs when the icon is REGISTERED, not when it is rendered — once per icon
 * for the life of the process rather than once per instance, and early enough
 * that a bad icon fails a build rather than a page.
 */
export function validateIcon(name: string, icon: unknown): asserts icon is IconDef {
	const i = icon as Partial<IconDef> | null
	const problems: string[] = []
	if (!i || typeof i !== 'object') throw new Error(`icon "${name}": not an object`)
	if (!i.viewBox || !VIEWBOX.test(i.viewBox))
		problems.push('`viewBox` must be four numbers, e.g. "0 0 24 24"')
	if (!Array.isArray(i.paths) || i.paths.length === 0) problems.push('declares no `paths`')
	else
		i.paths.forEach((path, n) => {
			const d = typeof path === 'string' ? path : path?.d
			if (typeof d !== 'string' || !PATH_DATA.test(d))
				problems.push(`path ${n} is not path geometry`)
			if (typeof path === 'object' && path !== null) {
				const o = (path as { opacity?: unknown }).opacity
				if (typeof o !== 'number' || !(o >= 0 && o <= 1))
					problems.push(`path ${n}: \`opacity\` must be a number from 0 to 1`)
				const f = (path as { fill?: unknown }).fill
				if (f !== undefined && typeof f !== 'boolean')
					problems.push(`path ${n}: \`fill\` must be a boolean`)
			}
		})
	if (i.inset !== undefined && (typeof i.inset !== 'number' || !(i.inset >= 0 && i.inset <= 0.4)))
		problems.push('`inset` must be a number from 0 to 0.4')
	if (problems.length) throw new Error(`icon "${name}": ${problems.join('; ')}`)
}

/** Refuse a registry containing an icon that is not purely geometry. */
export function validateIconRegistry(registry: IconRegistry): void {
	for (const [name, icon] of Object.entries(registry)) validateIcon(name, icon)
}

/**
 * Render one registered icon to SVG markup.
 *
 * Every attribute is emitted by THIS function from validated parts; nothing a
 * view supplies reaches the output except the icon's name, and a name that is
 * not in the registry renders nothing at all.
 *
 * `currentColor` is the point: the icon takes the colour of the text around it,
 * so it themes for free and a dark-mode icon is not a second file.
 */
export function renderIcon(
	name: string,
	registry: IconRegistry,
	options: { size?: string; title?: string } = {}
): string {
	const icon = registry[name]
	if (!icon) return ''
	const size = /^[0-9.]+(rem|em|px|%)?$/.test(options.size ?? '') ? options.size : '1em'
	const title = options.title ?? icon.title
	const paint = icon.stroke
		? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
		: 'fill="currentColor"'
	return [
		`<svg viewBox="${icon.viewBox}" width="${size}" height="${size}" ${paint}`,
		title ? ` role="img" aria-label="${escapeText(title)}"` : ' aria-hidden="true"',
		' focusable="false">',
		/*
		 * The figure, inset inside its backing when the icon asks for it. The
		 * transform is built here from a validated NUMBER and the viewBox's own
		 * centre, so nothing about it comes from the caller.
		 */
		figure(icon),
		'</svg>'
	].join('')
}

/** Every path, with the figure scaled about the viewBox centre if `inset` asks. */
function figure(icon: IconDef): string {
	const draw = (path: IconPath) => {
		if (typeof path === 'string') return `<path d="${path}"/>`
		const paint = path.fill ? ' fill="currentColor" stroke="none"' : ''
		return `<path d="${path.d}" opacity="${path.opacity}"${paint}/>`
	}
	const inset = typeof icon.inset === 'number' && icon.inset > 0 ? icon.inset : 0
	if (!inset) return icon.paths.map(draw).join('')

	const isBacking = (p: IconPath) => typeof p !== 'string' && p.fill === true
	const [, , w, h] = icon.viewBox.split(' ').map(Number)
	const [cx, cy] = [w / 2, h / 2]
	const scale = 1 - inset
	/* Scaling a stroke scales its width too, which thins the figure as it
	   shrinks. Dividing the stroke back out keeps the line weight the set's. */
	const stroke = icon.stroke ? ` stroke-width="${round(2 / scale)}"` : ''
	return [
		icon.paths.filter(isBacking).map(draw).join(''),
		`<g transform="translate(${round(cx * inset)} ${round(cy * inset)}) scale(${round(scale)})"${stroke}>`,
		icon.paths
			.filter((p) => !isBacking(p))
			.map(draw)
			.join(''),
		'</g>'
	].join('')
}

/** Three decimals is plenty for a 24-unit grid, and keeps the markup readable. */
const round = (n: number) => Math.round(n * 1000) / 1000

/** The one escape this module needs; icon titles are the only free text in it. */
function escapeText(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
