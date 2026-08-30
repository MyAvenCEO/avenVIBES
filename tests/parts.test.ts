import { describe, expect, test } from 'bun:test'
import { renderViewToString } from '../src/string-renderer'
import type { UnitRegistry } from '../src/unit'
import { Evaluator } from '../src/view-validator'

/**
 * `part` is the bridge between a unit's stylesheet and its rendered markup.
 *
 * `compileUnitStyling` addresses a unit's anatomy as `.unit-part`, and until
 * this existed the renderers ignored `part` entirely — a placed unit rendered
 * its whole structure with no classes, so the stylesheet named parts and
 * nothing wore the names. These tests pin the resolution where all three
 * walks share it (expandUse), through the one renderer that runs headless.
 */

const evaluator = new Evaluator()
const evaluate = (expr: unknown, data: Parameters<Evaluator['evaluate']>[1]) =>
	evaluator.evaluate(expr, data)

const units: UnitRegistry = {
	'nav-menu': {
		name: 'nav-menu',
		view: {
			tag: 'div',
			children: [
				{ tag: 'div', part: 'crest', text: 'crest' },
				{
					tag: 'div',
					part: 'items',
					$each: {
						items: '$props.items',
						template: { tag: 'a', part: 'item', text: '$$label' }
					}
				},
				{ tag: 'div', part: 'inner', $use: { unit: 'badge' } }
			]
		},
		interface: { props: { items: 'array' } }
	},
	badge: {
		name: 'badge',
		view: { tag: 'span', part: 'label', text: 'B' }
	}
}

test('part resolves to unit-part classes through the whole subtree', async () => {
	const html = await renderViewToString(
		{ tag: 'div', $use: { unit: 'nav-menu', props: { items: [{ label: 'Skills' }] } } },
		{},
		{ evaluate, units }
	)
	expect(html).toContain('class="nav-menu-crest"')
	expect(html).toContain('class="nav-menu-items"')
	/* Inside $each, under the same unit's name. */
	expect(html).toContain('class="nav-menu-item"')
})

test('a nested $use resolves under ITS OWN name, not the caller apostrophe-s', async () => {
	const html = await renderViewToString(
		{ tag: 'div', $use: { unit: 'nav-menu', props: { items: [] } } },
		{},
		{ evaluate, units }
	)
	expect(html).toContain('class="nav-menu-inner"')
	expect(html).toContain('class="badge-label"')
	expect(html).not.toContain('nav-menu-label')
})

test('an explicit class survives beside the part class', async () => {
	const withClass: UnitRegistry = {
		x: { name: 'x', view: { tag: 'div', part: 'body', class: 'stack' } }
	}
	const html = await renderViewToString(
		{ tag: 'div', $use: { unit: 'x' } },
		{},
		{ evaluate, units: withClass }
	)
	expect(html).toContain('class="x-body stack"')
})

describe('outside a unit, part is inert', () => {
	test('a bare view node with part renders no invented class', async () => {
		const html = await renderViewToString({ tag: 'div', part: 'floating' }, {}, { evaluate })
		expect(html).not.toContain('class=')
	})
})
