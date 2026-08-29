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
			tones: group('ink'),
			creams: group('linen'),
			contrastInk: group('white'),
			surfaces: group('page'),
			roles: group('primary'),
			siteRoles: group('accent'),
			appRoles: group('evidence')
		},
		font: {
			stack: { app: { $value: 'Inter' }, web: { $value: 'Inter' } },
			weight: { regular: { $value: '400' } }
		},
		radii: step('radius-card'),
		scale: {
			type: step('fs-body'),
			tracking: step('tracking-wide'),
			ink: { 'ink-full': { $value: '0.9' } },
			tint: { 'tint-soft': { $value: '0.15' } },
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
	primitives: { stack: { display: 'grid' } }
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
		doc.scale.ink = undefined
		expect(() => validateBrandDocument(doc)).toThrow('scale.ink')
	})

	test('a font stack without the two faces every surface needs', () => {
		const doc = completeBrand()
		doc.font.stack = { app: { $value: 'Inter' } }
		expect(() => validateBrandDocument(doc)).toThrow('font.stack.web')
	})

	test('and reports every problem at once, not just the first', () => {
		const doc = completeBrand()
		doc.color.tones = {}
		doc.color.creams = {}
		let message = ''
		try {
			validateBrandDocument(doc)
		} catch (e) {
			message = (e as Error).message
		}
		expect(message).toContain('color.tones')
		expect(message).toContain('color.creams')
	})

	test('but accepts a complete one', () => {
		expect(() => validateBrandDocument(completeBrand())).not.toThrow()
	})
})

suite('validateComponentsDocument', () => {
	test('refuses a document with no primitives', () => {
		expect(() => validateComponentsDocument({ components: {} })).toThrow('primitives')
	})
})

suite('brandFromDocuments', () => {
	test('produces a Brand the generator can consume', () => {
		const brand = brandFromDocuments(completeBrand(), pieces)
		expect(brand.name).toBe('Test')
		expect(brand.tones.ink).toBe('#123456')
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
