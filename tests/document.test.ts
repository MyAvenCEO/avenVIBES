/**
 * The brand document, and what it refuses.
 *
 * A validator that only ever sees valid input proves nothing, so most of these
 * hand it something broken and assert on the failure. The specific bug being
 * defended against: an absent group flattens to `{}`, every token referencing
 * it emits `var(--color-)`, and the page renders in the browser's defaults
 * instead of failing — a silent wrong render is far worse than a loud throw.
 */
import { expect, describe as suite, test } from 'bun:test'
import {
	brandFromDocuments,
	describe,
	descriptions,
	flatten,
	nearestStepOn,
	validateBrandDocument,
	validateComponentsDocument,
	withAlpha
} from '../src/brand/document.js'

/** The smallest document that is a complete brand. */
function completeBrand() {
	const group = (name: string) => ({ [name]: { $type: 'color', $value: '#123456' } })
	const step = (name: string) => ({ [name]: { $type: 'dimension', $value: '1rem' } })
	return {
		name: 'Test',
		slug: 'test',
		color: {
			tones: group('brandblue'),
			functional: group('errortone'),
			grounds: { ...group('light-page'), ...group('dark-page') },
			surfaces: group('page'),
			ink: group('white'),
			roles: group('primary')
		},
		font: {
			stack: { app: { $value: 'Inter' }, web: { $value: 'Inter' } },
			weight: { regular: { $value: '400' } }
		},
		radii: step('radius-card'),
		scale: {
			type: step('fs-body'),
			tracking: step('tracking-wide'),
			alpha: {
				'on-text': { 'ink-full': { $value: '0.9' } },
				'on-surface': { 'tint-soft': { $value: '0.15' } }
			},
			elevation: { 'shadow-raised': { $value: '0 1px 3px rgba(0,0,0,.05)' } },
			radius: step('radius-chip'),
			space: step('space-tight')
		},
		elements: { h1: 'title' },
		appIconPlate: '#faf9f4'
	}
}

const pieces = {
	components: { card: { padding: '1rem' } },
	layouts: { stack: { display: 'grid' } }
}

suite('flatten', () => {
	test('reads $value and skips $-prefixed metadata', () => {
		const out = flatten({
			$description: 'the paint',
			marine: { $type: 'color', $value: '#1e293b' },
			plain: 'var(--color-marine)'
		})
		expect(out).toEqual({ marine: '#1e293b', plain: 'var(--color-marine)' })
	})

	test('stringifies numbers, so an opacity may be written either way', () => {
		expect(flatten({ a: { $value: 0.65 }, b: { $value: '0.65' } })).toEqual({
			a: '0.65',
			b: '0.65'
		})
	})

	test('an absent group is empty rather than a crash', () => {
		expect(flatten(undefined)).toEqual({})
	})
})

suite('prose', () => {
	test('group and token descriptions come back separately', () => {
		const g = {
			$description: 'the paint',
			marine: { $value: '#1e293b', $description: 'deep navy' }
		}
		expect(describe(g)).toBe('the paint')
		expect(descriptions(g)).toEqual({ marine: 'deep navy' })
	})
})

suite('validateBrandDocument refuses', () => {
	test('a document that is not an object', () => {
		expect(() => validateBrandDocument(null)).toThrow('not an object')
	})

	test('a missing colour group, by name', () => {
		const doc = completeBrand()
		// @ts-expect-error deliberately removing a required group
		doc.color.roles = undefined
		expect(() => validateBrandDocument(doc)).toThrow('color.roles')
	})

	test('a group that exists but declares nothing', () => {
		const doc = completeBrand()
		doc.color.tones = {}
		expect(() => validateBrandDocument(doc)).toThrow('declares no tokens')
	})

	test('a missing scale, by name', () => {
		const doc = completeBrand()
		// @ts-expect-error deliberately removing a required scale
		doc.scale.alpha['on-text'] = undefined
		expect(() => validateBrandDocument(doc)).toThrow('scale.alpha.on-text')
	})

	test('a font stack without the two faces every surface needs', () => {
		const doc = completeBrand()
		doc.font.stack = { app: { $value: 'Inter' } }
		expect(() => validateBrandDocument(doc)).toThrow('font.stack.web')
	})

	test('and reports every problem at once, not just the first', () => {
		const doc = completeBrand()
		doc.color.tones = {}
		doc.color.surfaces = {}
		let message = ''
		try {
			validateBrandDocument(doc)
		} catch (e) {
			message = (e as Error).message
		}
		expect(message).toContain('color.tones')
		expect(message).toContain('color.surfaces')
	})

	test('but accepts a complete one', () => {
		expect(() => validateBrandDocument(completeBrand())).not.toThrow()
	})
})

suite('validateComponentsDocument', () => {
	test('refuses a document with no layouts', () => {
		expect(() => validateComponentsDocument({ components: {} })).toThrow('layouts')
	})
})

suite('brandFromDocuments', () => {
	test('produces a Brand the generator can consume', () => {
		const brand = brandFromDocuments(completeBrand(), pieces)
		expect(brand.name).toBe('Test')
		expect(brand.tones.brandblue).toBe('#123456')
		expect(brand.fonts.app).toBe('Inter')
		expect(brand.components.card).toEqual({ padding: '1rem' })
		expect(brand.elements).toEqual({ h1: 'title' })
	})

	test('omits `display` rather than setting it undefined', () => {
		const brand = brandFromDocuments(completeBrand(), pieces)
		expect('display' in brand.fonts).toBe(false)
	})

	test('derives scaleTokens in the order the CSS is emitted in', () => {
		const brand = brandFromDocuments(completeBrand(), pieces)
		expect(Object.keys(brand.scaleTokens)).toEqual([
			'fs-body',
			'tracking-wide',
			'shadow-raised',
			'radius-chip',
			'space-tight',
			'ink-full',
			'tint-soft'
		])
	})

	test('validates before assembling, so a broken brand never reaches the kit', () => {
		const doc = completeBrand()
		doc.color.surfaces = {}
		expect(() => brandFromDocuments(doc, pieces)).toThrow('color.surfaces')
	})
})

suite('colour arithmetic', () => {
	test('withAlpha expands shorthand hex', () => {
		expect(withAlpha('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)')
	})

	test('withAlpha handles full hex with or without the hash', () => {
		expect(withAlpha('#1f2a3d', 0.56)).toBe('rgba(31, 42, 61, 0.56)')
		expect(withAlpha('1f2a3d', 0.56)).toBe('rgba(31, 42, 61, 0.56)')
	})

	test('nearestStepOn snaps to the closest step', () => {
		const ink = { 'ink-quiet': '0.65', 'ink-muted': '0.75', 'ink-full': '0.9' }
		expect(nearestStepOn(ink, 47)).toBe('ink-quiet')
		expect(nearestStepOn(ink, 78)).toBe('ink-muted')
		expect(nearestStepOn(ink, 100)).toBe('ink-full')
	})
})

suite('the theme declares everything its roles reference', () => {
	/**
	 * The bug this locks down, which shipped undetected for months: the generator
	 * emitted tones, surfaces and roles but NOT the contrast inks. It got
	 * away with it while brands inlined those as raw hex inside role values — the
	 * colour reached the page, just not by name. The moment a brand named them and
	 * pointed its `*-foreground` roles at them, all six resolved to nothing and
	 * every piece of text on a filled tone lost its colour.
	 */
	test('every var(--color-…) a role uses is declared in :root', async () => {
		const { createGenerator } = await import('../src/brand/generate.js')
		const { brandFromDocuments } = await import('../src/brand/document.js')
		const doc = completeBrand()
		doc.color.ink = { 'on-brand': { $type: 'color', $value: '#111111' } }
		doc.color.roles = {
			primary: { $value: '#123456' },
			'primary-foreground': { $value: 'var(--color-on-brand)' }
		}
		const css = createGenerator(brandFromDocuments(doc, pieces)).themeCss('web')

		const declared = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]))
		const referenced = [...css.matchAll(/var\((--color-[a-z0-9-]+)/g)].map((m) => m[1])
		const dangling = referenced.filter((r) => !declared.has(r))
		expect(dangling).toEqual([])
	})

	test('and the contrast inks specifically reach the stylesheet', async () => {
		const { createGenerator } = await import('../src/brand/generate.js')
		const { brandFromDocuments } = await import('../src/brand/document.js')
		const doc = completeBrand()
		doc.color.ink = { 'on-brand': { $type: 'color', $value: '#abcdef' } }
		const css = createGenerator(brandFromDocuments(doc, pieces)).themeCss('web')
		expect(css).toContain('--color-on-brand: #abcdef')
	})
})
