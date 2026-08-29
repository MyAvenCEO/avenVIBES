/**
 * The icon registry, and what it refuses.
 *
 * This module exists because `SAFE_TAGS` admits no SVG, and it admits no SVG
 * for good reasons: an `<svg>` can carry `<script>`, a `<foreignObject>` full
 * of HTML, an `xlink:href` to a remote document, and event handlers on any
 * node. Loosening the allowlist would have handed every view that power. So
 * most of these tests hand the registry something hostile and assert it is
 * refused — a validator that only ever sees valid input proves nothing.
 */
import { expect, describe as suite, test } from 'bun:test'
import { renderIcon, validateIcon, validateIconRegistry } from '../src/icons.js'
import { renderViewToString } from '../src/string-renderer.js'
import { Evaluator } from '../src/view-validator.js'

const check = { viewBox: '0 0 24 24', paths: ['M20 6L9 17l-5-5'], stroke: true }
const registry = { check }

suite('the registry refuses anything that is not geometry', () => {
	test('a path carrying a script', () => {
		expect(() =>
			validateIcon('evil', { viewBox: '0 0 24 24', paths: ['"/><script>alert(1)</script>'] })
		).toThrow('not path geometry')
	})

	test('a path carrying an event handler', () => {
		expect(() =>
			validateIcon('evil', { viewBox: '0 0 24 24', paths: ['M0 0" onload="alert(1)'] })
		).toThrow('not path geometry')
	})

	test('a viewBox that is not four numbers', () => {
		expect(() =>
			validateIcon('evil', { viewBox: '0 0 24 24"><script>x</script>', paths: ['M0 0'] })
		).toThrow('four numbers')
	})

	test('an icon with no geometry at all', () => {
		expect(() => validateIcon('empty', { viewBox: '0 0 24 24', paths: [] })).toThrow(
			'declares no `paths`'
		)
	})

	test('and accepts real path data', () => {
		expect(() => validateIconRegistry(registry)).not.toThrow()
	})
})

suite('rendering', () => {
	test('takes its colour from currentColor, which is what makes it themeable', () => {
		expect(renderIcon('check', registry)).toContain('stroke="currentColor"')
	})

	test('is aria-hidden unless it has a title', () => {
		expect(renderIcon('check', registry)).toContain('aria-hidden="true"')
		expect(renderIcon('check', registry, { title: 'Done' })).toContain('aria-label="Done"')
	})

	test('a title is escaped, being the one piece of free text here', () => {
		expect(renderIcon('check', registry, { title: '<script>' })).toContain('&lt;script&gt;')
	})

	test('a size that is not a length is ignored rather than injected', () => {
		expect(renderIcon('check', registry, { size: '1rem" onload="x' })).toContain('width="1em"')
	})

	test('an unregistered name renders nothing, rather than a broken element', () => {
		expect(renderIcon('nope', registry)).toBe('')
	})
})

suite('in a view', () => {
	const evaluator = new Evaluator()
	const evaluate = (expression: unknown, data: never) => evaluator.evaluate(expression, data)

	test('a view draws an icon by NAME and can supply no markup of its own', async () => {
		const html = await renderViewToString(
			{
				tag: 'button',
				children: [
					{ tag: 'span', $icon: { name: 'check' } },
					{ tag: 'span', text: 'Done' }
				]
			} as never,
			{} as never,
			{ evaluate: evaluate as never, icons: registry }
		)
		expect(html).toContain('<svg viewBox="0 0 24 24"')
		expect(html).toContain('Done')
	})

	test('an icon the registry does not have leaves an empty element, never markup', async () => {
		const html = await renderViewToString(
			{ tag: 'span', $icon: { name: 'nope' } } as never,
			{} as never,
			{ evaluate: evaluate as never, icons: registry }
		)
		expect(html).toBe('<span data-aven-path="0"></span>')
	})
})

suite('duotone', () => {
	const duo = {
		social: {
			viewBox: '0 0 256 256',
			paths: [{ d: 'M128 24a104 104 0 1 0 0 208Z', opacity: 0.2 }, 'M128 24a104 104 0 1 0 0 208Z']
		}
	}

	test('a path may carry an opacity, and it reaches the markup', () => {
		validateIconRegistry(duo)
		const svg = renderIcon('social', duo)
		expect(svg).toContain('opacity="0.2"')
		/* Still one colour: duotone is two opacities of currentColor, not two
		   colours, which is what keeps it working in both themes. */
		expect(svg).not.toMatch(/#[0-9a-f]{3,6}/i)
	})

	test('refuses an opacity that is not a number', () => {
		for (const opacity of ['0.2', '0.2" onload="x', null, 2, -1]) {
			expect(() =>
				validateIcon('bad', { viewBox: '0 0 24 24', paths: [{ d: 'M0 0h24', opacity }] })
			).toThrow(/opacity/)
		}
	})

	test('still refuses hostile geometry inside the object form', () => {
		expect(() =>
			validateIcon('bad', {
				viewBox: '0 0 24 24',
				paths: [{ d: '"/><script>alert(1)</script>', opacity: 0.2 }]
			})
		).toThrow(/geometry/)
	})
})
