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
import { wireInboxes } from './inboxes.js'
import { MessageRouter } from './messages.js'
import { StateStore } from './state-store.js'
import type { UiBundle, UiEvent, VibeEngineOptions } from './types.js'
import type { SandboxHost, UnitInstance } from './unit.js'
import { ViewEngine } from './view-engine.js'

export class VibeEngine {
	private readonly container: HTMLElement
	private readonly onEvent?: (event: UiEvent) => void
	private readonly containerName: string
	private readonly viewEngine = new ViewEngine()
	private readonly router = new MessageRouter()
	private readonly sandbox?: SandboxHost
	private instances = new Map<string, UnitInstance>()
	private readonly stateStore = new StateStore()
	private shadowRoot: ShadowRoot | null = null
	private bundle: UiBundle | null = null
	private unsubState: (() => void) | null = null

	constructor(options: VibeEngineOptions) {
		this.container = options.container
		this.onEvent = options.onEvent
		this.containerName = options.containerName ?? 'aven-vibes'
		this.sandbox = options.sandbox
	}

	async mount(bundle: UiBundle): Promise<void> {
		await this.unmount()
		this.bundle = bundle
		this.stateStore.set(bundle.state)
		this.viewEngine.configure({
			onEvent: this.onEvent,
			containerName: this.containerName,
			units: bundle.units,
			messages: bundle.messages,
			router: this.router
		})
		await this.startInboxes(bundle)
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

	/**
	 * Register every actor's inbox, and start a sandbox only where `logic`
	 * demands one.
	 *
	 * This replaces `startLogic`, whose first line was `if (!this.sandbox)
	 * return` — reception gated on the runtime, so a surface with no QuickJS
	 * had no addressable units at all. The wiring now lives in `inboxes.ts`,
	 * shared with `Island`, and splits the tiers: an `accepts` contract gets a
	 * declarative inbox for the cost of a Map entry; only `logic` needs the
	 * sandbox, and a missing sandbox silences that one unit loudly instead of
	 * every unit silently.
	 *
	 * Addressed by NAME rather than by instance path, because an inbox-bearing
	 * unit is a singleton actor within a vibe — a todo list, a chat, a checkout
	 * — and the composition addresses it as `todo`, not as `0.2.1`.
	 * Per-instance actors, if they are ever needed, would register under the
	 * path instead; the router does not care which.
	 */
	private async startInboxes(bundle: UiBundle): Promise<void> {
		const wired = await wireInboxes({
			bundle,
			router: this.router,
			sandbox: this.sandbox,
			updateState: (partial) => this.updateState(partial),
			getState: () => this.getState()
		})
		this.instances = wired.instances
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
		for (const instance of this.instances.values()) await instance.dispose()
		this.instances.clear()
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
	type IconDef,
	type IconPath,
	type IconRegistry,
	renderIcon,
	validateIcon,
	validateIconRegistry
} from './icons.js'
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
export {
	checkStateContract,
	compileUnitStyling,
	REQUIRED_INTERACTIVE_STATES,
	STATE_SELECTORS,
	type StateName,
	type UnitStyling,
	variantClasses
} from './states.js'
export { renderViewToString, type StringRenderOptions } from './string-renderer.js'
export { validateStyleDef } from './style-validator.js'
export type {
	StyleDef,
	UiBundle,
	UiEvent,
	ViewDef,
	ViewNode
} from './types.js'
export {
	checkPlacement,
	expandUse,
	type LayoutDef,
	layoutClasses,
	registryStyles,
	type UnitDef,
	type UnitInterface,
	type UnitRegistry,
	type UseDef,
	unitsWithInbox,
	unitsWithLogic,
	validateRegistry,
	validateUnit
} from './unit.js'
export { Island, type IslandOptions } from './island.js'
export { type InboxWiringOptions, type WiredInboxes, wireInboxes } from './inboxes.js'
/**
 * The expression evaluator, and the reason it is exported.
 *
 * `renderViewToString` takes an `evaluate` function and the package shipped
 * none, so the one thing every static consumer needs — turning `$props.label`
 * into a value — was sealed behind the export map. Every caller either wrote
 * its own resolver, which then disagreed with the DOM renderer's, or could not
 * render at all. Found by trying to use the published package from outside.
 */
export { Evaluator, validateViewDef } from './view-validator.js'
export { VibeEngine as default }
