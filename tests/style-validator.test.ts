import { describe, expect, test } from 'bun:test'
import { validateStyleDef } from '../src/style-validator.js'

/**
 * A realistic style, owned by the framework.
 *
 * This used to import a vibe from the host application, which made a framework
 * test depend on product content — and broke the moment the framework moved to
 * its own repository. A fixture that lives here cannot go stale on someone
 * else's refactor.
 */
const exampleStyle = {
	tokens: {
		surface: '#fffdf7',
		ink: '#1f2a3d',
		radius: '0.75rem'
	},
	components: {
		card: {
			background: 'var(--surface)',
			color: 'var(--ink)',
			borderRadius: 'var(--radius)',
			padding: '1rem'
		}
	},
	selectors: {
		':host': { display: 'block' }
	}
}

describe('validateStyleDef', () => {
	test('accepts a structured style', () => {
		expect(() => validateStyleDef(exampleStyle)).not.toThrow()
	})

	test('rejects rawCss', () => {
		expect(() =>
			validateStyleDef({
				tokens: {},
				rawCss: 'body { background: red; }'
			} as never)
		).toThrow(/Raw CSS is not allowed/)
	})

	test('rejects @import in token values', () => {
		expect(() =>
			validateStyleDef({
				tokens: { evil: '@import url("https://evil.example/x.css")' }
			})
		).toThrow(/Forbidden CSS value/)
	})

	test('rejects javascript: in component values', () => {
		expect(() =>
			validateStyleDef({
				components: {
					bad: { background: 'javascript:alert(1)' }
				}
			})
		).toThrow(/Forbidden CSS value/)
	})
})
