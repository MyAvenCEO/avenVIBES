import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { scanSource } from '../src/brand/scan.js'
import type { Brand } from '../src/brand/types.js'
import { createUtilities } from '../src/brand/utilities.js'
import { avenUtilities } from '../src/brand/vite.js'

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
	layouts: empty,
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

describe('the scan is memoised, and invalidated when it should be', () => {
	/*
	 * `generate()` walks every content directory and reads every file, and
	 * `transform` called it on EVERY transform of the marker stylesheet. Vite
	 * transforms that file three times on a cold dev start — SSR, client, and
	 * once more as the graph settles — so the whole tree was walked three times
	 * per page load.
	 *
	 * The cost was not only CPU. Each emission REPLACES the injected `<style>`,
	 * and replacing a style tag drops and re-adds its `@font-face` rules, so the
	 * browser re-resolved both fonts on every pass and the page visibly flipped
	 * between fallback and real type for several seconds. Measured on avenCEO:
	 * three fetches per font in dev, at 349ms, 1183ms and 1482ms. The same page
	 * built and served statically fetches each font once.
	 *
	 * Both halves are tested, because a cache that never invalidates is a worse
	 * bug than the one it fixed: a class added to a component would then never
	 * reach the stylesheet.
	 */
	const setup = () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'aven-scan-'))
		writeFileSync(path.join(dir, 'app.css'), '@aven-utilities;')
		writeFileSync(path.join(dir, 'a.svelte'), '<div class="uppercase"></div>')
		const plugin = avenUtilities({
			brand: testBrand,
			content: ['.'],
			lenient: true
		}) as unknown as {
			configResolved(c: { root: string }): void
			transform(code: string, id: string): { code: string } | null
			handleHotUpdate(ctx: unknown): unknown
		}
		plugin.configResolved({ root: dir })
		return { dir, plugin, css: path.join(dir, 'app.css') }
	}

	test('a second transform of the same stylesheet does not re-scan', () => {
		const { dir, plugin, css } = setup()
		const first = plugin.transform('@aven-utilities;', css)?.code
		/* A new class appears on disk. Without a hot-update the cache must NOT
		   see it — that is what proves the second call did not walk the tree. */
		writeFileSync(path.join(dir, 'b.svelte'), '<div class="text-center"></div>')
		const second = plugin.transform('@aven-utilities;', css)?.code
		expect(second).toBe(first)
		rmSync(dir, { recursive: true, force: true })
	})

	test('a hot update makes the next transform re-scan', () => {
		const { dir, plugin, css } = setup()
		const first = plugin.transform('@aven-utilities;', css)?.code
		writeFileSync(path.join(dir, 'b.svelte'), '<div class="text-center"></div>')
		plugin.handleHotUpdate({
			file: path.join(dir, 'b.svelte'),
			server: { moduleGraph: { getModulesByFile: () => undefined } }
		})
		const second = plugin.transform('@aven-utilities;', css)?.code
		expect(second).not.toBe(first)
		rmSync(dir, { recursive: true, force: true })
	})
})
