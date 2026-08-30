import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

/**
 * The island loop, end to end, in a real (happy-dom) DOM:
 *
 *   build:   renderViewToString writes the markup a crawler reads
 *   client:  Island.hydrate attaches listeners to that exact markup
 *   event:   a click becomes a message to a declared inbox
 *   inbox:   the declarative handler patches state — no sandbox anywhere
 *   render:  the subtree re-renders in place and the DOM shows the new state
 *
 * Every claim the hydration discovery made is pinned here, plus the two the
 * proof of concept skipped: the state-driven re-render, and the contract
 * refusing a message it does not name.
 */

beforeAll(() => {
	GlobalRegistrator.register()
})
afterAll(async () => {
	await GlobalRegistrator.unregister()
})

/** A menu island: a toggle that opens, a close control, state on the root. */
const menuView = {
	tag: 'div',
	attrs: { 'data-open': '$open' },
	children: [
		{
			tag: 'button',
			attrs: { type: 'button', 'aria-expanded': '$open', 'aria-controls': 'm' },
			text: 'Menu',
			$on: { click: { send: 'set-open', to: 'menu', payload: { open: true } } }
		},
		{
			tag: 'nav',
			attrs: { id: 'm' },
			children: [
				{
					tag: 'button',
					attrs: { type: 'button' },
					text: 'Close',
					$on: { click: { send: 'set-open', to: 'menu', payload: { open: false } } }
				},
				{
					tag: 'ul',
					$each: {
						items: '$items',
						template: { tag: 'li', text: '$$label' }
					}
				}
			]
		}
	]
}

const state = () => ({ open: false, items: [{ label: 'Skills' }, { label: 'Pricing' }] })

const bundle = () => ({
	view: menuView,
	state: state(),
	name: 'menu',
	accepts: { 'set-open': { open: 'boolean' } }
})

async function buildAndHydrate() {
	const { renderViewToString, Evaluator, Island } = await import('../src/index.js')
	const evaluator = new Evaluator()
	const html = await renderViewToString(menuView, state(), {
		evaluate: (expr, data) => evaluator.evaluate(expr, data)
	})
	const container = document.createElement('div')
	container.innerHTML = html
	document.body.appendChild(container)
	const undeliverable: Array<{ send: string; address: string }> = []
	const island = new Island({ container })
	island.messageRouter().setUndeliverableHandler((event, address) => {
		undeliverable.push({ send: event.send, address })
	})
	const attached = await island.hydrate(bundle())
	return { container, island, attached, html, undeliverable }
}

describe('the island hydrates the markup the build wrote', () => {
	test('the static HTML carries the content and the closed state, before any JS', async () => {
		const { html } = await buildAndHydrate()
		expect(html).toContain('Skills')
		expect(html).toContain('Pricing')
		/* The parity fix: a false boolean on a non-HTML-boolean attribute must
		   render as the string, not vanish — a closed menu's toggle still tells
		   a screen reader it is closed. */
		expect(html).toContain('aria-expanded="false"')
		expect(html).toContain('data-open="false"')
	})

	test('hydration attaches listeners without touching the markup', async () => {
		const { container, attached } = await buildAndHydrate()
		expect(attached).toBe(2)
		expect(container.querySelectorAll('li').length).toBe(2)
	})

	test('a click becomes a message, the declarative inbox patches state, the DOM re-renders', async () => {
		const { container, island } = await buildAndHydrate()
		const toggle = container.querySelector('button')
		expect(toggle?.getAttribute('aria-expanded')).toBe('false')

		toggle?.click()
		await Bun.sleep(0)

		expect(island.getState().open).toBe(true)
		const after = container.querySelector('button')
		expect(after?.getAttribute('aria-expanded')).toBe('true')
		expect(container.querySelector('[data-open]')?.getAttribute('data-open')).toBe('true')
		/* The re-render swapped the subtree — and the swapped tree is itself
		   live: the close control inside it must still work. */
		const close = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Close')
		close?.click()
		await Bun.sleep(0)
		expect(island.getState().open).toBe(false)
		expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
	})

	test('the inbox is a contract: an unlisted message is refused loudly, and state stands', async () => {
		const { island, undeliverable } = await buildAndHydrate()
		await island.messageRouter().deliver({ send: 'set-opne', payload: { open: true } }, 'menu')
		await Bun.sleep(0)
		expect(island.getState().open).toBe(false)
		expect(undeliverable).toEqual([{ send: 'set-opne', address: 'menu' }])
	})
})

describe('inbox wiring without any sandbox', () => {
	test('a unit declaring accepts (no logic) receives declaratively', async () => {
		const { Island: IslandCls } = await import('../src/index.js')
		const container = document.createElement('div')
		container.innerHTML = '<div data-aven-path="0"></div>'
		document.body.appendChild(container)
		const island = new IslandCls({ container })
		await island.hydrate({
			view: { tag: 'div' },
			state: { tabs: { active: 'a' } },
			units: {
				tabs: {
					name: 'tabs',
					view: { tag: 'div' },
					interface: { accepts: { 'select-tab': { active: 'string' } } }
				}
			}
		})
		await island.messageRouter().deliver({ send: 'select-tab', payload: { active: 'b' } }, 'tabs')
		await Bun.sleep(0)
		/* Merged, not replaced: the patch keeps whatever else the slice held. */
		expect(island.getState().tabs).toEqual({ active: 'b' })
	})

	test('a logic unit without a sandbox is skipped loudly; other inboxes still live', async () => {
		const { Island: IslandCls } = await import('../src/index.js')
		const warnings: string[] = []
		const realWarn = console.warn
		console.warn = (msg: string) => warnings.push(String(msg))
		try {
			const container = document.createElement('div')
			container.innerHTML = '<div data-aven-path="0"></div>'
			document.body.appendChild(container)
			const island = new IslandCls({ container })
			await island.hydrate({
				view: { tag: 'div' },
				state: {},
				units: {
					checkout: {
						name: 'checkout',
						view: { tag: 'div' },
						logic: 'x => x',
						interface: { accepts: { pay: {} } }
					},
					menu: {
						name: 'menu',
						view: { tag: 'div' },
						interface: { accepts: { 'set-open': { open: 'boolean' } } }
					}
				}
			})
			expect(warnings.join(' ')).toContain('checkout')
			await island.messageRouter().deliver({ send: 'set-open', payload: { open: true } }, 'menu')
			await Bun.sleep(0)
			expect(island.getState().menu).toEqual({ open: true })
		} finally {
			console.warn = realWarn
		}
	})
})

describe('icons survive a re-render', () => {
	test('an $icon node keeps its glyph after the state-driven subtree swap', async () => {
		const { renderViewToString, Evaluator, Island: IslandCls } = await import('../src/index.js')
		const icons = {
			menu: { viewBox: '0 0 24 24', stroke: true, paths: ['M4 7h16M4 12h16M4 17h16'] }
		}
		const view = {
			tag: 'div',
			attrs: { 'data-open': '$open' },
			children: [
				{
					tag: 'button',
					attrs: { type: 'button', 'aria-expanded': '$open' },
					$icon: { name: 'menu' },
					$on: { click: { send: 'set-open', to: 'm', payload: { open: true } } }
				}
			]
		}
		const evaluator = new Evaluator()
		const html = await renderViewToString(
			view,
			{ open: false },
			{
				evaluate: (expr, data) => evaluator.evaluate(expr, data),
				icons
			}
		)
		expect(html).toContain('<svg')
		const container = document.createElement('div')
		container.innerHTML = html
		document.body.appendChild(container)
		/* Without the passthrough this island re-renders the button and
		   `renderIcon` against the empty default registry returns '' — the
		   hamburger silently vanishes on the first click. */
		const island = new IslandCls({ container, icons })
		await island.hydrate({
			view,
			state: { open: false },
			name: 'm',
			accepts: { 'set-open': { open: 'boolean' } }
		})
		container.querySelector('button')?.click()
		await Bun.sleep(0)
		expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
		expect(container.querySelector('button svg')).not.toBeNull()
	})
})
