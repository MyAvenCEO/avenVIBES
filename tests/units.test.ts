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
		expect(out['field-control--size-sm']).toEqual({ minBlockSize: '2.25rem' })
		expect(out['field--size-sm']).toBeUndefined()
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
