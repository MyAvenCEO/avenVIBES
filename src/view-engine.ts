import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { type IconRegistry, renderIcon } from './icons.js'
import { HOST, type MessageCatalog, MessageRouter, resolveAddress, translate } from './messages.js'
import {
	BOOLEAN_ATTRS,
	SAFE_TAGS,
	sanitizeAttributeWhitelist,
	sanitizePayloadForValidation,
	URL_ATTRS
} from './security.js'
import { StyleEngine } from './style-engine.js'
import type { RenderData, StyleDef, UiEvent, UiEventDef, ViewDef, ViewNode } from './types.js'
import { expandUse, type UnitRegistry } from './unit.js'
import { Evaluator, validateViewDef } from './view-validator.js'

/**
 * Shared with the string renderer, so markdown means the same thing whether a
 * view is rendered into DOM or into a static file.
 */
export async function renderMarkdown(rawText: unknown): Promise<string> {
	if (rawText == null || typeof rawText !== 'string') return ''
	const html = await marked.parse(rawText)
	return DOMPurify.sanitize(String(html))
}

function setAttr(element: HTMLElement, name: string, value: unknown): void {
	if (value === undefined || value === null) return
	const lower = name.toLowerCase()
	if (URL_ATTRS.has(lower)) {
		const urlStr = String(value)
		if (/^(https?:|blob:|data:image\/|mailto:|tel:|\/|#)/.test(urlStr) || !urlStr.includes(':')) {
			element.setAttribute(name, sanitizeAttributeWhitelist(urlStr))
		}
		return
	}
	if (BOOLEAN_ATTRS.has(lower)) {
		const bool = Boolean(value)
		;(element as unknown as Record<string, boolean>)[name] = bool
		if (bool) element.setAttribute(name, '')
		else element.removeAttribute(name)
		return
	}
	const s = typeof value === 'boolean' ? String(value) : sanitizeAttributeWhitelist(value)
	element.setAttribute(name, s)
}

export type ViewEngineOptions = {
	onEvent?: (event: UiEvent) => void
	containerName?: string
	/** Units a `$use` may place. */
	units?: UnitRegistry
	/** Icons a `$icon` may draw. */
	icons?: IconRegistry
	/** The locale's copy, for `$t`. */
	messages?: MessageCatalog
	/** Shared with the caller so a host can register inboxes of its own. */
	router?: MessageRouter
}

type FocusSnapshot = {
	path: string
	selectionStart: number | null
	selectionEnd: number | null
}

export class ViewEngine {
	private readonly evaluator = new Evaluator()
	private readonly styleEngine = new StyleEngine()
	private onEvent?: (event: UiEvent) => void
	private containerName = 'aven-ui'
	private currentState: Record<string, unknown> = {}
	private units: UnitRegistry = {}
	private icons: IconRegistry = {}
	private messages: MessageCatalog = {}
	private router = new MessageRouter()

	configure(options: ViewEngineOptions): void {
		this.onEvent = options.onEvent
		this.containerName = options.containerName ?? 'aven-ui'
		this.units = options.units ?? {}
		this.icons = options.icons ?? {}
		this.messages = options.messages ?? {}
		if (options.router) this.router = options.router
		/* The surface outside the vibe is an inbox like any other, which is what
		   makes `$host` the default and keeps every pre-address view working. */
		this.router.setHost(options.onEvent)
	}

	/** The router, so a host can register its own inboxes against this vibe. */
	messageRouter(): MessageRouter {
		return this.router
	}

	async mount(
		container: HTMLElement,
		viewDef: ViewDef,
		state: Record<string, unknown>,
		style: StyleDef
	): Promise<ShadowRoot> {
		validateViewDef(viewDef)
		const shadowRoot = container.shadowRoot ?? container.attachShadow({ mode: 'open' })
		const styleSheets = await this.styleEngine.getStyleSheets(style, this.containerName)
		await this.render(viewDef, state, shadowRoot, styleSheets)
		return shadowRoot
	}

	async render(
		viewDef: ViewDef,
		state: Record<string, unknown>,
		shadowRoot: ShadowRoot,
		styleSheets: CSSStyleSheet[]
	): Promise<void> {
		const focus = this.captureFocus(shadowRoot)
		this.currentState = state
		shadowRoot.adoptedStyleSheets = styleSheets
		shadowRoot.innerHTML = ''
		const viewNode = viewDef.content ?? viewDef
		const data: RenderData = { state }
		const element = await this.renderNode(viewNode, data, '0')
		if (element) shadowRoot.appendChild(element)
		this.restoreFocus(shadowRoot, focus)
	}

	private captureFocus(shadowRoot: ShadowRoot): FocusSnapshot | null {
		const active =
			shadowRoot.activeElement ??
			(document.activeElement && shadowRoot.contains(document.activeElement)
				? document.activeElement
				: null)
		if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null
		const path = active.getAttribute('data-aven-path')
		if (!path) return null
		return {
			path,
			selectionStart: active.selectionStart,
			selectionEnd: active.selectionEnd
		}
	}

	private restoreFocus(shadowRoot: ShadowRoot, snapshot: FocusSnapshot | null): void {
		if (!snapshot) return
		const el = shadowRoot.querySelector(`[data-aven-path="${snapshot.path}"]`)
		if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
		el.focus()
		if (snapshot.selectionStart != null && snapshot.selectionEnd != null) {
			try {
				el.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd)
			} catch {
				// ignore for input types that reject selection ranges
			}
		}
	}
	private async renderNode(
		node: ViewNode,
		data: RenderData,
		path = '0'
	): Promise<HTMLElement | null> {
		if (!node) return null

		const rawTag = (node.tag || 'div').toLowerCase()
		const tag = SAFE_TAGS.has(rawTag) ? rawTag : 'div'
		const element = document.createElement(tag)
		element.setAttribute('data-aven-path', path)

		if (node.class) {
			const classValue = await this.evaluator.evaluate(node.class, data)
			if (classValue) element.className = sanitizeAttributeWhitelist(classValue)
		}

		if (node.attrs) {
			for (const [attrName, attrValue] of Object.entries(node.attrs)) {
				const resolved = await this.evaluator.evaluate(attrValue, data)
				setAttr(element, attrName, resolved)
			}
		}

		if (node.value !== undefined) {
			const resolvedValue = await this.evaluator.evaluate(node.value, data)
			if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
				const isFocused = document.activeElement === element
				if (!isFocused) {
					element.value = String(resolvedValue ?? '')
				}
			}
		}

		if (node.text !== undefined) {
			const textValue = await this.resolveText(node.text, data)
			const formatMd = node.format === 'md' || node.format === 'markdown'
			if (formatMd && (typeof textValue === 'string' || textValue == null)) {
				element.innerHTML = await renderMarkdown(String(textValue || ''))
			} else {
				element.textContent = String(textValue ?? '')
			}
		}

		if (node.$icon) {
			/* The markup comes from `renderIcon`, which builds every attribute
			   itself from validated geometry — the view supplied only a name. */
			element.innerHTML = renderIcon(node.$icon.name, this.icons, node.$icon)
		} else if (node.$use) {
			const placed = await this.renderUse(node, data, path)
			if (placed) element.appendChild(placed)
		} else if (node.$children) {
			element.appendChild(await this.renderChildren(node.$children, data, path))
		} else if (node.$each) {
			element.innerHTML = ''
			const fragment = await this.renderEach(node.$each, data, path)
			element.appendChild(fragment)
		} else if (node.children && !node.$each) {
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i]
				const childEl = await this.renderNode(child, data, `${path}.${i}`)
				if (childEl) element.appendChild(childEl)
			}
		}

		if (node.$on) {
			this.attachEvents(element, node.$on, data)
		}

		return element
	}

	/**
	 * A text value, which may be a message reference rather than an expression.
	 *
	 * `{ $t: 'pricing.cta' }` looks up the catalog; anything else evaluates as
	 * before. Interpolation values are evaluated first, so a message can carry a
	 * count that came from state.
	 */
	private async resolveText(text: unknown, data: RenderData): Promise<unknown> {
		if (text && typeof text === 'object' && '$t' in (text as object)) {
			const ref = text as { $t: string; values?: Record<string, unknown> }
			const values: Record<string, unknown> = {}
			for (const [k, v] of Object.entries(ref.values ?? {}))
				values[k] = await this.evaluator.evaluate(v, data)
			return translate(ref.$t, this.messages, values)
		}
		return this.evaluator.evaluate(text, data)
	}

	/**
	 * Place a unit: resolve its props in the CALLER's scope, then render it in
	 * its own.
	 *
	 * The order is the boundary. Props are expressions the parent wrote, so they
	 * must see the parent's state; everything inside the unit then sees only its
	 * own state and those resolved values.
	 */
	private async renderUse(
		node: ViewNode,
		data: RenderData,
		path: string
	): Promise<HTMLElement | null> {
		const use = node.$use
		if (!use) return null
		const resolved: Record<string, unknown> = {}
		for (const [name, expr] of Object.entries(use.props ?? {}))
			resolved[name] = await this.evaluator.evaluate(expr, data)
		const expanded = expandUse(use, this.units, data, resolved)
		return this.renderNode(expanded.node, expanded.data, `${path}~${use.unit}`)
	}

	/** Render the children a parent passed into a named slot. */
	private async renderChildren(
		name: string,
		data: RenderData,
		path: string
	): Promise<DocumentFragment> {
		const fragment = document.createDocumentFragment()
		const passed = data.slots?.[name]
		if (!passed) return fragment
		const nodes = Array.isArray(passed) ? passed : [passed]
		for (let i = 0; i < nodes.length; i++) {
			const el = await this.renderNode(nodes[i], data, `${path}.${name}.${i}`)
			if (el) fragment.appendChild(el)
		}
		return fragment
	}

	private async renderEach(
		eachDef: { items: string; template: ViewNode },
		data: RenderData,
		path: string
	): Promise<DocumentFragment> {
		const fragment = document.createDocumentFragment()
		const items = await this.evaluator.evaluate(eachDef.items, data)
		if (!items || !Array.isArray(items) || items.length === 0) return fragment

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const itemData: RenderData = { state: data.state, item, index: i }
			const itemElement = await this.renderNode(eachDef.template, itemData, `${path}.$each.${i}`)
			if (itemElement) fragment.appendChild(itemElement)
		}
		return fragment
	}

	private attachEvents(
		element: HTMLElement,
		events: Record<string, UiEventDef>,
		data: RenderData
	): void {
		for (const [eventName, eventDef] of Object.entries(events)) {
			element.addEventListener(eventName, (domEvent) => {
				if (eventName === 'submit') {
					domEvent.preventDefault()
				}
				const liveData: RenderData = {
					state: this.currentState,
					item: data.item,
					index: data.index
				}
				void this.deliverEvent(eventDef, liveData, element, domEvent)
			})
		}
	}

	private async deliverEvent(
		eventDef: UiEventDef,
		data: RenderData,
		sourceEl: HTMLElement,
		domEvent?: Event
	): Promise<void> {
		const payload = eventDef.payload
			? await this.resolvePayload(eventDef.payload, data, sourceEl, domEvent)
			: {}
		const sanitized = sanitizePayloadForValidation(payload)
		/* Routed by ADDRESS, not by tree position. An unaddressed message means
		   `$host`, so every view written before inboxes existed behaves as it
		   always did. */
		const selfId = sourceEl.getAttribute('data-aven-path') ?? HOST
		const parentId = selfId.includes('.') ? selfId.slice(0, selfId.lastIndexOf('.')) : null
		const address = resolveAddress(eventDef.to, selfId, parentId)
		await this.router.deliver(
			{ send: eventDef.send, payload: sanitized as Record<string, unknown> },
			address
		)
		if (domEvent?.type === 'submit' && sourceEl instanceof HTMLFormElement) {
			sourceEl.reset()
		}
	}

	private readFormField(form: HTMLFormElement, fieldName: string): string {
		const el = form.querySelector(`[data-aven-field="${fieldName}"]`)
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			return el.value
		}
		return ''
	}

	private async resolvePayload(
		payload: Record<string, unknown>,
		data: RenderData,
		sourceEl: HTMLElement,
		domEvent?: Event
	): Promise<Record<string, unknown>> {
		const result: Record<string, unknown> = {}
		const form = sourceEl instanceof HTMLFormElement ? sourceEl : null
		for (const [key, value] of Object.entries(payload)) {
			if (value === '$value') {
				const target = domEvent?.target
				if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
					result[key] = target.value
				} else if (
					sourceEl instanceof HTMLInputElement ||
					sourceEl instanceof HTMLTextAreaElement
				) {
					result[key] = sourceEl.value
				} else {
					result[key] = ''
				}
				continue
			}
			if (
				typeof value === 'string' &&
				value.startsWith('$field:') &&
				form &&
				domEvent?.type === 'submit'
			) {
				result[key] = this.readFormField(form, value.slice(7))
				continue
			}
			if (value === '$draft' && form && domEvent?.type === 'submit') {
				result[key] = this.readFormField(form, 'draft') || this.readFormField(form, '')
				if (result[key] === '') {
					const input = form.querySelector('input[type="text"], input:not([type]), textarea')
					if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
						result[key] = input.value
					}
				}
				continue
			}
			result[key] = await this.evaluator.evaluate(value, {
				state: this.currentState,
				item: data.item,
				index: data.index
			})
		}
		return result
	}
}
