/**
 * The brand guideline page — for whichever brand is handed in.
 *
 * It was avenCEO's page, built from avenCEO's exports. Every brand needs one,
 * and a second copy of a 350-line file that iterates a different set of
 * constants is the exact duplication this package exists to end.
 */
import type { ViewDef } from '../types.js'
import type { Brand } from './types.js'

export function createKitchenSink(brand: Brand) {
	const { components: COMPONENTS, layouts: LAYOUTS, tones: TONES, surfaces: GROUNDS } = brand
	const COMPONENT_NAMES = Object.keys(COMPONENTS)
	const LAYOUT_NAMES = Object.keys(LAYOUTS)
	const {
		type: TYPE_SCALE,
		tracking: TRACKING_SCALE,
		alpha: ALPHA,
		elevation: ELEVATION_SCALE,
		radius: RADIUS_SCALE,
		space: SPACE_SCALE
	} = brand.scales
	/**
	 * THE BRAND GUIDELINE PAGE, AS A VIEW.
	 *
	 * Not a hand-written HTML file that happens to describe the design system —
	 * a `ViewDef` built from the same objects every surface renders from, handed
	 * to aven-ui to render. Config in, rendered page out, exactly as the app and
	 * the id service work.
	 *
	 * That matters for more than tidiness. A showcase written by hand drifts from
	 * the system the moment someone adds a component and forgets the demo. This
	 * one cannot: the sections below iterate the actual exports, so a token that
	 * exists appears and a token that does not, does not. If it renders wrong, the
	 * design system is wrong.
	 *
	 * It is also the honest test of the renderer. This is the largest view in the
	 * codebase, and it is rendered to a static file by the same string renderer the
	 * marketing site will use — so if `renderViewToString` cannot carry a real
	 * page, it fails here rather than in production.
	 *
	 * The chrome references ROLES (`--color-foreground`), never a brand's tones.
	 * It used to say `--color-ink`, which is a colour avenCEO happens to have —
	 * so the page rendered correctly for exactly as long as that brand kept a
	 * tone by that name, and broke silently the moment it was renamed. Every
	 * brand has `foreground`, because the contract requires it.
	 *
	 * The view carries CLASSES, never inline styles. Swatches and specimens get
	 * their colours from generated helper classes (see `kitchenSinkCss`), which
	 * keeps the demonstration honest: everything on the page is drawn with the
	 * system's own vocabulary.
	 */

	/*
	 * The real type, now that this lives beside the renderer that consumes it.
	 * It was `Record<string, unknown>` and the caller cast — two halves of one
	 * contract kept in separate packages, each unable to name the other.
	 */
	type Node = ViewDef

	const el = (tag: string, cls: string | undefined, children: Node[]): Node => ({
		tag,
		...(cls ? { class: cls } : {}),
		children
	})
	const text = (tag: string, cls: string | undefined, value: string): Node => ({
		tag,
		...(cls ? { class: cls } : {}),
		text: value
	})

	/**
	 * A labelled section, so every block on the page reads the same way.
	 *
	 * The chrome wears `ks-` classes, NEVER the brand's own. It used to use
	 * `eyebrow-accent` and `meta`, which are components avenCEO happens to have —
	 * so on the first brand that did not, the page's own headings and ledes
	 * rendered unstyled. A guideline page cannot be written in the vocabulary of
	 * the thing it documents.
	 */
	function section(eyebrow: string, lede: string | null, body: Node[]): Node {
		return el('section', 'ks-section', [
			text('p', 'ks-eyebrow', eyebrow),
			...(lede ? [text('p', 'ks-lede', lede)] : []),
			...body
		])
	}

	/** A colour chip plus its name and value. */
	function swatch(name: string, value: string): Node {
		return el('div', 'ks-swatch', [
			el('div', `ks-chip ks-chip-${name}`, []),
			text('p', 'ks-swatch-name', name),
			text('p', 'ks-mono', value)
		])
	}

	/** One row of a scale: a specimen on the left, its name and value on the right. */
	function specimen(cls: string, label: string, value: string, sample: string): Node {
		return el('div', 'ks-row', [
			text('span', cls, sample),
			el('span', 'ks-row-meta', [text('span', 'ks-mono', `${label} · ${value}`)])
		])
	}

	/**
	 * Every component, rendered as itself.
	 *
	 * DERIVED from the brand. This was a hand-composed showcase — a panel holding
	 * an eyebrow, a title and a lede, then buttons, then a card — which read
	 * beautifully and described exactly one brand. Every class in it was
	 * avenCEO's, so avenYMA's page showed a gallery of components it does not
	 * have and none of the twenty it does.
	 *
	 * A specimen apiece is less charming and true for every brand, which is the
	 * trade a guideline page has to make. Nothing here can go stale: add a
	 * component and it appears, remove one and it goes.
	 */
	function componentGallery(): Node[] {
		return [
			el(
				'div',
				'stack',
				COMPONENT_NAMES.map((name) => {
					/* A button-ish component is shown as a button so its states work;
					   everything else is a block, which is what most of them are. */
					const isButton = /(^|-)btn(-|$)|button/.test(name)
					return el('div', 'ks-row', [
						isButton
							? text('button', name, name)
							: text('div', `ks-specimen ${name}`, sampleFor(name)),
						el('span', 'ks-row-meta', [text('span', 'ks-mono', `.${name}`)])
					])
				})
			)
		]
	}

	/**
	 * What to put inside a specimen.
	 *
	 * A component that shapes TEXT needs words to shape; one that draws a box
	 * needs to be seen as a box. Guessing from the name is crude and beats both
	 * alternatives: an empty div shows nothing, and a hardcoded sample per
	 * component is the hand-composed gallery all over again.
	 */
	function sampleFor(name: string): string {
		if (/quote|invitation|lede|prose|legal/.test(name))
			return 'The quick brown fox jumps over the lazy dog.'
		if (/eyebrow|kicker|meta|label|chip|badge|digits|mono/.test(name)) return name.toUpperCase()
		if (/display|title|heading/.test(name)) return 'A heading, set as itself'
		return name
	}

	/**
	 * The layout primitives, each shown doing the one thing it does.
	 *
	 * Also derived. The demonstrations named `switcher`, `sidebar` and `frame`
	 * whether or not the brand had them.
	 */
	function primitiveGallery(): Node[] {
		const box = (label: string) => text('div', 'ks-box', label)
		return LAYOUT_NAMES.flatMap((name) => [
			text('p', 'ks-eyebrow', name),
			el(`div`, `${name} ks-demo`, [box('one'), box('two'), box('three')])
		])
	}

	/** The whole page, as one view. */
	function kitchenSinkView(): Node {
		return el('main', 'ks', [
			el('header', 'ks-header', [
				text('p', 'ks-eyebrow', `@myavenceo/${brand.slug}`),
				text('h1', 'ks-title', 'Design system'),
				text(
					'p',
					'ks-lede',
					`Rendered by aven-ui from the configs themselves — ${
						Object.keys(TONES).length + Object.keys(GROUNDS).length
					} colours, ${Object.keys(TYPE_SCALE).length} type steps, ${LAYOUT_NAMES.length} primitives, ${
						COMPONENT_NAMES.length
					} components. Nothing here is written by hand; if it renders wrong, the system is wrong.`
				)
			]),

			section('Colour · tones', 'The paint. Every colour spelled exactly once.', [
				el(
					'div',
					'ks-swatches',
					Object.entries(TONES).map(([n, v]) => swatch(n, v))
				)
			]),
			section('Colour · creams', 'The ladder every surface stands on.', [
				el(
					'div',
					'ks-swatches',
					Object.entries(GROUNDS).map(([n, v]) => swatch(n, v))
				)
			]),

			section('Type', 'Twelve steps. A size not on the ramp is not available.', [
				el(
					'div',
					'stack',
					Object.entries(TYPE_SCALE).map(([n, v]) =>
						specimen(`ks-type ks-${n}`, n, v, 'The quick brown fox')
					)
				)
			]),
			section('Tracking', 'Five steps, for what was fourteen values.', [
				el(
					'div',
					'stack',
					Object.entries(TRACKING_SCALE).map(([n, v]) =>
						specimen(`ks-track ks-${n}`, n, v, 'TRACKING SAMPLE')
					)
				)
			]),
			section('Ink', 'Text emphasis, as four steps rather than a continuum.', [
				el(
					'div',
					'stack',
					Object.entries(ALPHA['on-text']).map(([n, v]) =>
						specimen(`ks-ink ks-${n}`, n, v, 'Readable at this weight')
					)
				)
			]),
			section('Tint', 'Surfaces, not text — hairlines and washes.', [
				el(
					'div',
					'stack',
					Object.entries(ALPHA['on-surface']).map(([n, v]) =>
						el('div', 'ks-row', [
							el('span', `ks-tint ks-${n}`, []),
							text('span', 'ks-mono', `${n} · ${v}`)
						])
					)
				)
			]),
			section('Elevation', null, [
				el(
					'div',
					'cluster',
					Object.keys(ELEVATION_SCALE).map((n) => text('div', `ks-box ks-${n}`, n))
				)
			]),
			section('Radius', null, [
				el(
					'div',
					'cluster',
					Object.entries(RADIUS_SCALE).map(([n, v]) => text('div', `ks-box ks-${n}`, `${n} · ${v}`))
				)
			]),
			section('Space', null, [
				el(
					'div',
					'stack',
					Object.entries(SPACE_SCALE).map(([n, v]) =>
						el('div', 'ks-row', [
							el('span', `ks-space ks-${n}`, []),
							text('span', 'ks-mono', `${n} · ${v}`)
						])
					)
				)
			]),

			section(
				`Primitives · ${LAYOUT_NAMES.length}`,
				'The shapes almost every layout is made of. Each tuned at the call site by a custom property rather than by a class per value.',
				primitiveGallery()
			),
			section(
				`Components · ${COMPONENT_NAMES.length}`,
				'Each rendered as itself, from the same definitions aven-ui applies as a StyleDef.',
				componentGallery()
			)
		])
	}

	/**
	 * The page's own layout, plus one helper class per token.
	 *
	 * Generated rather than written so the specimens cannot describe a token that
	 * no longer exists: every rule below is derived from the same exports the view
	 * iterates. The page needs SOME styling of its own — a swatch has to get its
	 * colour somehow — and this is how it gets it without inline styles.
	 */
	function kitchenSinkCss(): string {
		const helpers: string[] = []
		for (const name of Object.keys(TONES))
			helpers.push(`.ks-chip-${name} { background: var(--color-${name}); }`)
		for (const name of Object.keys(GROUNDS))
			helpers.push(
				`.ks-chip-${name} { background: var(--color-${name}); border: 1px solid var(--color-border); }`
			)
		for (const name of Object.keys(TYPE_SCALE))
			helpers.push(`.ks-${name} { font-size: var(--${name}); }`)
		for (const name of Object.keys(TRACKING_SCALE))
			helpers.push(`.ks-${name} { letter-spacing: var(--${name}); text-transform: uppercase; }`)
		for (const name of Object.keys(ALPHA['on-text']))
			helpers.push(
				`.ks-${name} { color: color-mix(in srgb, var(--color-foreground) calc(var(--${name}) * 100%), transparent); }`
			)
		for (const name of Object.keys(ALPHA['on-surface']))
			helpers.push(
				`.ks-${name} { background: color-mix(in srgb, var(--color-foreground) calc(var(--${name}) * 100%), transparent); }`
			)
		for (const name of Object.keys(ELEVATION_SCALE))
			helpers.push(`.ks-${name} { box-shadow: var(--${name}); }`)
		for (const name of Object.keys(RADIUS_SCALE))
			helpers.push(`.ks-${name} { border-radius: var(--${name}); }`)
		for (const name of Object.keys(SPACE_SCALE))
			helpers.push(`.ks-${name} { inline-size: var(--${name}); }`)

		return [
			'@layer utilities {',
			"\t/* The page's own furniture. Everything else on it is the system. */",
			'\t.ks { max-inline-size: 62rem; margin-inline: auto; padding: 3rem 1.5rem 6rem; }',
			'\t.ks-header { margin-block-end: 3rem; }',
			/* The chrome's own type. It borrowed the brand's `eyebrow-accent`, `lede`,
			   `meta` and `mono-meta` until the first brand that had none of them. */
			'\t.ks-eyebrow { font-size: var(--fs-micro); letter-spacing: var(--tracking-wider); text-transform: uppercase; color: color-mix(in oklab, var(--color-foreground) 72%, transparent); margin: 0; }',
			'\t.ks-lede { font-size: var(--fs-meta); color: color-mix(in oklab, var(--color-foreground) 72%, transparent); margin: 0; max-inline-size: 60ch; }',
			'\t.ks-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--fs-nano); color: color-mix(in oklab, var(--color-foreground) 72%, transparent); }',
			/* A specimen shows a component AS ITSELF, so it must add nothing of its
			   own beyond room to be seen. */
			'\t.ks-specimen { min-inline-size: 0; }',
			'\t.ks-title { font-family: var(--font-display); font-size: var(--fs-display); margin: .25rem 0 .5rem; letter-spacing: var(--tracking-tight); }',
			'\t.ks-section { margin-block-end: 3.5rem; display: grid; gap: var(--space-comfortable); }',
			'\t.ks-swatches { display: flex; flex-wrap: wrap; gap: var(--space-snug); }',
			'\t.ks-swatch { inline-size: 7rem; }',
			'\t.ks-swatch-name { font-size: var(--fs-micro); margin: .35rem 0 0; }',
			'\t.ks-chip { block-size: 3rem; border-radius: var(--radius-inner); }',
			'\t.ks-row { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; border-block-end: 1px solid color-mix(in srgb, var(--color-foreground) 8%, transparent); padding-block-end: .4rem; }',
			'\t.ks-row-meta { flex-shrink: 0; }',
			'\t.ks-tint { block-size: 1.5rem; inline-size: 8rem; border-radius: var(--radius-chip); }',
			'\t.ks-space { block-size: 1rem; background: var(--color-anchor); border-radius: 2px; }',
			'\t.ks-box { background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-inner); padding: 1rem; font-size: var(--fs-micro); }',
			'\t.ks-demo { border: 1px dashed color-mix(in srgb, var(--color-foreground) 16%, transparent); border-radius: var(--radius-inner); padding: var(--space-snug); }',
			'\t.ks-frame { --ratio: 16 / 9; max-inline-size: 20rem; }',
			'\t.ks-full { inline-size: 100%; }',
			'',
			'\t/* One helper per token, generated from the same exports the view walks. */',
			...helpers.map((rule) => `\t${rule}`),
			'}',
			''
		].join('\n')
	}

	return { kitchenSinkView, kitchenSinkCss }
}

/** What `createKitchenSink` hands back. */
export type KitchenSink = ReturnType<typeof createKitchenSink>
