/**
 * THE UTILITY LAYER — ours, generated from our scales.
 *
 * The last thing the design system did not own. Tokens, components and layout
 * primitives all came from here; the one-off layout that fills the gaps between
 * them still came from Tailwind, which meant a third of the visual language was
 * defined by a dependency rather than by us.
 *
 * This emits CSS for exactly the classes a codebase uses — a static JIT. It is
 * deliberately NOT a general-purpose reimplementation: it covers the families
 * actually in play and REPORTS anything it does not recognise, so the failure
 * mode is a loud build error rather than a rule that silently disappears and
 * takes a layout with it.
 *
 * Values resolve to the scales wherever a scale exists, so `p-4` and
 * `--space-comfortable` are the same measurement rather than two numbers that
 * happen to match today.
 */

import type { Brand, Decl } from './types.js'

/**
 * Build this brand's utility layer.
 *
 * A FACTORY, not a module of functions, because the values a utility resolves
 * against — which colour names exist, which type steps exist — belong to a
 * brand and not to the generator. Closing over the brand keeps every rule below
 * exactly as it was written while making a second brand possible.
 */
/** What the generator produced, and what it could not resolve. */
export interface UtilityResult {
	css: string
	/** Classes the generator did not recognise — the caller should fail on these. */
	unknown: string[]
}

export function createUtilities(brand: Brand) {
	const TONES = brand.tones
	const CREAMS = brand.creams
	/* Only the scales a CLASS can name. Ink and tint are set through custom
	   properties on a component, never through a utility, so binding them here
	   would be three unused names pretending to be part of the contract. */
	const TYPE_SCALE = brand.scales.type
	const TRACKING_SCALE = brand.scales.tracking
	const RADIUS_SCALE = brand.scales.radius
	const SURFACES = brand.surfaces
	const ROLES = brand.roles
	const APP_ROLES = brand.appRoles
	const SITE_ROLES = brand.siteRoles
	const CONTRAST_INK = brand.contrastInk
	/** Tailwind's spacing rhythm, which the markup is written in: 1 unit = 0.25rem. */
	const STEP = 0.25

	/** `4` -> `1rem`, `0.5` -> `0.125rem`, `px` -> `1px`. */
	function space(value: string): string | null {
		if (value === 'px') return '1px'
		if (value === 'full') return '100%'
		if (value === 'auto') return 'auto'
		if (value === 'screen') return '100vh'
		if (value === 'min') return 'min-content'
		if (value === 'max') return 'max-content'
		if (value === 'fit') return 'fit-content'
		if (value.includes('/')) {
			const [a, b] = value.split('/').map(Number)
			if (a && b) return `${((a / b) * 100).toFixed(4).replace(/\.?0+$/, '')}%`
		}
		const n = Number(value)
		if (Number.isNaN(n)) return null
		return `${n * STEP}rem`
	}

	/** Fractions like `w-1/2`, and the odd `max-w-3xl`. */
	const NAMED_WIDTHS: Record<string, string> = {
		xs: '20rem',
		sm: '24rem',
		md: '28rem',
		lg: '32rem',
		xl: '36rem',
		'2xl': '42rem',
		'3xl': '48rem',
		'4xl': '56rem',
		'5xl': '64rem',
		'6xl': '72rem',
		'7xl': '80rem',
		prose: '65ch',
		none: 'none'
	}

	/** Every colour name a utility may reference, mapped to its token. */
	/**
	 * Every colour name a utility may reference, mapped to its token.
	 *
	 * DERIVED from the palette rather than listed. The list was written out by hand
	 * once, which meant every colour added to the brand afterwards was invisible to
	 * the utilities until someone remembered to add it here too — a second source of
	 * truth for the one thing this package exists to be the only source of.
	 */
	const KEYWORD_COLOURS: Record<string, string> = {
		transparent: 'transparent',
		current: 'currentColor',
		inherit: 'inherit',
		white: '#ffffff',
		black: '#000000'
	}

	function colourToken(name: string): string | null {
		if (KEYWORD_COLOURS[name]) return KEYWORD_COLOURS[name]
		const known = new Set([
			...Object.keys(TONES),
			...Object.keys(CREAMS),
			...Object.keys(SURFACES),
			...Object.keys(ROLES),
			...Object.keys(APP_ROLES),
			...Object.keys(SITE_ROLES),
			...Object.keys(CONTRAST_INK)
		])
		return known.has(name) ? `var(--color-${name})` : null
	}

	/**
	 * A colour with an optional opacity suffix — `text-foreground/50`.
	 *
	 * Mixed with `transparent` rather than emitting `rgb(... / 50%)`, because the
	 * tokens are `var()` references and cannot be decomposed into channels.
	 */
	function colourValue(spec: string): string | null {
		const [name, alpha] = spec.split('/')
		const token = colourToken(name)
		if (!token) return null
		if (!alpha) return token
		const pct = alpha.startsWith('[') ? alpha.slice(1, -1) : `${alpha}%`
		const numeric = pct.endsWith('%') ? pct : `${Number(pct) * 100}%`
		/*
		 * oklab, not sRGB. Mixing toward transparent in sRGB darkens and dulls the
		 * result — a 15% tint of the marine came out visibly greyer than the same
		 * class did before, on roughly forty surfaces at once. Perceptual space is
		 * what the eye expects a "15% of this colour" to mean.
		 */
		return `color-mix(in oklab, ${token} ${numeric}, transparent)`
	}

	/**
	 * Flip a length. Plain numbers get a sign; anything else goes through calc.
	 *
	 * PER COMPONENT, because a value can be a list: `translate: 50% 0` has to become
	 * `-50% 0`, and negating the string as a whole produced `calc(50% 0 * -1)` —
	 * invalid, dropped, and the centring it was doing quietly lost.
	 */
	function negate(value: string): string {
		return value.split(' ').map(negatePart).join(' ')
	}

	function negatePart(value: string): string {
		if (value === '0' || value === '0px') return value
		if (value.startsWith('-')) return value.slice(1)
		if (/^[\d.]+(px|rem|em|%|vh|vw|dvh|dvw|ch|ex|deg|turn|rad)?$/.test(value)) return `-${value}`
		return `calc(${value} * -1)`
	}

	/** Arbitrary values: `w-[420px]`, `text-[length:var(--fs-body)]`. */
	function arbitrary(raw: string): string | null {
		if (!raw.startsWith('[') || !raw.endsWith(']')) return null
		let value = raw.slice(1, -1)
		// `text-[length:var(--x)]` — the hint tells Tailwind which property; we know.
		const hint = value.match(/^(length|color|number|percentage):/)
		if (hint) value = value.slice(hint[0].length)
		return value.replace(/_/g, ' ')
	}

	/** Static utilities: a name maps straight to declarations. */
	const STATIC: Record<string, Decl> = {
		flex: { display: 'flex' },
		grid: { display: 'grid' },
		block: { display: 'block' },
		'inline-block': { display: 'inline-block' },
		'inline-flex': { display: 'inline-flex' },
		inline: { display: 'inline' },
		contents: { display: 'contents' },
		hidden: { display: 'none' },
		table: { display: 'table' },

		'flex-col': { 'flex-direction': 'column' },
		'flex-row': { 'flex-direction': 'row' },
		'flex-wrap': { 'flex-wrap': 'wrap' },
		'flex-nowrap': { 'flex-wrap': 'nowrap' },
		'flex-1': { flex: '1 1 0%' },
		'flex-auto': { flex: '1 1 auto' },
		'flex-none': { flex: 'none' },
		'shrink-0': { 'flex-shrink': '0' },
		'grow-0': { 'flex-grow': '0' },
		grow: { 'flex-grow': '1' },

		'items-center': { 'align-items': 'center' },
		'items-start': { 'align-items': 'flex-start' },
		'items-end': { 'align-items': 'flex-end' },
		'items-baseline': { 'align-items': 'baseline' },
		'items-stretch': { 'align-items': 'stretch' },
		'justify-center': { 'justify-content': 'center' },
		'justify-between': { 'justify-content': 'space-between' },
		'justify-start': { 'justify-content': 'flex-start' },
		'justify-end': { 'justify-content': 'flex-end' },
		'justify-around': { 'justify-content': 'space-around' },
		'self-start': { 'align-self': 'flex-start' },
		'self-center': { 'align-self': 'center' },
		'self-end': { 'align-self': 'flex-end' },
		'place-items-center': { 'place-items': 'center' },
		'content-center': { 'align-content': 'center' },

		relative: { position: 'relative' },
		absolute: { position: 'absolute' },
		fixed: { position: 'fixed' },
		sticky: { position: 'sticky' },
		static: { position: 'static' },

		'text-left': { 'text-align': 'left' },
		'text-center': { 'text-align': 'center' },
		'text-right': { 'text-align': 'right' },
		uppercase: { 'text-transform': 'uppercase' },
		lowercase: { 'text-transform': 'lowercase' },
		capitalize: { 'text-transform': 'capitalize' },
		italic: { 'font-style': 'italic' },
		'not-italic': { 'font-style': 'normal' },
		underline: { 'text-decoration-line': 'underline' },
		'no-underline': { 'text-decoration-line': 'none' },
		truncate: { overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' },
		'whitespace-nowrap': { 'white-space': 'nowrap' },
		'whitespace-pre-wrap': { 'white-space': 'pre-wrap' },
		'break-words': { 'overflow-wrap': 'break-word' },
		'break-all': { 'word-break': 'break-all' },
		'text-pretty': { 'text-wrap': 'pretty' },
		'text-balance': { 'text-wrap': 'balance' },
		'tabular-nums': { 'font-variant-numeric': 'tabular-nums' },
		antialiased: {
			'-webkit-font-smoothing': 'antialiased',
			'-moz-osx-font-smoothing': 'grayscale'
		},

		'font-sans': { 'font-family': 'var(--font-sans)' },
		'font-mono': { 'font-family': 'var(--font-mono)' },
		'font-display': { 'font-family': 'var(--font-display)' },

		border: { 'border-width': '1px', 'border-style': 'solid' },
		'border-0': { 'border-width': '0' },
		'border-t': { 'border-top-width': '1px', 'border-top-style': 'solid' },
		'border-b': { 'border-bottom-width': '1px', 'border-bottom-style': 'solid' },
		'border-l': { 'border-left-width': '1px', 'border-left-style': 'solid' },
		'border-r': { 'border-right-width': '1px', 'border-right-style': 'solid' },
		'border-dashed': { 'border-style': 'dashed' },
		'border-solid': { 'border-style': 'solid' },

		'overflow-hidden': { overflow: 'hidden' },
		'overflow-auto': { overflow: 'auto' },
		'overflow-y-auto': { 'overflow-y': 'auto' },
		'overflow-x-auto': { 'overflow-x': 'auto' },
		'overflow-y-hidden': { 'overflow-y': 'hidden' },
		'overflow-x-hidden': { 'overflow-x': 'hidden' },

		'cursor-pointer': { cursor: 'pointer' },
		'cursor-default': { cursor: 'default' },
		'cursor-not-allowed': { cursor: 'not-allowed' },
		'pointer-events-none': { 'pointer-events': 'none' },
		'pointer-events-auto': { 'pointer-events': 'auto' },
		'select-none': { 'user-select': 'none' },
		'select-all': { 'user-select': 'all' },
		'appearance-none': { appearance: 'none' },
		'sr-only': {
			position: 'absolute',
			width: '1px',
			height: '1px',
			padding: '0',
			margin: '-1px',
			overflow: 'hidden',
			clip: 'rect(0, 0, 0, 0)',
			'white-space': 'nowrap',
			'border-width': '0'
		},

		'self-stretch': { 'align-self': 'stretch' },
		'order-first': { order: '-9999' },
		'order-last': { order: '9999' },
		'order-none': { order: '0' },
		'scroll-smooth': { 'scroll-behavior': 'smooth' },
		'scroll-auto': { 'scroll-behavior': 'auto' },
		'cursor-help': { cursor: 'help' },
		'cursor-crosshair': { cursor: 'crosshair' },
		'cursor-text': { cursor: 'text' },
		'line-through': { 'text-decoration-line': 'line-through' },
		'decoration-dashed': { 'text-decoration-style': 'dashed' },
		'normal-case': { 'text-transform': 'none' },
		'list-none': { 'list-style-type': 'none' },
		'outline-none': { outline: '2px solid transparent', 'outline-offset': '2px' },
		'overflow-visible': { overflow: 'visible' },
		'resize-none': { resize: 'none' },
		'whitespace-pre-line': { 'white-space': 'pre-line' },
		'whitespace-normal': { 'white-space': 'normal' },
		'field-sizing-content': { 'field-sizing': 'content' },
		/* The gap between an element and its ring. The offset COLOUR must match
		   whatever the element sits on, so it is a variable a sibling class sets. */
		'ring-offset-0': { '--ring-offset-width': '0px' },
		'ring-offset-1': { '--ring-offset-width': '1px' },
		'ring-offset-2': { '--ring-offset-width': '2px' },
		'ring-offset-4': { '--ring-offset-width': '4px' },
		'divide-y': { '& > * + *': { 'border-block-start-width': '1px' } },
		'divide-x': { '& > * + *': { 'border-inline-start-width': '1px' } },
		'inset-x-0': { 'inset-inline': '0' },
		'inset-y-0': { 'inset-block': '0' },
		'h-dvh': { 'block-size': '100dvh' },
		'min-h-dvh': { 'min-block-size': '100dvh' },
		'animate-spin': { animation: 'aven-spin 1s linear infinite' },
		'animate-ping': { animation: 'aven-ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' },
		'animate-pulse': { animation: 'aven-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
		'animate-bounce': { animation: 'aven-bounce 1s infinite' },
		/* The marker for `group-hover:`. It styles nothing on its own. */
		group: {},
		'object-cover': { 'object-fit': 'cover' },
		'object-contain': { 'object-fit': 'contain' },
		'mx-auto': { 'margin-inline': 'auto' },
		'my-auto': { 'margin-block': 'auto' },
		'inset-0': { inset: '0' },
		transition: {
			'transition-property':
				'color, background-color, border-color, opacity, box-shadow, transform',
			'transition-duration': '150ms',
			'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)'
		},
		'transition-colors': {
			'transition-property': 'color, background-color, border-color',
			'transition-duration': '150ms'
		},
		'transition-all': { 'transition-property': 'all', 'transition-duration': '150ms' },
		'transition-opacity': { 'transition-property': 'opacity', 'transition-duration': '150ms' },
		'transition-transform': { 'transition-property': 'transform', 'transition-duration': '150ms' }
	}

	const FONT_WEIGHT: Record<string, string> = {
		thin: '100',
		light: '300',
		normal: '400',
		medium: '500',
		semibold: '600',
		bold: '700',
		extrabold: '800'
	}

	/** Sides a spacing utility may address. */
	const SIDES: Record<string, string[]> = {
		p: ['padding'],
		px: ['padding-inline'],
		py: ['padding-block'],
		pt: ['padding-top'],
		pb: ['padding-bottom'],
		pl: ['padding-left'],
		pr: ['padding-right'],
		m: ['margin'],
		mx: ['margin-inline'],
		my: ['margin-block'],
		mt: ['margin-top'],
		mb: ['margin-bottom'],
		ml: ['margin-left'],
		mr: ['margin-right'],
		gap: ['gap'],
		'gap-x': ['column-gap'],
		'gap-y': ['row-gap'],
		top: ['top'],
		bottom: ['bottom'],
		left: ['left'],
		right: ['right'],
		inset: ['inset'],
		'scroll-mt': ['scroll-margin-block-start'],
		'scroll-mb': ['scroll-margin-block-end'],
		'scroll-ml': ['scroll-margin-inline-start'],
		'scroll-mr': ['scroll-margin-inline-end'],
		'scroll-mx': ['scroll-margin-inline'],
		'scroll-my': ['scroll-margin-block'],
		'scroll-m': ['scroll-margin']
	}

	/** `bg-gradient-to-br` — the suffix each direction maps to. */
	const GRADIENT_DIRECTION: Record<string, string> = {
		t: 'to top',
		tr: 'to top right',
		r: 'to right',
		br: 'to bottom right',
		b: 'to bottom',
		bl: 'to bottom left',
		l: 'to left',
		tl: 'to top left'
	}

	/** Blur radii, shared by `blur-*` and `backdrop-blur-*`. */
	const BLUR: Record<string, string> = {
		'': '8px',
		none: '0',
		xs: '4px',
		sm: '8px',
		md: '12px',
		lg: '16px',
		xl: '24px',
		'2xl': '40px',
		'3xl': '64px'
	}

	/**
	 * Keyframes for the `animate-*` utilities.
	 *
	 * Emitted only when a matching class is actually used, so an app that never
	 * spins something never ships the definition.
	 */
	const KEYFRAMES: Record<string, string> = {
		'aven-spin': '@keyframes aven-spin {\n\tto { rotate: 360deg; }\n}',
		'aven-pulse': '@keyframes aven-pulse {\n\t50% { opacity: 0.5; }\n}',
		'aven-ping': '@keyframes aven-ping {\n\t75%, 100% { scale: 2; opacity: 0; }\n}',
		'aven-bounce':
			'@keyframes aven-bounce {\n\t0%, 100% { translate: 0 -25%; animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }\n\t50% { translate: 0 0; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }\n}'
	}

	/**
	 * Turn one class into declarations, or null if we do not know it.
	 *
	 * Returning null rather than guessing is the safety property: the caller
	 * collects the nulls and fails the build, so an unrecognised class can never
	 * become a silently missing style.
	 */
	function declarationsFor(name: string): Decl | null {
		if (STATIC[name]) return STATIC[name]

		/*
		 * `[animation-delay:150ms]` — an arbitrary PROPERTY, not an arbitrary value.
		 * The whole declaration is written in the class, for the one-off that no
		 * utility family will ever be worth defining.
		 */
		if (name.startsWith('[') && name.endsWith(']') && name.includes(':')) {
			const body = name.slice(1, -1).replace(/_/g, ' ')
			const at = body.indexOf(':')
			return { [body.slice(0, at)]: body.slice(at + 1) }
		}

		/*
		 * `!text-[1.7rem]` — the escape hatch, kept because it is occasionally the
		 * honest answer when a component class and a utility genuinely disagree.
		 */
		if (name.startsWith('!')) {
			const base = declarationsFor(name.slice(1))
			if (!base) return null
			return Object.fromEntries(
				Object.entries(base).map(([property, value]) => [
					property,
					typeof value === 'string' ? `${value} !important` : value
				])
			)
		}

		/*
		 * `-left-[13px]`, `-translate-x-1/2`.
		 *
		 * Resolved as the positive class and then negated, so a negative utility can
		 * never drift from its positive twin — and so adding a family gets its
		 * negative form for free rather than as a second thing to remember.
		 */
		if (name.startsWith('-')) {
			const positive = declarationsFor(name.slice(1))
			if (!positive) return null
			return Object.fromEntries(
				Object.entries(positive).map(([property, value]) => [
					property,
					typeof value === 'string' ? negate(value) : value
				])
			)
		}

		// Longest-prefix match so `gap-x-2` beats `gap`.
		for (const prefix of Object.keys(SIDES).sort((a, b) => b.length - a.length)) {
			if (!name.startsWith(`${prefix}-`)) continue
			const raw = name.slice(prefix.length + 1)
			const value = arbitrary(raw) ?? space(raw)
			if (value === null) continue
			return Object.fromEntries(SIDES[prefix].map((p) => [p, value]))
		}

		const [head, ...restParts] = name.split('-')
		const rest = restParts.join('-')

		switch (head) {
			case 'text': {
				const arb = arbitrary(rest)
				if (arb)
					return /^\d|rem|px|em|%|var\(--fs/.test(arb) ? { 'font-size': arb } : { color: arb }
				if (rest in TYPE_SCALE) return { 'font-size': `var(--${rest})` }
				/*
				 * Each step carries its LINE HEIGHT as well as its size.
				 *
				 * Dropping the pairing looks harmless and is not: line-height then falls
				 * to whatever the surface inherits, and every `text-xs` label in the app
				 * grows from 16px of leading to 18px. Multiplied across a dense UI that
				 * is a different design.
				 */
				const named: Record<string, [string, string]> = {
					xs: ['0.75rem', 'calc(1 / 0.75)'],
					sm: ['0.875rem', 'calc(1.25 / 0.875)'],
					base: ['1rem', 'calc(1.5 / 1)'],
					lg: ['1.125rem', 'calc(1.75 / 1.125)'],
					xl: ['1.25rem', 'calc(1.75 / 1.25)'],
					'2xl': ['1.5rem', 'calc(2 / 1.5)'],
					'3xl': ['1.875rem', 'calc(2.25 / 1.875)'],
					'4xl': ['2.25rem', 'calc(2.5 / 2.25)'],
					'5xl': ['3rem', '1'],
					'6xl': ['3.75rem', '1'],
					'7xl': ['4.5rem', '1'],
					'8xl': ['6rem', '1'],
					'9xl': ['8rem', '1']
				}
				if (named[rest]) return { 'font-size': named[rest][0], 'line-height': named[rest][1] }
				const colour = colourValue(rest)
				return colour ? { color: colour } : null
			}
			case 'bg': {
				// `bg-gradient-to-br` / `bg-linear-to-b` — the direction, not a colour.
				if (restParts[0] === 'gradient' || restParts[0] === 'linear') {
					const direction = GRADIENT_DIRECTION[restParts[2] ?? '']
					if (restParts[1] === 'to' && direction)
						return {
							'background-image': `linear-gradient(${direction} in oklab, var(--gradient-stops, var(--gradient-from, transparent), var(--gradient-to, transparent)))`
						}
					return null
				}
				const arb = arbitrary(rest)
				if (arb) return { background: arb }
				const colour = colourValue(rest)
				return colour ? { 'background-color': colour } : null
			}
			/*
			 * Gradient stops.
			 *
			 * `--gradient-stops` stays UNDEFINED unless a `via-` class sets it, so the
			 * two-stop fallback in the direction class is what runs. Defaulting it to a
			 * three-stop list instead would put `from` at both 0% and 50% and quietly
			 * bend every two-stop ramp in the codebase.
			 */
			case 'from': {
				const colour = arbitrary(rest) ?? colourValue(rest)
				return colour ? { '--gradient-from': colour } : null
			}
			case 'to': {
				const colour = arbitrary(rest) ?? colourValue(rest)
				return colour ? { '--gradient-to': colour } : null
			}
			case 'via': {
				const colour = arbitrary(rest) ?? colourValue(rest)
				return colour
					? {
							'--gradient-via': colour,
							'--gradient-stops':
								'var(--gradient-from, transparent), var(--gradient-via), var(--gradient-to, transparent)'
						}
					: null
			}
			case 'blur': {
				const value = arbitrary(rest) ?? BLUR[rest]
				return value ? { filter: `blur(${value})` } : null
			}
			case 'backdrop': {
				if (restParts[0] !== 'blur') return null
				const raw = restParts.slice(1).join('-')
				const value = arbitrary(raw) ?? BLUR[raw]
				return value
					? { 'backdrop-filter': `blur(${value})`, '-webkit-backdrop-filter': `blur(${value})` }
					: null
			}
			case 'decoration': {
				if (/^\d+$/.test(rest)) return { 'text-decoration-thickness': `${rest}px` }
				const colour = arbitrary(rest) ?? colourValue(rest)
				return colour ? { 'text-decoration-color': colour } : null
			}
			case 'underline': {
				if (restParts[0] !== 'offset') return null
				const raw = restParts.slice(1).join('-')
				const value =
					arbitrary(raw) ?? (/^\d+$/.test(raw) ? `${raw}px` : raw === 'auto' ? 'auto' : null)
				return value ? { 'text-underline-offset': value } : null
			}
			case 'divide': {
				// The owl selector — a border between siblings, never around the edge.
				const colour = arbitrary(rest) ?? colourValue(rest)
				if (colour) return { '& > * + *': { 'border-color': colour } }
				return null
			}
			case 'rotate': {
				const value = arbitrary(rest) ?? (/^-?\d+$/.test(rest) ? `${rest}deg` : null)
				return value ? { rotate: value } : null
			}
			case 'translate': {
				const axis = restParts[0]
				const raw = restParts.slice(1).join('-')
				const value = arbitrary(raw) ?? space(raw)
				if (!value) return null
				if (axis === 'x') return { translate: `${value} 0` }
				if (axis === 'y') return { translate: `0 ${value}` }
				return null
			}
			case 'scale': {
				const value = arbitrary(rest) ?? (/^\d+$/.test(rest) ? String(Number(rest) / 100) : null)
				return value ? { scale: value } : null
			}
			case 'border': {
				// `border-t-primary` — a side AND a colour, which neither branch alone covers.
				const sideColour: Record<string, string> = {
					t: 'border-block-start-color',
					b: 'border-block-end-color',
					l: 'border-inline-start-color',
					r: 'border-inline-end-color',
					x: 'border-inline-color',
					y: 'border-block-color'
				}
				if (restParts.length > 1 && sideColour[restParts[0]]) {
					const raw = restParts.slice(1).join('-')
					/*
					 * A side takes a WIDTH or a COLOUR, and telling them apart matters:
					 * reading `border-l-[4px]` as a colour set `border-inline-start-color:
					 * 4px`, which is invalid, so the declaration was dropped and the 4px
					 * accent down the side of every intent card simply stopped existing.
					 */
					const width = arbitrary(raw) ?? (/^\d+$/.test(raw) ? `${raw}px` : null)
					if (width && /^[\d.]/.test(width))
						return {
							[sideColour[restParts[0]].replace('-color', '-width')]: width,
							[sideColour[restParts[0]].replace('-color', '-style')]: 'solid'
						}
					const colour = arbitrary(raw) ?? colourValue(raw)
					if (colour) return { [sideColour[restParts[0]]]: colour }
				}
				const arb = arbitrary(rest)
				if (arb) return { 'border-color': arb }
				if (/^\d+$/.test(rest)) return { 'border-width': `${rest}px`, 'border-style': 'solid' }
				const colour = colourValue(rest)
				return colour ? { 'border-color': colour } : null
			}
			case 'ring': {
				if (restParts[0] === 'offset') {
					const colour = colourValue(restParts.slice(1).join('-'))
					return colour ? { '--ring-offset-color': colour } : null
				}
				const colour = colourValue(rest)
				if (colour) return { '--ring-color': colour }
				const width = arbitrary(rest) ?? (/^\d+$/.test(rest) ? `${rest}px` : null)
				return width
					? {
							'box-shadow':
								'0 0 0 var(--ring-offset-width, 0px) var(--ring-offset-color, var(--color-background)), ' +
								`0 0 0 calc(${width} + var(--ring-offset-width, 0px)) var(--ring-color, currentColor)`
						}
					: null
			}
			case 'rounded': {
				if (rest === '') return { 'border-radius': '0.25rem' }
				const arb = arbitrary(rest)
				if (arb) return { 'border-radius': arb }
				if (`radius-${rest}` in RADIUS_SCALE) return { 'border-radius': `var(--radius-${rest})` }
				const named: Record<string, string> = {
					none: '0',
					xs: '0.125rem',
					sm: '0.25rem',
					md: '0.375rem',
					lg: 'var(--radius-lg)',
					xl: 'var(--radius-xl)',
					'2xl': 'var(--radius-2xl)',
					'3xl': '1.5rem',
					full: '9999px'
				}
				return named[rest] ? { 'border-radius': named[rest] } : null
			}
			case 'font':
				return FONT_WEIGHT[rest] ? { 'font-weight': FONT_WEIGHT[rest] } : null
			case 'leading': {
				const arb = arbitrary(rest)
				if (arb) return { 'line-height': arb }
				const named: Record<string, string> = {
					none: '1',
					tight: '1.25',
					snug: '1.375',
					normal: '1.5',
					relaxed: '1.625',
					loose: '2'
				}
				if (named[rest]) return { 'line-height': named[rest] }
				return /^\d+$/.test(rest) ? { 'line-height': `${Number(rest) * STEP}rem` } : null
			}
			case 'tracking': {
				const arb = arbitrary(rest)
				if (arb) return { 'letter-spacing': arb }
				return `tracking-${rest}` in TRACKING_SCALE
					? { 'letter-spacing': `var(--tracking-${rest})` }
					: null
			}
			case 'shadow': {
				const arb = arbitrary(rest)
				if (arb) return { 'box-shadow': arb }
				if (rest === 'none') return { 'box-shadow': 'none' }
				const named: Record<string, string> = {
					'': 'var(--shadow-raised)',
					sm: 'var(--shadow-raised)',
					md: 'var(--shadow-floating)',
					lg: 'var(--shadow-floating)',
					xl: 'var(--shadow-overlay)',
					'2xl': 'var(--shadow-overlay)',
					raised: 'var(--shadow-raised)',
					floating: 'var(--shadow-floating)',
					overlay: 'var(--shadow-overlay)'
				}
				if (named[rest] !== undefined) return { 'box-shadow': named[rest] }
				// `shadow-primary/10` tints the shadow the size class already declared.
				const colour = colourValue(rest)
				return colour ? { '--shadow-color': colour } : null
			}
			case 'opacity': {
				const arb = arbitrary(rest)
				if (arb) return { opacity: arb }
				return /^\d+$/.test(rest) ? { opacity: String(Number(rest) / 100) } : null
			}
			case 'z': {
				const arb = arbitrary(rest)
				if (arb) return { 'z-index': arb }
				return /^\d+$/.test(rest) || rest === 'auto' ? { 'z-index': rest } : null
			}
			case 'w':
			case 'h':
			case 'size':
			case 'basis': {
				const prop =
					head === 'w'
						? ['inline-size']
						: head === 'h'
							? ['block-size']
							: head === 'size'
								? ['inline-size', 'block-size']
								: ['flex-basis']
				const arb = arbitrary(rest)
				if (arb) return Object.fromEntries(prop.map((p) => [p, arb]))
				if (rest.includes('/')) {
					const [a, b] = rest.split('/').map(Number)
					if (a && b)
						return Object.fromEntries(prop.map((p) => [p, `${((a / b) * 100).toFixed(4)}%`]))
				}
				if (rest === 'screen')
					return Object.fromEntries(prop.map((p) => [p, head === 'h' ? '100vh' : '100vw']))
				if (NAMED_WIDTHS[rest]) return Object.fromEntries(prop.map((p) => [p, NAMED_WIDTHS[rest]]))
				const value = space(rest)
				return value ? Object.fromEntries(prop.map((p) => [p, value])) : null
			}
			case 'min':
			case 'max': {
				const [axis, ...v] = restParts
				const raw = v.join('-')
				if (!raw) return null
				const prop = `${head}-${axis === 'w' ? 'inline' : 'block'}-size`
				const arb = arbitrary(raw)
				if (arb) return { [prop]: arb }
				if (NAMED_WIDTHS[raw]) return { [prop]: NAMED_WIDTHS[raw] }
				if (raw === 'screen') return { [prop]: axis === 'w' ? '100vw' : '100vh' }
				const value = space(raw)
				return value ? { [prop]: value } : null
			}
			case 'aspect': {
				const arb = arbitrary(rest)
				if (arb) return { 'aspect-ratio': arb }
				const named: Record<string, string> = { square: '1 / 1', video: '16 / 9', auto: 'auto' }
				return named[rest] ? { 'aspect-ratio': named[rest] } : null
			}
			case 'grid': {
				// grid-cols-3 / grid-cols-[...]
				if (restParts[0] === 'cols') {
					const raw = restParts.slice(1).join('-')
					const arb = arbitrary(raw)
					if (arb) return { 'grid-template-columns': arb }
					return /^\d+$/.test(raw)
						? { 'grid-template-columns': `repeat(${raw}, minmax(0, 1fr))` }
						: null
				}
				return null
			}
			case 'col': {
				if (restParts[0] === 'span') {
					const n = restParts[1]
					return /^\d+$/.test(n) ? { 'grid-column': `span ${n} / span ${n}` } : null
				}
				return null
			}
			case 'transition': {
				const arb = arbitrary(rest)
				return arb ? { 'transition-property': arb, 'transition-duration': '150ms' } : null
			}
			case 'duration':
				return /^\d+$/.test(rest) ? { 'transition-duration': `${rest}ms` } : null
			case 'space': {
				// space-y-2 / space-x-2 — the classic owl selector
				const axis = restParts[0]
				const value = arbitrary(restParts.slice(1).join('-')) ?? space(restParts.slice(1).join('-'))
				if (!value || (axis !== 'x' && axis !== 'y')) return null
				/*
				 * On the CHILDREN. Written flat, `space-y-3` put the margin on the
				 * container itself — pushing the whole block down and leaving its
				 * children touching, which is both halves of the intent wrong.
				 */
				return {
					'& > * + *': { [axis === 'y' ? 'margin-block-start' : 'margin-inline-start']: value }
				}
			}
			default:
				return null
		}
	}

	/** `hover:`, `sm:`, `disabled:` … how each variant wraps a rule. */
	const VARIANTS: Record<string, { kind: 'selector' | 'media'; value: string }> = {
		hover: { kind: 'selector', value: '&:hover' },
		focus: { kind: 'selector', value: '&:focus' },
		'focus-visible': { kind: 'selector', value: '&:focus-visible' },
		disabled: { kind: 'selector', value: '&:disabled' },
		first: { kind: 'selector', value: '&:first-child' },
		last: { kind: 'selector', value: '&:last-child' },
		placeholder: { kind: 'selector', value: '&::placeholder' },
		/*
		 * Ancestor variants. Native nesting allows `&` anywhere in the selector, not
		 * only at the front, so a parent-driven rule needs no separate mechanism.
		 */
		'group-hover': { kind: 'selector', value: '.group:hover &' },
		'group-focus': { kind: 'selector', value: '.group:focus &' },
		'group-focus-within': { kind: 'selector', value: '.group:focus-within &' },
		dark: { kind: 'media', value: '(prefers-color-scheme: dark)' },
		sm: { kind: 'media', value: '(width >= 40rem)' },
		md: { kind: 'media', value: '(width >= 48rem)' },
		lg: { kind: 'media', value: '(width >= 64rem)' },
		xl: { kind: 'media', value: '(width >= 80rem)' },
		'2xl': { kind: 'media', value: '(width >= 96rem)' }
	}

	/** Serialise declarations, descending into nested selector blocks. */
	function body(decls: Decl, indent = '\t'): string {
		return Object.entries(decls)
			.map(([key, value]) =>
				typeof value === 'string'
					? `${indent}${key}: ${value};`
					: `${indent}${key} {\n${body(value, `${indent}\t`)}\n${indent}}`
			)
			.join('\n')
	}

	/**
	 * What a variant wraps a rule in, including the arbitrary form.
	 *
	 * `[&>*]:pointer-events-auto` writes its own selector, which is the only way to
	 * reach children from a class on the parent — a floating dock that must not
	 * catch clicks except on the cards inside it, for instance.
	 */
	function variantFor(name: string): { kind: 'selector' | 'media'; value: string } | null {
		if (VARIANTS[name]) return VARIANTS[name]
		if (name.startsWith('[') && name.endsWith(']')) {
			const selector = name.slice(1, -1).replace(/_/g, ' ')
			return selector.startsWith('@')
				? { kind: 'media', value: selector.replace(/^@media\s*/, '') }
				: { kind: 'selector', value: selector }
		}
		return null
	}

	/** CSS needs the colon and brackets escaped in a class selector. */
	function escapeSelector(name: string): string {
		return name.replace(/([.:/[\]()#%,!])/g, '\\$1')
	}

	/**
	 * Split `sm:hover:text-[length:var(--fs-body)]` on its VARIANT colons only.
	 *
	 * A plain `split(':')` also cuts the colon inside an arbitrary value, which
	 * turns a valid class into a nonsense base plus a nonsense variant and reports
	 * it as unknown. That is how ten live `text-[length:…]` classes — the ones that
	 * carry the type scale — ended up in the unknown list.
	 */
	function splitVariants(name: string): string[] {
		const parts: string[] = []
		let depth = 0
		let start = 0
		for (let i = 0; i < name.length; i++) {
			const c = name[i]
			if (c === '[' || c === '(') depth++
			else if (c === ']' || c === ')') depth--
			else if (c === ':' && depth === 0) {
				/*
				 * Depth already tells the two bracket forms apart: in
				 * `[animation-delay:150ms]` the colon sits INSIDE the brackets and never
				 * splits, while in `[&>*]:pointer-events-auto` it comes after them and
				 * does. No extra rule needed — and the one added here first refused to
				 * split any class that began with a bracket, which quietly killed the
				 * arbitrary-variant form entirely.
				 */
				parts.push(name.slice(start, i))
				start = i + 1
			}
		}
		parts.push(name.slice(start))
		return parts
	}

	/**
	 * The declarations a class carries, plus any variant it is wrapped in.
	 *
	 * `@apply` needs this: `hover:bg-white/20` inside a rule is a NESTED block, not
	 * a flat declaration, and treating it as flat is how the app's one variant
	 * `@apply` failed the first build after the swap.
	 */
	function appliedDecl(name: string): Decl | null {
		const segments = splitVariants(name)
		const base = segments.pop() as string
		const decls = declarationsFor(base)
		if (!decls || segments.some((v) => !variantFor(v))) return null
		let out = decls
		for (const v of segments) {
			const variant = variantFor(v)
			if (!variant) return null
			out =
				variant.kind === 'selector'
					? { [variant.value]: out }
					: { [`@media ${variant.value}`]: out }
		}
		return out
	}

	/**
	 * Emit CSS for exactly the classes given.
	 *
	 * `known` lets the caller declare classes that are handled elsewhere — component
	 * and primitive names, and a surface's own local classes — so they are not
	 * reported as unknown.
	 */
	function utilityCss(classes: Iterable<string>, known: Iterable<string> = []): UtilityResult {
		const handled = new Set(known)
		const rules: string[] = []
		const media = new Map<string, string[]>()
		const keyframes = new Set<string>()
		const unknown: string[] = []

		for (const raw of new Set(classes)) {
			if (handled.has(raw)) continue

			const segments = splitVariants(raw)
			const base = segments.pop() as string
			const decls = declarationsFor(base)
			if (!decls) {
				unknown.push(raw)
				continue
			}
			if (segments.some((v) => !variantFor(v))) {
				unknown.push(raw)
				continue
			}
			// A marker class such as `group` carries no declarations; it still counts
			// as recognised, so it must not fall through to the unknown list.
			if (Object.keys(decls).length === 0) continue

			for (const value of Object.values(decls))
				if (typeof value === 'string')
					for (const [name, frames] of Object.entries(KEYFRAMES))
						if (value.includes(name)) keyframes.add(frames)

			/*
			 * Selector variants NEST, they do not replace each other. Building the rule
			 * from the innermost declarations outwards is what makes `hover:focus:x`
			 * mean both conditions rather than only the last one written.
			 */
			let inner = body(decls, '\t')
			for (const v of segments.filter((s) => variantFor(s)?.kind === 'selector')) {
				inner = `\t${variantFor(v)?.value} {\n${inner
					.split('\n')
					.map((l) => `\t${l}`)
					.join('\n')}\n\t}`
			}
			const rule = `.${escapeSelector(raw)} {\n${inner}\n}`

			const mediaVariants = segments.filter((v) => variantFor(v)?.kind === 'media')
			if (mediaVariants.length === 0) {
				rules.push(rule)
				continue
			}
			// Nested media wrap, narrowest first — the order they were written.
			const query = mediaVariants.map((v) => variantFor(v)?.value).join(' and ')
			const bucket = media.get(query) ?? []
			bucket.push(rule)
			media.set(query, bucket)
		}

		const mediaBlocks = [...media.entries()].map(
			([query, body]) =>
				`@media ${query} {\n${body
					.map((r) =>
						r
							.split('\n')
							.map((l) => `\t${l}`)
							.join('\n')
					)
					.join('\n\n')}\n}`
		)

		return {
			css: [
				'@layer utilities {',
				...rules.map((r) =>
					r
						.split('\n')
						.map((l) => `\t${l}`)
						.join('\n')
				),
				...mediaBlocks.map((b) =>
					b
						.split('\n')
						.map((l) => `\t${l}`)
						.join('\n')
				),
				'}',
				...keyframes,
				''
			].join('\n'),
			unknown: unknown.sort()
		}
	}

	/**
	 * The reset.
	 *
	 * Tailwind's preflight was load-bearing — box-sizing, zeroed margins, list
	 * styles, inherited form typography — and dropping it without a replacement
	 * moves every heading, list and button on every surface. This is that job,
	 * written out, so removing the dependency is a change of ownership rather than
	 * a change of appearance.
	 */
	function resetCss(): string {
		return `@layer reset {
		*,
		*::before,
		*::after {
			box-sizing: border-box;
			border-width: 0;
			border-style: solid;
			/*
			 * currentColor, NOT the brand's border token.
			 *
			 * Tempting to default this to the brand's border token, and wrong: a bare
			 * "border" with no colour beside it has always meant a border in the text
			 * colour,
			 * and quietly redefining it repaints every such element two shades fainter
			 * across three surfaces. The default is inherited behaviour, not a design
			 * decision to revisit.
			 */
			border-color: currentColor;
		}

		html {
			-webkit-text-size-adjust: 100%;
			-moz-tab-size: 4;
			tab-size: 4;
			line-height: 1.5;
			/*
			 * The document's typeface belongs to the reset.
			 *
			 * Without it, anything the surface's own body rule does not cover falls
			 * back to the browser's serif — an iframe, a portal, a print stylesheet,
			 * or simply a surface that forgot. Preflight set this and its absence was
			 * invisible only because every current surface happens to set body itself.
			 */
			font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system, sans-serif);
		}

		body {
			margin: 0;
			line-height: inherit;
		}

		h1, h2, h3, h4, h5, h6 {
			font-size: inherit;
			font-weight: inherit;
			margin: 0;
		}

		p, figure, blockquote, dl, dd, pre {
			margin: 0;
		}

		ol, ul, menu {
			list-style: none;
			margin: 0;
			padding: 0;
		}

		a {
			color: inherit;
			text-decoration: inherit;
		}

		b, strong { font-weight: bolder; }

		code, kbd, samp, pre {
			font-family: var(--font-mono, ui-monospace, monospace);
			font-size: 1em;
		}

		small { font-size: 80%; }

		/* Form controls inherit type rather than falling back to the UA's. */
		button, input, optgroup, select, textarea {
			font: inherit;
			color: inherit;
			margin: 0;
			padding: 0;
		}

		button, [type='button'], [type='submit'], [type='reset'] {
			-webkit-appearance: button;
			background-color: transparent;
			background-image: none;
		}

		button, [role='button'] { cursor: pointer; }
		:disabled { cursor: default; }

		table {
			border-collapse: collapse;
			border-color: inherit;
			text-indent: 0;
		}

		img, svg, video, canvas, audio, iframe, embed, object {
			display: block;
			vertical-align: middle;
		}

		img, video {
			max-width: 100%;
			height: auto;
		}

		textarea { resize: vertical; }

		::placeholder {
			opacity: 1;
			color: color-mix(in srgb, var(--color-foreground, currentColor) 40%, transparent);
		}

		[hidden] { display: none; }
	}
	`
	}

	return { declarationsFor, appliedDecl, utilityCss, resetCss }
}

/** What `createUtilities` hands back. */
export type Utilities = ReturnType<typeof createUtilities>
