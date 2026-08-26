/**
 * THE BUILD STEP — the design system's own, in place of Tailwind's.
 *
 * `@tailwindcss/vite` did three jobs: it scanned the source for class names,
 * generated CSS for the ones it found, and expanded `@apply`. This does the
 * same three, from our scales, plus a fourth Tailwind could not do: it FAILS
 * when a class resolves to nothing.
 *
 * That fourth job is the reason this exists. A misspelt or undefined class is
 * silently dropped by a JIT compiler — no error, no warning, just an element
 * that renders unstyled. Six phantom colour tokens and a `/65` opacity suffix
 * on a component class had been shipping that way; nothing in the toolchain
 * was capable of noticing, because "class I do not recognise" and "class that
 * does not exist" were the same case.
 *
 * Usage, in a surface's entry stylesheet:
 *
 *   @aven-utilities;
 *
 * and in its Vite config:
 *
 *   avenUtilities({ brand: avenCeo, content: ['src'] })
 */

import { type Dirent, existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { scanCandidates, scanDeclaredClasses, scanSource } from './scan.js'
import { type Brand, pieceNames } from './types.js'
import { createUtilities } from './utilities.js'

export interface AvenUtilitiesOptions {
	/**
	 * Whose design system this surface is rendered in.
	 *
	 * The one thing a surface must state. Everything the plugin resolves — a
	 * colour name, a type step, a component class — comes from here, so two
	 * surfaces in the same repo can belong to different brands and neither can
	 * silently borrow the other's palette.
	 */
	brand: Brand
	/** Directories to scan, relative to the Vite root. */
	content: string[]
	/**
	 * Classes this surface defines itself and the generator should not judge.
	 *
	 * Rarely needed: a class declared in any stylesheet or `<style>` block under
	 * `content` is found automatically. Reach for this only when a class is
	 * styled somewhere the scanner cannot see.
	 */
	known?: string[]
	/**
	 * Report unknown classes instead of failing.
	 *
	 * Defaults to failing, because a warning in a build log is the same as no
	 * warning at all. Set true only while migrating a surface.
	 */
	lenient?: boolean
}

/** Everything the marker expands into, plus what could not be resolved. */
export interface GeneratedCss {
	css: string
	unknown: string[]
	classes: number
}

const SCANNABLE = /\.(svelte|ts|tsx|js|jsx|html)$/
const STYLESHEET = /\.(css|svelte)$/

/** Walk the content directories once and build the surface's stylesheet. */
export function generate(root: string, options: AvenUtilitiesOptions): GeneratedCss {
	const { utilityCss, resetCss } = createUtilities(options.brand)
	/* Two tiers: what the markup SAYS is a class, and what merely looks like one
	   elsewhere in the file. Only the first tier can fail a build. */
	const certain = new Set<string>()
	const candidates = new Set<string>()
	const declared = new Set(options.known ?? [])

	for (const dir of options.content) {
		const base = path.resolve(root, dir)
		/*
		 * A content directory that is not there is a configuration bug, and a
		 * silent one: every class used only inside it goes missing with nothing to
		 * show for it. This app pointed at `libs/aven-city/src` for months after
		 * that library was deleted.
		 */
		if (!existsSync(base)) throw new Error(`aven-utilities: content directory not found — ${base}`)
		for (const file of walk(base)) {
			const source = readFileSync(file, 'utf8')
			if (SCANNABLE.test(file)) {
				for (const use of scanSource(source, file)) certain.add(use.name)
				for (const use of scanCandidates(source, file)) candidates.add(use.name)
			}
			if (STYLESHEET.test(file)) for (const name of scanDeclaredClasses(source)) declared.add(name)
		}
	}
	for (const name of certain) candidates.delete(name)

	const known = [...pieceNames(options.brand), ...declared]
	const result = utilityCss(certain, known)
	/* Candidates are generated when they resolve; their misses are not errors,
	   so the unknown list they produce is discarded rather than reported. */
	const extra = utilityCss(candidates, known)
	return {
		css: `${resetCss()}\n${result.css}\n${extra.css}`,
		unknown: result.unknown,
		classes: certain.size + (candidates.size - extra.unknown.length)
	}
}

function* walk(dir: string): Generator<string> {
	let entries: Dirent[]
	try {
		entries = readdirSync(dir, { withFileTypes: true })
	} catch {
		return
	}
	for (const entry of entries) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) yield* walk(full)
		else if (SCANNABLE.test(entry.name) || STYLESHEET.test(entry.name)) yield full
	}
}

/**
 * Expand `@apply a b c;` into the declarations those classes carry.
 *
 * Kept because the base layer genuinely reads better as `@apply` than as six
 * lines of longhand, and because rewriting every one of them by hand is a
 * chance to change a value by accident.
 */
export function expandApply(brand: Brand, css: string, onUnknown: (name: string) => void): string {
	const { appliedDecl } = createUtilities(brand)
	return css.replace(/@apply\s+([^;}]+);/g, (_, list: string) => {
		const out: string[] = []
		for (const name of list.trim().split(/\s+/)) {
			const decls = appliedDecl(name)
			if (!decls) {
				onUnknown(name)
				continue
			}
			for (const [property, value] of Object.entries(decls))
				out.push(
					typeof value === 'string'
						? `${property}: ${value};`
						: `${property} { ${Object.entries(value)
								.map(([k, v]) => `${k}: ${v};`)
								.join(' ')} }`
				)
		}
		return out.join(' ')
	})
}

/** The marker a stylesheet uses to pull the generated layers in. */
const MARKER = /@aven-utilities\s*;/

export function avenUtilities(options: AvenUtilitiesOptions) {
	let root = '.'

	return {
		name: 'aven-utilities',
		enforce: 'pre' as const,

		configResolved(config: { root: string }) {
			root = config.root
		},

		transform(code: string, id: string) {
			const [file] = id.split('?')
			if (!file.endsWith('.css')) return null
			const hasMarker = MARKER.test(code)
			if (!hasMarker && !code.includes('@apply')) return null

			const unknown: string[] = []
			let out = expandApply(options.brand, code, (name) => unknown.push(name))

			let classes = 0
			if (hasMarker) {
				const generated = generate(root, options)
				unknown.push(...generated.unknown)
				classes = generated.classes
				out = out.replace(MARKER, generated.css)
			}

			if (unknown.length) {
				const message =
					`aven-utilities: ${unknown.length} class(es) resolve to nothing — ` +
					`they would render unstyled.\n  ${unknown.sort().join('\n  ')}`
				if (!options.lenient) throw new Error(message)
				console.warn(message)
			}
			if (hasMarker)
				console.log(`aven-utilities: ${classes} classes -> ${Math.round(out.length / 1024)} KB`)
			return { code: out, map: null }
		},

		/*
		 * A class only exists in the markup, so editing a component can change the
		 * stylesheet. Vite has no way to know that on its own — the CSS file did
		 * not change — so the entry has to be invalidated by hand.
		 */
		handleHotUpdate(ctx: {
			file: string
			server: { moduleGraph: { getModulesByFile(f: string): Set<unknown> | undefined } }
		}) {
			if (!SCANNABLE.test(ctx.file)) return
			for (const dir of options.content) {
				const entry = path.resolve(root, dir, 'app.css')
				const mods = ctx.server.moduleGraph.getModulesByFile(entry)
				if (mods) return [...(mods as Set<never>)]
			}
			return
		}
	}
}
