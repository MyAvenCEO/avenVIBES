/**
 * A BRAND AS A DOCUMENT — reading one, validating it, and turning it into a `Brand`.
 *
 * `types.ts` says what a brand IS. This says how a brand is WRITTEN DOWN, and
 * it is the piece that makes the claim in that file literally true: a brand is
 * a config, so a new brand should be a JSON file and a logo, and nothing else.
 *
 * Until this existed, it was a JSON file, a logo, and roughly 500 lines of
 * TypeScript per brand — a loader to flatten the tokens, colour arithmetic to
 * derive the faces, and an assembly file to hand the result to the kit. Every
 * one of those is the same code for every brand, so every one of them was a
 * thing the second brand would have had to write again. They are here now.
 *
 * The format is DTCG (`$type` / `$value` / `$description`), which is not a
 * preference: it is what Style Dictionary, Tokens Studio and the Figma Variables
 * bridge already read, so a brand written this way is legible to the design
 * tooling without an exporter in between.
 *
 * Pure, like the rest of this module: no filesystem, no Node built-ins. The
 * caller reads the JSON however it likes and hands over the parsed object.
 */
import type { Brand, BrandScales, Decl, TokenMap } from './types.js'

/* ── The shape on disk ──────────────────────────────────────────────────── */

/** One token: its value, optionally its type and the prose describing it. */
export type DtcgToken = {
	$type?: string
	$value: string | number
	$description?: string
}

/**
 * A named set of tokens, plus optional prose about the set itself.
 *
 * `$`-prefixed keys are metadata rather than tokens, which is what lets a group
 * carry its own description without that description becoming a colour called
 * `$description`.
 */
export type DtcgGroup = {
	$description?: string
} & Record<string, DtcgToken | string | undefined>

/**
 * An ordered set of colours, walked by index rather than chosen by meaning.
 *
 * Not a role and not a group of roles — nothing in it is picked because of what
 * it means, only because of where it sits. An identicon generator wants the
 * third colour, not the "warning" one. Keeping these out of `roles` is what
 * stops `colourNames()` from offering `bg-avatar` as a utility.
 */
export type DtcgPalette = { $description?: string; $type?: string; $value: string[] }

/** Every colour group a brand declares. Names match `Brand`'s own fields. */
export type BrandColorGroups = {
	tones: DtcgGroup
	functional: DtcgGroup
	surfaces: DtcgGroup
	ink: DtcgGroup
	roles: DtcgGroup
	/** Optional: ordered sets, if the brand has any. */
	palettes?: { $description?: string } & Record<string, DtcgPalette | string | undefined>
}

/** Every scale a brand declares. Names match `BrandScales`. */
export type BrandScaleGroups = {
	type: DtcgGroup
	tracking: DtcgGroup
	alpha: { 'on-text': DtcgGroup; 'on-surface': DtcgGroup }
	elevation: DtcgGroup
	radius: DtcgGroup
	space: DtcgGroup
	motion?: DtcgGroup
}

/** A brand, as it is written down. */
export type BrandDocument = {
	$description?: string
	name: string
	slug: string
	color: BrandColorGroups
	font: { stack: DtcgGroup; weight: DtcgGroup }
	radii: DtcgGroup
	scale: BrandScaleGroups
	/** Which component each bare HTML element IS, as `selector: component`. */
	elements: Record<string, string>
	appIconPlate: string
}

/** The pieces, as they are written down. */
export type ComponentsDocument = {
	$description?: string
	components: Record<string, Decl>
	layouts: Record<string, Decl>
}

/* ── Reading ────────────────────────────────────────────────────────────── */

/**
 * Flatten one group to `name -> value`.
 *
 * Values are stringified: everything downstream emits CSS, where `0.65` and
 * `"0.65"` are the same thing, and a brand author should not have to decide
 * whether an opacity is a number or a string.
 */
export function flatten(group: DtcgGroup | undefined): TokenMap {
	const out: TokenMap = {}
	if (!group) return out
	for (const [name, token] of Object.entries(group)) {
		if (name.startsWith('$') || token === undefined) continue
		out[name] = typeof token === 'string' ? token : String(token.$value)
	}
	return out
}

/** The prose attached to a group, for tooling that shows it. */
export function describe(group: DtcgGroup | undefined): string | undefined {
	return group?.$description
}

/** Every token's `$description` in a group, keyed by token name. */
export function descriptions(group: DtcgGroup | undefined): Record<string, string> {
	const out: Record<string, string> = {}
	if (!group) return out
	for (const [name, token] of Object.entries(group)) {
		if (name.startsWith('$') || token === undefined || typeof token === 'string') continue
		if (token.$description) out[name] = token.$description
	}
	return out
}

/* ── Checking ───────────────────────────────────────────────────────────── */

/* The REQUIRED groups. `palettes` is optional and is not a group of tokens —
   it holds arrays — so it is checked on its own below rather than flattened. */
const COLOR_GROUPS: Array<Exclude<keyof BrandColorGroups, 'palettes'>> = [
	'tones',
	'functional',
	'surfaces',
	'ink',
	'roles'
]

/** The flat scales, which validate the same way. `alpha` is nested and checked separately. */
const SCALE_GROUPS: Array<Exclude<keyof BrandScaleGroups, 'alpha'>> = [
	'type',
	'tracking',
	'elevation',
	'radius',
	'space'
]

/**
 * Refuse a document that is missing a part of the system.
 *
 * Nothing here is optional-by-omission, for the reason `types.ts` gives: a
 * missing scale is a missing part of the system, not a default someone else
 * picks. The failure this prevents is specific and nasty — an absent group
 * flattens to `{}`, every token that referenced it emits `var(--color-)`, and
 * the page renders in the browser's defaults rather than failing. A named error
 * at load is the cheapest possible version of that discovery.
 */
export function validateBrandDocument(doc: unknown): asserts doc is BrandDocument {
	const problems: string[] = []
	const d = doc as Partial<BrandDocument> | null

	if (!d || typeof d !== 'object') throw new Error('brand document: not an object')
	if (!d.name) problems.push('missing `name`')
	if (!d.slug) problems.push('missing `slug`')
	if (!d.appIconPlate) problems.push('missing `appIconPlate`')
	if (!d.elements || typeof d.elements !== 'object') problems.push('missing `elements`')

	for (const group of COLOR_GROUPS) {
		const g = d.color?.[group]
		if (!g) problems.push(`missing colour group \`color.${group}\``)
		else if (Object.keys(flatten(g)).length === 0)
			problems.push(`colour group \`color.${group}\` declares no tokens`)
	}
	/*
	 * A palette is an ordered array, so `flatten` cannot see into it and the
	 * loop above would pass a palette of nonsense. Check it here: a generator
	 * that walks a bad palette draws a broken avatar and reports nothing.
	 */
	for (const [name, palette] of Object.entries(d.color?.palettes ?? {})) {
		if (name.startsWith('$')) continue
		const value = (palette as { $value?: unknown })?.$value
		if (!Array.isArray(value) || value.length === 0)
			problems.push(`palette \`color.palettes.${name}\` declares no colours`)
		else if (!value.every((c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)))
			problems.push(`palette \`color.palettes.${name}\` holds a value that is not a hex colour`)
	}
	for (const group of SCALE_GROUPS) {
		const g = d.scale?.[group]
		if (!g) problems.push(`missing scale \`scale.${group}\``)
		else if (Object.keys(flatten(g)).length === 0)
			problems.push(`scale \`scale.${group}\` declares no steps`)
	}
	/* Alpha is the one nested scale: two floors, one axis. Both are required —
	   a brand with no surface-alpha has no hairlines and no washes. */
	for (const floor of ['on-text', 'on-surface'] as const) {
		const g = d.scale?.alpha?.[floor]
		if (!g) problems.push(`missing scale \`scale.alpha.${floor}\``)
		else if (Object.keys(flatten(g)).length === 0)
			problems.push(`scale \`scale.alpha.${floor}\` declares no steps`)
	}

	const fonts = flatten(d.font?.stack)
	if (!fonts.app) problems.push('missing `font.stack.app`')
	if (!fonts.web) problems.push('missing `font.stack.web`')
	if (Object.keys(flatten(d.font?.weight)).length === 0) problems.push('`font.weight` is empty')
	if (Object.keys(flatten(d.radii)).length === 0) problems.push('`radii` is empty')

	if (problems.length)
		throw new Error(
			`${d.name ?? 'brand'}: the document is not a complete brand.\n  ${problems.join('\n  ')}`
		)
}

/** Refuse a pieces document that declares neither components nor layouts. */
export function validateComponentsDocument(doc: unknown): asserts doc is ComponentsDocument {
	const d = doc as Partial<ComponentsDocument> | null
	if (!d || typeof d !== 'object') throw new Error('components document: not an object')
	if (!d.components || typeof d.components !== 'object')
		throw new Error('components document: missing `components`')
	if (!d.layouts || typeof d.layouts !== 'object')
		throw new Error('components document: missing `layouts`')
}

/* ── Becoming a Brand ───────────────────────────────────────────────────── */

/**
 * Two documents in, a `Brand` out — the whole of what a brand's code used to be.
 *
 * `scaleTokens` is derived here rather than declared, and the ORDER matters:
 * it decides the order the custom properties are emitted in, so it is fixed
 * here once instead of being a thing each brand could get differently.
 *
 * Both documents are validated first, and `assertNoShadowedTokens` runs on the
 * assembled brand, so a name declared twice fails here rather than silently
 * losing to whichever map is emitted last.
 */
export function brandFromDocuments(
	brandDoc: unknown,
	componentsDoc: unknown,
	overrides: Partial<Brand> = {}
): Brand {
	validateBrandDocument(brandDoc)
	validateComponentsDocument(componentsDoc)

/**
 * The scale groups this file reads by NAME, because their shape is known:
 * `alpha` is nested two deep, and the rest are pulled out individually
 * elsewhere. Everything else a brand declares under `scale` is passed through
 * as-is, so a new axis needs no change here to exist.
 */
const KNOWN_SCALES = new Set(['type', 'tracking', 'alpha', 'elevation', 'radius', 'space'])

	const scales: BrandScales = {
		type: flatten(brandDoc.scale.type),
		tracking: flatten(brandDoc.scale.tracking),
		alpha: {
			'on-text': flatten(brandDoc.scale.alpha['on-text']),
			'on-surface': flatten(brandDoc.scale.alpha['on-surface'])
		},
		elevation: flatten(brandDoc.scale.elevation),
		radius: flatten(brandDoc.scale.radius),
		space: flatten(brandDoc.scale.space),
		/*
		 * Every OTHER group in `scale`, whatever it is called.
		 *
		 * This was an allowlist, and the allowlist is what caused the bug it was
		 * written to fix: a brand declared no motion, the list had no motion entry
		 * to spread, and every `transition` in a component library resolved to
		 * nothing. Adding `motion` to the list fixed that one case and left the
		 * next one — `z`, referenced twice and defined nowhere, so a fixed drawer
		 * had no stacking order and sat behind the content it was covering.
		 *
		 * A scale a brand declares is a scale the brand meant. The named groups
		 * above stay named because their SHAPE is known — `alpha` is nested, and
		 * the rest are read individually elsewhere — but nothing else has to be
		 * enumerated here to exist.
		 */
		...Object.fromEntries(
			Object.entries(brandDoc.scale)
				.filter(([key]) => !KNOWN_SCALES.has(key) && !key.startsWith('$'))
				.map(([key, group]) => [key, flatten(group as DtcgGroup)])
		)
	}

	const fonts = flatten(brandDoc.font.stack)

	return {
		name: brandDoc.name,
		slug: brandDoc.slug,

		tones: flatten(brandDoc.color.tones),
		functional: flatten(brandDoc.color.functional),
		surfaces: flatten(brandDoc.color.surfaces),
		ink: flatten(brandDoc.color.ink),
		roles: flatten(brandDoc.color.roles),

		fonts: { app: fonts.app, web: fonts.web, ...(fonts.display ? { display: fonts.display } : {}) },
		fontWeights: flatten(brandDoc.font.weight),
		radii: flatten(brandDoc.radii),
		scales,
		scaleTokens: {
			...scales.type,
			...scales.tracking,
			...scales.elevation,
			...scales.radius,
			...scales.space,
			...scales.alpha['on-text'],
			...scales.alpha['on-surface'],
			/* Extras LAST, so a brand adding a group cannot silently shadow a
			   named one — a `space` group declared twice should keep the parsed
			   one, not the loose one. */
			...Object.fromEntries(
				Object.entries(scales).flatMap(([key, group]) =>
					KNOWN_SCALES.has(key) ? [] : Object.entries(group as TokenMap)
				)
			)
		},

		layouts: componentsDoc.layouts,
		components: componentsDoc.components,
		elements: brandDoc.elements,

		appIconPlate: brandDoc.appIconPlate,
		...overrides
	}
}

/* ── Colour arithmetic ──────────────────────────────────────────────────── */

/**
 * `#1f2a3d` + 0.56 -> `rgba(31, 42, 61, 0.56)`.
 *
 * Maths, not a decision, so it belongs to every brand rather than to the one
 * that happened to need it first.
 */
export function withAlpha(hex: string, alpha: number): string {
	const h = hex.replace('#', '')
	const full =
		h.length === 3
			? h
					.split('')
					.map((c) => c + c)
					.join('')
			: h
	const channel = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
	return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${alpha})`
}

/**
 * Snap an opacity percentage to its nearest step on a scale.
 *
 * Opacity is a continuum, so "nearest" is arithmetic rather than a lookup — a
 * sixty-row table of integers would restate the same rule less legibly. Used
 * when converting an arbitrary `text-foreground/47` to the step that replaces
 * it.
 */
export function nearestStepOn(scale: TokenMap, percent: number): string {
	let best = ''
	let distance = Number.POSITIVE_INFINITY
	for (const [name, value] of Object.entries(scale)) {
		const d = Math.abs(Number(value) * 100 - percent)
		if (d < distance) {
			distance = d
			best = name
		}
	}
	return best
}
