/**
 * aven-vibes — a vibe is a complete little app: view, style, state and logic.
 *
 * The engine takes that bundle and renders it into a shadow root, isolated from
 * the page around it. The view is data rather than markup, so the same bundle
 * can be rendered to DOM in a browser or to a string at build time; the logic
 * runs sandboxed, so a vibe can be authored, shipped and even generated without
 * handing it the run of your application.
 *
 * Nothing here knows about any particular brand or product. Tokens are injected
 * through the bundle's style, so the framework is the same wherever it runs.
 */
import { MessageRouter } from './messages.js'
import { StateStore } from './state-store.js'
import type { UiBundle, UiEvent, VibeEngineOptions } from './types.js'
import { ViewEngine } from './view-engine.js'

export class VibeEngine {
	private readonly container: HTMLElement
	private readonly onEvent?: (event: UiEvent) => void
	private readonly containerName: string
	private readonly viewEngine = new ViewEngine()
	private readonly router = new MessageRouter()
	private readonly stateStore = new StateStore()
	private shadowRoot: ShadowRoot | null = null
	private bundle: UiBundle | null = null
	private unsubState: (() => void) | null = null

	constructor(options: VibeEngineOptions) {
		this.container = options.container
		this.onEvent = options.onEvent
		this.containerName = options.containerName ?? 'aven-vibes'
	}

	async mount(bundle: UiBundle): Promise<void> {
		await this.unmount()
		this.bundle = bundle
		this.stateStore.set(bundle.state)
		this.viewEngine.configure({
			onEvent: this.onEvent,
			slots: bundle.slots,
			containerName: this.containerName,
			units: bundle.units,
			messages: bundle.messages,
			router: this.router
		})
		this.shadowRoot = await this.viewEngine.mount(
			this.container,
			bundle.view,
			bundle.state,
			bundle.style
		)
		this.unsubState = this.stateStore.subscribe((state) => {
			void this.rerender(state)
		})
	}

	async replaceState(state: Record<string, unknown>): Promise<void> {
		this.stateStore.set(state)
	}

	async updateState(partial: Record<string, unknown>): Promise<void> {
		this.stateStore.patch(partial)
	}

	getState(): Record<string, unknown> {
		return this.stateStore.get()
	}

	getBundle(): UiBundle | null {
		return this.bundle
	}

	/**
	 * The router this vibe's messages travel through.
	 *
	 * Exposed so the surface hosting the vibe can register inboxes of its own —
	 * an app-level actor a unit addresses by name, rather than everything having
	 * to funnel through `onEvent`.
	 */
	messageRouter(): MessageRouter {
		return this.router
	}

	async unmount(): Promise<void> {
		this.router.clearOwned()
		this.unsubState?.()
		this.unsubState = null
		if (this.shadowRoot) {
			this.shadowRoot.innerHTML = ''
		}
		this.shadowRoot = null
		this.bundle = null
	}

	private async rerender(state: Record<string, unknown>): Promise<void> {
		if (!this.bundle || !this.shadowRoot) return
		await this.viewEngine.render(
			this.bundle.view,
			state,
			this.shadowRoot,
			this.shadowRoot.adoptedStyleSheets
		)
	}
}

export {
	type Address,
	HOST,
	type Inbox,
	type MessageCatalog,
	MessageRouter,
	PARENT,
	resolveAddress,
	SELF,
	translate
} from './messages.js'
export { StateStore } from './state-store.js'
export { renderViewToString, type StringRenderOptions } from './string-renderer.js'
export { validateStyleDef } from './style-validator.js'
export type {
	InterfaceDef,
	SlotRegistry,
	StyleDef,
	UiBundle,
	UiEvent,
	UiFixtureShell,
	ViewDef,
	ViewNode
} from './types.js'
export {
	checkPlacement,
	expandUse,
	type LayoutDef,
	layoutClasses,
	type UnitDef,
	type UnitInterface,
	type UnitRegistry,
	type UseDef,
	validateRegistry,
	validateUnit
} from './unit.js'
export { validateViewDef } from './view-validator.js'
export { VibeEngine as default }
