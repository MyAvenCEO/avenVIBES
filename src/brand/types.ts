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
 * Not a rendering mode — the output shape is identical. It selects which extra
 * ROLES the surface gets and which font stack, because a marketing site and an
 * application genuinely mean different things by the same word: `accent` is a
 * highlight on the site and `info` is a notice in the app.
 */
export type Audience = 'app' | 'web' | 'plain'

export interface BrandScales {
	/** The type ramp. Keys are token names: `fs-body`, `fs-display-lg`. */
	type: TokenMap
	/** Letter-spacing, keyed `tracking-*`. */
	tracking: TokenMap
	/** Text emphasis levels, keyed `ink-*`. */
	ink: TokenMap
	/** Background wash levels, keyed `tint-*`. */
	tint: TokenMap
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
	/** The light ground family, lightest to warmest. */
	creams: TokenMap
	/** Text colours guaranteed to read on a filled tone. */
	contrastInk: TokenMap

	/* ── What the paint MEANS ─────────────────────────────────────────────── */

	/** Which rung each part of a page stands on. */
	surfaces: TokenMap
	/** Roles every surface shares. */
	roles: TokenMap
	/** Roles only a marketing site has. */
	siteRoles: TokenMap
	/** Roles only an application has. */
	appRoles: TokenMap

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

	/** Layout shapes almost every page is made of: stack, cluster, center… */
	primitives: Record<string, Decl>
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

/** Every colour name a utility may reference in this brand. */
export function colourNames(brand: Brand): Set<string> {
	return new Set([
		...Object.keys(brand.tones),
		...Object.keys(brand.creams),
		...Object.keys(brand.surfaces),
		...Object.keys(brand.roles),
		...Object.keys(brand.appRoles),
		...Object.keys(brand.siteRoles),
		...Object.keys(brand.contrastInk)
	])
}

/** The class names this brand defines itself, which are never utilities. */
export function pieceNames(brand: Brand): string[] {
	return [...Object.keys(brand.primitives), ...Object.keys(brand.components)]
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
		['creams', brand.creams],
		['surfaces', brand.surfaces],
		['roles', brand.roles],
		['appRoles', brand.appRoles],
		['siteRoles', brand.siteRoles]
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
