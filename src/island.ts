/**
 * THE ISLAND — a vibe hydrated into markup a build already wrote.
 *
 * `VibeEngine` owns its surface: it renders into a shadow root, adopts its own
 * stylesheets, and everything inside is its DOM. An island is the opposite
 * arrangement, and it is what a prerendered site needs: the markup was written
 * at BUILD time by `renderViewToString`, it sits in the page's light DOM,
 * styled by the page's own brand stylesheet, indexed by anything that reads
 * the file — and this class arrives afterwards to attach the behaviour.
 *
 * The contract between the two moments is `data-aven-path`. The string
 * renderer stamps it on every node; the hydrator re-walks the same definition,
 * computes the same paths, and attaches `$on` listeners to the elements the
 * build wrote. Nothing is created, diffed or re-rendered at hydration — which
 * is why an island costs kilobytes where a framework costs hundreds.
 *
 * State changes re-render the island's subtree IN PLACE: the tree is rebuilt
 * from the definition and swapped for the old one, with focus captured and
 * restored by path, exactly as the shadow-root engine does across a render.
 * The swap is scoped to the island — the page around it is static and never
 * touched. By the time a state change can happen, the island is interactive;
 * the build's HTML has already done its job.
 *
 * What an island deliberately does NOT have: a shadow root (the page's CSS is
 * the point), and any styling responsibility (an island's bundle carries no
 * `style`; the brand stylesheet was compiled at build time). It shares the
 * inbox wiring with `VibeEngine`, so a unit that works in a vibe works on an
 * island unchanged — declarative inboxes without a sandbox, sandboxed logic
 * when a host is supplied.
 */
import { wireInboxes } from './inboxes.js'
import { MessageRouter } from './messages.js'
import { StateStore } from './state-store.js'
import type { UiBundle, UiEvent } from './types.js'
import type { SandboxHost, UnitInstance } from './unit.js'
import { ViewEngine } from './view-engine.js'

export type IslandOptions = {
	/** The element CONTAINING the build-rendered markup (the `[data-aven-path="0"]` root sits inside it). */
	container: HTMLElement
	/** The surface's inbox — where `$host` and undeliverable messages land. */
	onEvent?: (event: UiEvent) => void
	/** Supplied only when a unit on this island declares `logic`. */
	sandbox?: SandboxHost
	/** Icons the view's `$icon` nodes draw — required for any re-render to keep its glyphs. */
	icons?: import('./icons.js').IconRegistry
}

export class Island {
	private readonly container: HTMLElement
	private readonly onEvent?: (event: UiEvent) => void
	private readonly sandbox?: SandboxHost
	private readonly icons?: import('./icons.js').IconRegistry
	private readonly viewEngine = new ViewEngine()
	private readonly router = new MessageRouter()
	private readonly stateStore = new StateStore()
	private instances = new Map<string, UnitInstance>()
	private bundle: Omit<UiBundle, 'style'> | null = null
	private unsubState: (() => void) | null = null

	constructor(options: IslandOptions) {
		this.container = options.container
		this.onEvent = options.onEvent
		this.sandbox = options.sandbox
		this.icons = options.icons
	}

	/**
	 * Attach behaviour to the markup already in the container.
	 *
	 * Returns the number of listeners attached, because a hydration that
	 * attached zero is almost always a path mismatch between build and client —
	 * a different bundle, a stale build — and the caller should be able to
	 * notice without diffing DOM.
	 */
	async hydrate(bundle: Omit<UiBundle, 'style'>): Promise<number> {
		await this.dispose()
		this.bundle = bundle
		this.stateStore.set(bundle.state)
		this.viewEngine.configure({
			onEvent: this.onEvent,
			units: bundle.units,
			icons: this.icons,
			messages: bundle.messages,
			router: this.router
		})
		const wired = await wireInboxes({
			bundle: bundle as UiBundle,
			router: this.router,
			sandbox: this.sandbox,
			updateState: (partial) => {
				this.stateStore.patch(partial)
				return Promise.resolve()
			},
			getState: () => this.stateStore.get()
		})
		this.instances = wired.instances
		const attached = await this.viewEngine.hydrate(this.container, bundle.view, bundle.state)
		this.unsubState = this.stateStore.subscribe((state) => {
			void this.rerender(state)
		})
		return attached
	}

	getState(): Record<string, unknown> {
		return this.stateStore.get()
	}

	async updateState(partial: Record<string, unknown>): Promise<void> {
		this.stateStore.patch(partial)
	}

	/** The router, so the surface can register inboxes of its own beside the island's. */
	messageRouter(): MessageRouter {
		return this.router
	}

	/**
	 * Swap the island's subtree for a freshly rendered one.
	 *
	 * The build's element at path `0` is replaced wholesale. Focus is carried
	 * across by path: the same mechanism the shadow-root engine uses, applied
	 * against the document because an island lives in light DOM.
	 */
	private async rerender(state: Record<string, unknown>): Promise<void> {
		if (!this.bundle) return
		const current = this.container.querySelector('[data-aven-path="0"]')
		if (!current) return
		const focusPath =
			document.activeElement instanceof HTMLElement &&
			this.container.contains(document.activeElement)
				? document.activeElement.getAttribute('data-aven-path')
				: null
		const next = await this.viewEngine.renderTree(this.bundle.view, state)
		if (!next) return
		current.replaceWith(next)
		if (focusPath) {
			const el = this.container.querySelector(`[data-aven-path="${CSS.escape(focusPath)}"]`)
			if (el instanceof HTMLElement) el.focus()
		}
	}

	async dispose(): Promise<void> {
		this.router.clearOwned()
		for (const instance of this.instances.values()) await instance.dispose()
		this.instances.clear()
		this.unsubState?.()
		this.unsubState = null
		this.bundle = null
	}
}
