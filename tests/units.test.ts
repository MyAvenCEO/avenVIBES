/**
 * What a unit may declare, and what happens when it declares something else.
 *
 * Most of these are about SILENCE. A compiler that ignores a key it does not
 * know produces CSS that looks complete and is missing half of every unit, and
 * nothing in the toolchain can tell "key I do not recognise" from "key that
 * does not exist" — so the check has to be explicit.
 */
import { describe, expect, test } from 'bun:test'
import { checkStateContract, compileUnitStyling } from '../src/states.js'

describe('what a unit may declare', () => {
	test('an unknown styling key is refused, not dropped', () => {
		/* The bug this exists for: twelve units were written with `parts`,
		   `keyframes` and `reducedMotion` before the compiler had any of them.
		   Every one compiled cleanly and emitted half its CSS. */
		const problems = checkStateContract('thing', {
			base: { color: 'red' },
			pieces: { label: {} }
		} as never)
		expect(problems.some((p) => p.includes('styling.pieces'))).toBe(true)
	})

	test('a unit that animates must say what it does under reduce', () => {
		expect(
			checkStateContract('spin', {
				base: { animation: 'x 1s linear infinite' },
				keyframes: { x: { to: { transform: 'rotate(360deg)' } } }
			}).some((p) => p.includes('reducedMotion'))
		).toBe(true)
		expect(
			checkStateContract('spin', {
				base: { animation: 'x 1s linear infinite' },
				keyframes: { x: { to: { transform: 'rotate(360deg)' } } },
				reducedMotion: { animationDuration: '2400ms' }
			}).some((p) => p.includes('reducedMotion'))
		).toBe(false)
	})

	test('parts become flat classes, and a part keeps both its look and its states', () => {
		const out = compileUnitStyling('field', {
			parts: { control: { border: '1px solid' }, label: { fontWeight: '500' } },
			states: { focus: { $part: 'control', outline: '2px solid' } }
		} as never)
		expect(out['field-label']).toEqual({ fontWeight: '500' })
		/* Both, merged — assigning either over the other is the ordering bug. */
		expect(out['field-control']).toEqual({
			border: '1px solid',
			'&:focus-visible': { outline: '2px solid' }
		})
	})

	test('a variant may dress one part rather than the whole unit', () => {
		const out = compileUnitStyling('field', {
			variants: { size: { sm: { $part: 'control', minBlockSize: '2.25rem' } } }
		} as never)
		/* The class on the UNIT, the rule reaching the part. Putting it on the
		   part — `.field-control--size-sm` — compiles and is a bad interface: the
		   caller would have to know which piece carries which variant. */
		expect(out['field--size-sm']).toEqual({ '& .field-control': { minBlockSize: '2.25rem' } })
		expect(out['field-control--size-sm']).toBeUndefined()
	})

	test('keyframes travel with the unit that animates', () => {
		const out = compileUnitStyling('spin', {
			keyframes: { 'aven-spin': { to: { transform: 'rotate(360deg)' } } }
		})
		expect(out['@keyframes aven-spin']).toEqual({ to: { transform: 'rotate(360deg)' } })
	})

	test('documentation keys never reach the browser', () => {
		const out = compileUnitStyling('x', {
			parts: { y: { $description: 'why', color: 'red' } }
		} as never)
		expect(out['x-y']).toEqual({ color: 'red' })
	})
})

describe('a variant that dresses one part', () => {
	test('the class goes on the UNIT and the rule reaches the part', () => {
		const out = compileUnitStyling('stat', {
			variants: { tone: { accent: { $part: 'value', color: 'gold' } } }
		} as never)
		/* Not `.stat-value--tone-accent`: a caller should not have to know which
		   interior piece carries which variant. */
		expect(out['stat--tone-accent']).toEqual({ '& .stat-value': { color: 'gold' } })
		expect(out['stat-value--tone-accent']).toBeUndefined()
	})

	test('a state that names a part still lands on the part itself', () => {
		/* The other way round on purpose — the thing that takes focus is the input,
		   not the field wrapper. */
		const out = compileUnitStyling('field', {
			states: { focus: { $part: 'control', outline: '2px solid' } }
		} as never)
		expect(out['field-control']).toEqual({ '&:focus-visible': { outline: '2px solid' } })
	})
})

describe('documentation never reaches the browser', () => {
	test('an axis may document itself without becoming an option', () => {
		const out = compileUnitStyling('section', {
			variants: { measure: { $description: 'why', prose: { maxInlineSize: '44rem' } } }
		} as never)
		/* `.section--measure-$description` is a `$` in a selector, and lightningcss
		   refuses the entire stylesheet over it. */
		expect(Object.keys(out).some((k) => k.includes('$'))).toBe(false)
		expect(out['section--measure-prose']).toEqual({ maxInlineSize: '44rem' })
	})
})

describe('every block is stripped, not just some', () => {
	test('a description on the resting look never reaches the stylesheet', () => {
		/* `base` was the one block that was not stripped, so a `$description` on it
		   arrived as `$description: ...` and postcss refused the whole file. */
		const out = compileUnitStyling('icon', {
			base: { $description: 'why this is sized in em', display: 'inline-flex' }
		} as never)
		expect(out.icon).toEqual({ display: 'inline-flex' })
	})

	test('nothing anywhere in the output carries a documentation key', () => {
		const out = compileUnitStyling('x', {
			base: { $description: 'a', color: 'red' },
			parts: { y: { $description: 'b', color: 'red' } },
			variants: { size: { $description: 'c', sm: { $description: 'd', color: 'red' } } },
			states: { hover: { $description: 'e', color: 'red' } },
			reducedMotion: { $description: 'f', transition: 'none' }
		} as never)
		expect(JSON.stringify(out)).not.toContain('$')
	})
})

describe('"this is the current one" is spelled three ways', () => {
	/*
	 * A sidebar documented a selected state, declared it, marked its current
	 * item the only correct way for a navigation — `aria-current="page"` — and
	 * rendered nothing, because the selector matched `aria-selected` alone.
	 * Putting `aria-selected` on an `<a>` to satisfy it is invalid ARIA that axe
	 * rejects, so the unit had no way to be right.
	 */
	test('selected matches aria-selected, aria-pressed AND aria-current', () => {
		const out = compileUnitStyling('nav-item', {
			states: { selected: { fontWeight: '600' } }
		} as never)
		const selector = Object.keys(out['nav-item']).find((k) => k.startsWith('&['))
		expect(selector).toContain('aria-selected="true"')
		expect(selector).toContain('aria-pressed="true"')
		expect(selector).toContain('aria-current')
	})

	test('aria-current="false" is not current', () => {
		/* The attribute's own way of saying "not this one". A bare
		   `[aria-current]` matches it and marks every item in the list. */
		const out = compileUnitStyling('nav-item', {
			states: { selected: { fontWeight: '600' } }
		} as never)
		const selector = Object.keys(out['nav-item']).find((k) => k.startsWith('&['))
		expect(selector).toContain(':not([aria-current="false"])')
	})
})
