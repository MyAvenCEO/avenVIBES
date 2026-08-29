/**
 * WHAT A BRAND IS.
 *
 * One interface, and the whole point of this package. Everything else here —
 * the CSS generator, the utility layer, the scanner, the Vite step — is written
 * against this type and holds no colour, typeface or component of its own.
 *
 * The reason it exists: `generate` and `utilities` used to import avenCEO's
 * palette directly. That was invisible while there was one brand, and became
 * the whole problem the moment there were two — a second brand would have
 * rendered in the first one's colours. A brand is DATA, and the machinery is
 * the same machinery, or the claim that a brand is a config is not true.
 *
 * A new brand implements this and gets the entire pipeline. Nothing here is
 * optional-by-omission: a missing scale is a missing part of the system, not a
 * default someone else picks.
 */

/** CSS declarations, or a nested block keyed by a selector containing `&`. */
export type Decl = { [key: string]: string | Decl }

/**
 * A named set of custom properties, `name: value`.
 *
 * Values may reference other tokens with `var(--color-…)`, which is how a role
 * points at a tone without repeating its hex.
 */
export type TokenMap = Record<string, string>

/**
 * Which audience a stylesheet is for.
 *
 * Now selects only the FONT STACK. It used to also pick which roles a surface
 * got, which is why there were three role groups; measuring them showed the
 * site's roles were almost entirely aliases of the shared ones, so the roles
 * merged and the audience kept the one job it was actually good at.
 */
export type Audience = 'app' | 'web' | 'plain'

export interface BrandScales {
	/** The type ramp. Keys are token names: `fs-body`, `fs-display-lg`. */
	type: TokenMap
	/** Letter-spacing, keyed `tracking-*`. */
	tracking: TokenMap
	/**
	 * ALPHA — one axis, two floors.
	 *
	 * `on-text` and `on-surface` were `ink` and `tint`, which sat beside the
	 * type ramp and read as though emphasis were typographic. It is not: both
	 * are opacity, and the only thing separating them is what the opacity is
	 * applied to. Text has a contrast floor and a surface does not, which is
	 * the whole distinction and exactly what the old names hid.
	 */
	alpha: { 'on-text': TokenMap; 'on-surface': TokenMap }
	/** Shadows, keyed `shadow-*`. */
	elevation: TokenMap
	/** Corner radii, keyed `radius-*`. */
	radius: TokenMap
	/** Spacing steps, keyed `space-*`. */
	space: TokenMap
}

export interface Brand {
	/** How the brand is written for people: `avenCEO`, `avenYMA`. */
	name: string
	/** How it is written for machines: package suffix, file names, CSS comments. */
	slug: string

	/* ── The paint ────────────────────────────────────────────────────────── */

	/** The brand's own colours, each spelled exactly once. */
	tones: TokenMap
	/**
	 * Colours that carry a MEANING and are never identity.
	 *
	 * Split out of `tones` because a palette that lists the failure colour
	 * beside the brand blue invites someone to decorate with it. Nothing here
	 * belongs in a logo.
	 */
	functional: TokenMap
	/** Text guaranteed to read on a filled colour, as concrete values. */
	ink: TokenMap

	/* ── What the paint MEANS ─────────────────────────────────────────────── */

	/**
	 * EVERY SURFACE, both themes, keyed `<theme>-<rung>`.
	 *
	 * `light-page`, `dark-card`. ONE authored group: the creams were only ever
	 * the light rungs, so listing them separately was the same thing said twice.
	 *
	 * The theme-neutral names a component actually uses — `surface-page`,
	 * `surface-card` — are DERIVED from these by the generator, not authored,
	 * because they are mechanical: strip the theme prefix, emit an alias, and
	 * re-point it under `[data-theme]`. That derivation is what keeps a
	 * component from ever naming a theme, which is the thing that would make it
	 * un-themeable.
	 */
	surfaces: TokenMap
	/**
	 * What the paint MEANS. ONE group.
	 *
	 * There were three — shared, site and app — and the split did not survive
	 * measurement: six of the site's seven tokens aliased a shared role under a
	 * different name. That is a synonym list, not a vocabulary. A surface that
	 * does not use a role simply does not use it, which costs a few unused
	 * custom properties and saves a whole axis of naming.
	 */
	roles: TokenMap

	/* ── Type and geometry ────────────────────────────────────────────────── */

	/**
	 * Font stacks.
	 *
	 * `display` is separate because a brand may set headings in a different face
	 * from its body — avenYMA sets them in a garamond and its copy in a geometric
	 * sans. avenCEO uses one face for both and says so by repeating it, which is
	 * a brand decision rather than a system limit.
	 */
	fonts: { app: string; web: string; display?: string }
	/** Named weights, keyed `font-weight-*`. */
	fontWeights: TokenMap
	/** Radii emitted alongside the roles, keyed `radius-*`. */
	radii: TokenMap
	/** The scales, by name. */
	scales: BrandScales
	/** Every scale flattened into the tokens the CSS declares. */
	scaleTokens: TokenMap

	/* ── The pieces ───────────────────────────────────────────────────────── */

	/**
	 * The layout shapes almost every page is made of: stack, cluster, center…
	 *
	 * Named `layouts` rather than `primitives` because a unit is now the
	 * smallest PIECE, which is what "primitive" means everywhere else in design
	 * systems. Two meanings for one word inside one system is a naming bug.
	 */
	layouts: Record<string, Decl>
	/** Named components: the button, the panel, the eyebrow. */
	components: Record<string, Decl>

	/**
	 * Bare HTML elements that should already look right, as `selector: component`.
	 *
	 * A brand decides which of its components a `<button>` IS. The kit used to
	 * hardcode avenCEO's answer — h1 is `title`, button is `btn`, label is
	 * `label` — which meant the first brand without a component called `title`
	 * crashed the generator rather than simply not having that rule.
	 */
	elements: Record<string, string>

	/** The plate an app icon is drawn on — the one colour that must be opaque. */
	appIconPlate: string
}

/**
 * `light-page` -> `surface-page`. The theme-neutral rung names.
 *
 * Derived in one place and used in two: the generator emits them as the theme
 * seam, and the utility scanner has to know them or every `bg-surface-card` in
 * the codebase resolves to nothing and fails the build. They were emitted
 * before they were nameable, which is exactly that failure.
 */
export function surfaceRungs(surfaces: TokenMap): string[] {
	return [
		...new Set(
			Object.keys(surfaces)
				.filter((n) => /^(light|dark)-/.test(n))
				.map((n) => `surface-${n.replace(/^(light|dark)-/, '')}`)
		)
	]
}

/** Every colour name a utility may reference in this brand. */
export function colourNames(brand: Brand): Set<string> {
	/*
	 * Tolerant of a partial brand on purpose. `validateBrandDocument` is what
	 * refuses an incomplete one, and it runs at load; this runs on every class
	 * the scanner sees, so a missing group should mean fewer known names rather
	 * than a crash that reports itself as an unresolvable utility.
	 */
	const keys = (m: TokenMap | undefined) => Object.keys(m ?? {})
	return new Set([
		...surfaceRungs(brand.surfaces ?? {}),
		...keys(brand.tones),
		...keys(brand.functional),
		...keys(brand.surfaces),
		...keys(brand.roles),
		...keys(brand.ink)
	])
}

/** The class names this brand defines itself, which are never utilities. */
export function pieceNames(brand: Brand): string[] {
	return [...Object.keys(brand.layouts), ...Object.keys(brand.components)]
}

/**
 * Refuse a brand that declares the same token name twice.
 *
 * Every map here lands in one `:root`, so a role called `muted` silently
 * overwrites a tone called `muted` — and since roles are emitted last, the tone
 * loses. avenYMA hit this on its first render: `--color-muted-foreground`
 * pointed at `--color-ash`'s old name, which a surface had also claimed, and
 * every line of secondary copy on the site came out near-white on white.
 *
 * The cascade is doing exactly what it should. The brand simply must not ask.
 */
export function assertNoShadowedTokens(brand: Brand): void {
	const seen = new Map<string, string>()
	const clashes: string[] = []
	const maps: Array<[string, TokenMap]> = [
		['tones', brand.tones],
		['functional', brand.functional],
		['surfaces', brand.surfaces],
		['ink', brand.ink],
		['roles', brand.roles]
	]
	for (const [where, map] of maps)
		for (const name of Object.keys(map)) {
			const first = seen.get(name)
			/* app and site roles are alternatives, never emitted together. */
			if (first && !(first === 'appRoles' && where === 'siteRoles'))
				clashes.push(`--color-${name} is declared in both ${first} and ${where}`)
			else if (!first) seen.set(name, where)
		}
	if (clashes.length)
		throw new Error(
			`${brand.name}: a token name is declared twice, so one of them silently wins.\n  ` +
				clashes.join('\n  ')
		)
}
