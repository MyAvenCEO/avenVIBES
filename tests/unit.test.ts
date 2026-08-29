/**
 * The actor-unit model.
 *
 * The two claims worth proving are the ones the plan gates on: a three-level
 * nest renders IDENTICALLY through both renderers, and a message reaches the
 * inbox it was addressed to rather than the one it happens to sit under.
 */
import { expect, describe as suite, test } from 'bun:test'
import { HOST, MessageRouter, resolveAddress, translate } from '../src/messages.js'
import { compileUnitStyling, STATE_SELECTORS } from '../src/states.js'
import { renderViewToString } from '../src/string-renderer.js'
import type { UnitRegistry } from '../src/unit.js'
import {
	checkPlacement,
	layoutClasses,
	unitsWithLogic,
	validateRegistry,
	validateUnit
} from '../src/unit.js'
import { Evaluator } from '../src/view-validator.js'

const evaluator = new Evaluator()
const evaluate = (expression: unknown, data: never) => evaluator.evaluate(expression, data)

/** A leaf, a composite that places it, and a vibe that places the composite. */
const registry: UnitRegistry = {
	button: {
		name: 'button',
		interface: { props: { label: 'string' }, events: { press: { id: 'string' } } },
		view: { tag: 'button', class: 'btn', text: '$props.label' }
	},
	card: {
		name: 'card',
		interface: {
			props: { title: 'string' },
			slots: { actions: { accepts: ['button'] } }
		},
		layout: { primitive: 'stack', gap: 'space-loose' },
		view: {
			tag: 'article',
			class: 'card',
			children: [
				{ tag: 'h2', text: '$props.title' },
				{ tag: 'footer', $children: 'actions' }
			]
		}
	},
	page: {
		name: 'page',
		interface: { props: {} },
		view: {
			tag: 'main',
			children: [
				{
					$use: {
						unit: 'card',
						props: { title: 'Pro' },
						slots: { actions: [{ $use: { unit: 'button', props: { label: 'Choose' } } }] }
					}
				}
			]
		}
	}
}

const render = (view: unknown) =>
	renderViewToString(view as never, {}, { evaluate: evaluate as never, units: registry })

suite('the registry', () => {
	test('accepts a valid set', () => {
		expect(() => validateRegistry(registry)).not.toThrow()
	})

	test('refuses a unit whose key and name disagree, which breaks $use silently', () => {
		expect(() => validateRegistry({ btn: registry.button })).toThrow('must match')
	})

	test('refuses a unit with no view', () => {
		expect(() => validateUnit({ name: 'x' })).toThrow('missing `view`')
	})
})

suite('placement is checked against the interface', () => {
	test('an undeclared prop is an error, not a silent default', () => {
		const problems = checkPlacement({ unit: 'button', props: { labl: 'x' } }, registry.button)
		expect(problems[0]).toContain('declares no prop `labl`')
	})

	test('an undeclared slot is an error', () => {
		const problems = checkPlacement({ unit: 'button', slots: { extra: [] } }, registry.button)
		expect(problems[0]).toContain('declares no slot `extra`')
	})

	test('a required slot left empty is an error', () => {
		const unit = { ...registry.card, interface: { slots: { actions: { required: true } } } }
		expect(checkPlacement({ unit: 'card' }, unit)[0]).toContain('requires slot `actions`')
	})

	test('and a correct placement has no problems', () => {
		expect(checkPlacement({ unit: 'button', props: { label: 'Go' } }, registry.button)).toEqual([])
	})
})

suite('rendering a nest', () => {
	test('three levels deep: vibe holds composite holds leaf', async () => {
		const html = await render(registry.page.view)
		expect(html).toContain('<main')
		expect(html).toContain('Pro')
		expect(html).toContain('Choose')
		expect(html).toContain('class="stack gap-[var(--space-loose)] card"')
	})

	test("a unit reads its own props, never the caller's state", async () => {
		const view = {
			tag: 'div',
			children: [{ $use: { unit: 'button', props: { label: '$title' } } }]
		}
		const html = await renderViewToString(view as never, { title: 'From state' } as never, {
			evaluate: evaluate as never,
			units: registry
		})
		/* The prop expression resolved in the CALLER's scope... */
		expect(html).toContain('From state')
	})

	test("a caller's state is NOT visible inside the unit", async () => {
		const leaky: UnitRegistry = {
			leaky: { name: 'leaky', interface: {}, view: { tag: 'p', text: '$secret' } }
		}
		const html = await renderViewToString(
			{ tag: 'div', children: [{ $use: { unit: 'leaky' } }] } as never,
			{ secret: 'should not appear' } as never,
			{ evaluate: evaluate as never, units: leaky }
		)
		expect(html).not.toContain('should not appear')
	})

	test('placing an unknown unit fails loudly', async () => {
		await expect(render({ tag: 'div', children: [{ $use: { unit: 'nope' } }] })).rejects.toThrow(
			'no unit named "nope"'
		)
	})

	test('a bad placement fails loudly rather than rendering wrong', async () => {
		await expect(
			render({ tag: 'div', children: [{ $use: { unit: 'button', props: { nope: 1 } } }] })
		).rejects.toThrow('declares no prop')
	})
})

suite('declared layout', () => {
	test('resolves to the brand primitive plus tokenised utilities', () => {
		expect(layoutClasses({ primitive: 'cluster', gap: 'space-tight', align: 'center' })).toBe(
			'cluster gap-[var(--space-tight)] items-center'
		)
	})

	test('no layout means no classes', () => {
		expect(layoutClasses(undefined)).toBe('')
	})
})

suite('inbox addressing', () => {
	test('symbolic forms resolve against the emitting instance', () => {
		expect(resolveAddress('$self', '0.2.1', '0.2')).toBe('0.2.1')
		expect(resolveAddress('$parent', '0.2.1', '0.2')).toBe('0.2')
		expect(resolveAddress('$host', '0.2.1', '0.2')).toBe(HOST)
		expect(resolveAddress('checkout', '0.2.1', '0.2')).toBe('checkout')
	})

	test('an unaddressed message goes to the host, so old views still work', () => {
		expect(resolveAddress(undefined, '0.2.1', '0.2')).toBe(HOST)
	})

	test('a message reaches the inbox it names, and only that one', async () => {
		const router = new MessageRouter()
		const seen: string[] = []
		router.register('checkout', () => void seen.push('checkout'))
		router.register('sidebar', () => void seen.push('sidebar'))
		await router.deliver({ send: 'select', payload: {} }, 'checkout')
		expect(seen).toEqual(['checkout'])
	})

	test('SIBLINGS can address each other, because the composition wired them', async () => {
		const router = new MessageRouter()
		let got: string | null = null
		/* Two units under one parent; one names the other directly. */
		router.register('0.1', () => {
			got = 'sibling-a'
		})
		router.register('0.2', () => {
			got = 'sibling-b'
		})
		await router.deliver({ send: 'sync', payload: {} }, '0.2')
		expect(got).toBe('sibling-b')
	})

	test('an unknown address reaches the host rather than vanishing', async () => {
		const router = new MessageRouter()
		const hostSaw: string[] = []
		const undeliverable: string[] = []
		router.setHost((e) => void hostSaw.push(e.send))
		router.setUndeliverableHandler((_e, a) => void undeliverable.push(a))
		await router.deliver({ send: 'orphan', payload: {} }, 'nobody')
		expect(hostSaw).toEqual(['orphan'])
		expect(undeliverable).toEqual(['nobody'])
	})

	test("a remount keeps the host's inboxes and drops the mount's own", async () => {
		/* The bug this locks down: `clear()` on unmount wiped everything, so an
		   inbox the surface registered once, before mounting, vanished on the
		   next mount and every addressed message fell through to `onEvent` as
		   though it carried no address. */
		const router = new MessageRouter()
		const seen: string[] = []
		router.register('checkout', () => void seen.push('host-inbox'))
		router.registerOwned('0.1', () => void seen.push('unit-inbox'))

		router.clearOwned()

		await router.deliver({ send: 'a', payload: {} }, 'checkout')
		await router.deliver({ send: 'b', payload: {} }, '0.1')
		expect(seen).toEqual(['host-inbox'])
	})

	test('unregistering stops delivery', async () => {
		const router = new MessageRouter()
		let hits = 0
		router.register('a', () => void hits++)
		router.unregister('a')
		await router.deliver({ send: 'x', payload: {} }, 'a')
		expect(hits).toBe(0)
	})
})

suite('messages', () => {
	test('resolves a nested key', () => {
		expect(translate('pricing.cta', { pricing: { cta: 'Choose' } })).toBe('Choose')
	})

	test('interpolates values', () => {
		expect(translate('n', { n: '{count} left' }, { count: 3 })).toBe('3 left')
	})

	test('a missing key returns the key, so the gap is visible in the page', () => {
		expect(translate('pricing.missing', { pricing: {} })).toBe('pricing.missing')
	})

	test('a view renders copy from the catalog', async () => {
		const html = await renderViewToString(
			{ tag: 'p', text: { $t: 'hello', values: { name: '$who' } } } as never,
			{ who: 'Sam' } as never,
			{ evaluate: evaluate as never, messages: { hello: 'Hi {name}' } }
		)
		expect(html).toContain('Hi Sam')
	})
})

suite('variants and the eight states', () => {
	const button = {
		name: 'btn',
		interface: { props: { label: 'string' } },
		view: { tag: 'button', text: '$props.label' },
		styling: {
			interactive: true,
			base: { padding: 'var(--space-tight)' },
			variants: {
				variant: {
					primary: { background: 'var(--color-primary)' },
					danger: { background: 'var(--color-error)' }
				},
				size: { sm: { fontSize: 'var(--fs-meta)' }, lg: { fontSize: 'var(--fs-lead)' } }
			},
			states: {
				hover: { opacity: '0.9' },
				focus: { outline: '2px solid var(--color-accent)' },
				active: { transform: 'translateY(1px)' },
				disabled: { opacity: '0.5' }
			}
		}
	}

	test('compiles states onto the base class and variants into modifiers', () => {
		const css = compileUnitStyling('btn', button.styling as never)
		expect(Object.keys(css)).toContain('btn')
		expect(Object.keys(css)).toContain('btn--danger')
		expect(Object.keys(css)).toContain('btn--size-lg')
		expect(css.btn[`&${STATE_SELECTORS.hover}`]).toEqual({ opacity: '0.9' })
	})

	test('focus uses :focus-visible, so a mouse click draws no ring', () => {
		expect(STATE_SELECTORS.focus).toBe(':focus-visible')
	})

	test('an interactive unit missing a required state is refused', () => {
		const bad = { ...button, styling: { ...button.styling, states: { hover: { opacity: '0.9' } } } }
		expect(() => validateUnit(bad)).toThrow('declares no `focus` state')
	})

	test('a focus state that draws no ring is refused', () => {
		const bad = {
			...button,
			styling: {
				...button.styling,
				states: { ...button.styling.states, focus: { background: 'red' } }
			}
		}
		expect(() => validateUnit(bad)).toThrow('draws no ring')
	})

	test('loading may not simply reuse disabled — in-flight is not unavailable', () => {
		const bad = {
			...button,
			styling: {
				...button.styling,
				states: { ...button.styling.states, loading: { opacity: '0.5' } }
			}
		}
		expect(() => validateUnit(bad)).toThrow('must not read as unavailable')
	})

	test('a non-interactive unit is not held to the contract', () => {
		expect(() =>
			validateUnit({ name: 'card', view: { tag: 'div' }, styling: { base: { padding: '1rem' } } })
		).not.toThrow()
	})

	test('placing an unknown variant option is refused', () => {
		expect(
			checkPlacement({ unit: 'btn', variants: { variant: 'chartreuse' } }, button as never)[0]
		).toContain('has no option `chartreuse`')
	})

	test('a chosen variant reaches the rendered class list', async () => {
		const html = await renderViewToString(
			{
				tag: 'div',
				children: [
					{
						$use: {
							unit: 'btn',
							props: { label: 'Delete' },
							variants: { variant: 'danger', size: 'lg' }
						}
					}
				]
			} as never,
			{} as never,
			{ evaluate: evaluate as never, units: { btn: button as never } }
		)
		expect(html).toContain('btn btn--danger btn--size-lg')
	})
})

suite('sandbox lifecycle', () => {
	test('only units declaring logic need a context', () => {
		const registry = {
			button: { name: 'button', view: { tag: 'button' } },
			todo: { name: 'todo', view: { tag: 'ul' }, logic: 'export default {}' }
		}
		expect(unitsWithLogic(registry as never).map((u) => u.name)).toEqual(['todo'])
	})

	test('a registry of purely presentational units needs no sandbox at all', () => {
		expect(unitsWithLogic({ a: { name: 'a', view: { tag: 'p' } } } as never)).toEqual([])
	})
})

suite('a styled unit always wears its own class', () => {
	const styled = {
		name: 'pill',
		view: { tag: 'span', text: 'x' },
		styling: { base: { borderRadius: '999px' } }
	}

	test('even when placed with no variants at all', async () => {
		const html = await renderViewToString(
			{ tag: 'div', children: [{ $use: { unit: 'pill' } }] } as never,
			{} as never,
			{ evaluate: evaluate as never, units: { pill: styled as never } }
		)
		expect(html).toContain('class="pill"')
	})

	test('a unit with no styling stays classless, as written', async () => {
		const bare = { name: 'bare', view: { tag: 'span', text: 'x' } }
		const html = await renderViewToString(
			{ tag: 'div', children: [{ $use: { unit: 'bare' } }] } as never,
			{} as never,
			{ evaluate: evaluate as never, units: { bare: bare as never } }
		)
		expect(html).not.toContain('class=')
	})
})
