import { describe, expect, test } from 'bun:test'
import { renderMarkdownDoc } from '../src/markdown'

/**
 * The docs renderer's contract: stable heading slugs, a toc a sidebar can
 * trust, demo fences that become mount points instead of code, and code
 * blocks for every OTHER language left exactly as marked writes them.
 *
 * The sanitize hook is tested as a hook — that it runs, and that its absence
 * is the default — because the module's whole reason to exist is rendering
 * trusted docs in a process that has no DOM to give DOMPurify.
 */

describe('heading ids and the toc', () => {
	test('headings get lowercase alnum-and-dash slugs', async () => {
		const { html } = await renderMarkdownDoc('## What is avenVIBES?')
		expect(html).toContain('<h2 id="what-is-avenvibes">')
	})

	test('the toc collects h2 and h3, skipping h1 and h4', async () => {
		const { toc } = await renderMarkdownDoc('# Title\n\n## Section\n\n### Detail\n\n#### Too deep')
		expect(toc).toEqual([
			{ id: 'section', title: 'Section', level: 2 },
			{ id: 'detail', title: 'Detail', level: 3 }
		])
	})

	test('duplicate headings get suffixed ids instead of colliding anchors', async () => {
		const { html, toc } = await renderMarkdownDoc('## Example\n\n## Example')
		expect(html).toContain('id="example"')
		expect(html).toContain('id="example-2"')
		expect(toc.map((t) => t.id)).toEqual(['example', 'example-2'])
	})

	test('inline markup in a heading renders, but the toc title is plain text', async () => {
		const { html, toc } = await renderMarkdownDoc('## The `$use` node')
		expect(html).toContain('<code>$use</code>')
		expect(toc[0].title).toBe('The $use node')
		expect(toc[0].id).toBe('the-use-node')
	})
})

describe('demo fences', () => {
	test('a demo fence renders as a mount point, not as code', async () => {
		const { html } = await renderMarkdownDoc('```demo\nmenu-island\n```')
		expect(html).toContain('<div data-md-demo="menu-island"></div>')
		expect(html).not.toContain('<pre>')
	})

	test('only the first word names the demo; the rest of the body is a note', async () => {
		const { html } = await renderMarkdownDoc(
			'```demo\ncounter-island a running counter, mounted by the consumer\n```'
		)
		expect(html).toContain('data-md-demo="counter-island"')
		expect(html).not.toContain('a running counter')
	})

	test('the demo name is slug-sanitised so a fence cannot inject attributes', async () => {
		const { html } = await renderMarkdownDoc('```demo\nx"><script>alert(1)</script>\n```')
		expect(html).not.toContain('<script')
		expect(html).toMatch(/data-md-demo="[a-z0-9-]*"/)
	})
})

describe('ordinary code blocks stay code', () => {
	test('a ts fence renders as pre/code with the text escaped, untouched', async () => {
		const { html } = await renderMarkdownDoc('```ts\nconst a = 1 < 2\n```')
		expect(html).toContain('<pre>')
		expect(html).toContain('const a = 1 &lt; 2')
		expect(html).not.toContain('data-md-demo')
	})
})

describe('the sanitize hook', () => {
	test('is applied to the final html when given', async () => {
		const { html } = await renderMarkdownDoc('Hello **world**', {
			sanitize: (h) => h.replace(/world/g, 'clean')
		})
		expect(html).toContain('clean')
		expect(html).not.toContain('world')
	})

	test('is absent by default — trusted docs pass through as marked wrote them', async () => {
		const { html } = await renderMarkdownDoc('A <em>trusted</em> inline tag')
		expect(html).toContain('<em>trusted</em>')
	})
})
