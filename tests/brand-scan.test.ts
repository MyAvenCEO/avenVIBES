import { describe, expect, test } from 'bun:test'
import { scanSource } from '../src/brand/scan.js'
import type { Brand } from '../src/brand/types.js'
import { createUtilities } from '../src/brand/utilities.js'

const names = (source: string) => scanSource(source, 'Dock.svelte').map((use) => use.name)
const empty = {}
const testBrand: Brand = {
	name: 'test',
	slug: 'test',
	tones: empty,
	creams: empty,
	contrastInk: empty,
	surfaces: empty,
	roles: empty,
	siteRoles: empty,
	appRoles: empty,
	fonts: { app: 'sans-serif', web: 'sans-serif' },
	fontWeights: empty,
	radii: empty,
	scales: {
		type: empty,
		tracking: empty,
		ink: empty,
		tint: empty,
		elevation: empty,
		radius: empty,
		space: empty
	},
	scaleTokens: empty,
	primitives: empty,
	components: empty,
	elements: empty,
	appIconPlate: '#fff'
}

describe('brand utility scanner', () => {
	test('keeps the floating-dock arbitrary child variant', () => {
		const dock = `
			<div
				class="pointer-events-none absolute right-2 bottom-2 left-2 z-50 flex flex-col
					gap-1.5 pb-[env(safe-area-inset-bottom)] [&>*]:pointer-events-auto"
			></div>
		`

		const scanned = names(dock)
		expect(scanned).toContain('[&>*]:pointer-events-auto')

		const emitted = createUtilities(testBrand).utilityCss(scanned)
		expect(emitted.unknown).toEqual([])
		expect(emitted.css).toContain('.\\[\\&\\>\\*\\]\\:pointer-events-auto')
		expect(emitted.css).toContain('&>* {')
	})

	test('does not silently discard an unknown utility behind an arbitrary variant', () => {
		const scanned = names('<div class="[&>*]:definitely-not-a-utility"></div>')
		expect(scanned).toContain('[&>*]:definitely-not-a-utility')
		expect(createUtilities(testBrand).utilityCss(scanned).unknown).toEqual([
			'[&>*]:definitely-not-a-utility'
		])
	})

	test('keeps every arbitrary shape supported by the emitter', () => {
		expect(
			names(
				'<div class="[animation-delay:150ms] sm:[&>*]:pointer-events-auto 2xl:grid !text-[1.7rem]"></div>'
			)
		).toEqual([
			'[animation-delay:150ms]',
			'sm:[&>*]:pointer-events-auto',
			'2xl:grid',
			'!text-[1.7rem]'
		])
	})

	test('escapes a leading-digit variant into a valid class selector', () => {
		const emitted = createUtilities(testBrand).utilityCss(['2xl:grid'])
		expect(emitted.unknown).toEqual([])
		expect(emitted.css).toContain('.\\32 xl\\:grid')
	})
})
