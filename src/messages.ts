/**
 * INBOXES — how units talk to each other.
 *
 * Not DOM bubbling, and deliberately not. Bubbling routes by tree position, so
 * where a piece SITS decides who hears it, and moving a card into a different
 * column silently changes its behaviour. Actors route by ADDRESS: a message
 * names its recipient, and one router delivers it.
 *
 * The rule that keeps this from becoming spaghetti is not a restriction on who
 * may talk to whom — it is where the wiring lives. A reusable unit never names
 * a concrete inbox inside its own definition; `to` is a value passed in when
 * the unit is PLACED. So a button does not know it belongs to a pricing page.
 * The pricing page's composition says so, and the whole topology is readable
 * in that one file rather than distributed across the units.
 *
 * Four symbolic forms resolve at mount:
 *
 *   $self     the unit that emitted it, for its own state
 *   $parent   the composite that placed it
 *   $host     the surface bus outside the vibe — app-level concerns
 *   <name>    any inbox by name, including a sibling
 *
 * Siblings addressing each other directly is allowed and normal, because their
 * shared composition declared the wiring.
 */
import type { UiEvent } from './types.js'

/** Where a message is going, once the symbolic form is resolved. */
export type Address = string

/** What an inbox does with a message. */
export type Inbox = (event: UiEvent) => void | Promise<void>

/** The symbolic forms a `to` may use before it is resolved. */
export const SELF = '$self'
export const PARENT = '$parent'
export const HOST = '$host'

/**
 * Resolve a symbolic address against the instance that is emitting.
 *
 * Instance ids are paths (`0.2.1`), so `$parent` is a string operation rather
 * than a tree walk — the address of the composite that placed this unit is
 * already encoded in where it sits.
 */
export function resolveAddress(
	to: string | undefined,
	selfId: Address,
	parentId: Address | null
): Address {
	if (!to || to === HOST) return HOST
	if (to === SELF) return selfId
	if (to === PARENT) return parentId ?? HOST
	return to
}

/**
 * The router: one delivery path for every message in a vibe.
 *
 * Undeliverable messages go to the host rather than being dropped. A message
 * addressed to an inbox that does not exist is a wiring mistake, and silently
 * swallowing it is how those stay hidden for weeks — the host at least sees it,
 * and `onUndeliverable` lets a caller make it loud.
 */
export class MessageRouter {
	private readonly inboxes = new Map<Address, Inbox>()
	/**
	 * Which addresses the ENGINE registered, as opposed to the host.
	 *
	 * The distinction earns its place on remount. A surface registers its own
	 * inboxes once, when it sets the vibe up; the engine registers one per
	 * logic-bearing unit instance, and those must go when the view is torn down
	 * or a remount would deliver into a dead instance. Clearing everything
	 * instead — which is what this did first — silently unregistered the host's
	 * inboxes on the next mount, and every addressed message fell through to
	 * `onEvent` as though it had no address at all.
	 */
	private readonly owned = new Set<Address>()
	private host?: Inbox
	private onUndeliverable?: (event: UiEvent, address: Address) => void

	/** Give the surface outside the vibe its inbox. */
	setHost(inbox: Inbox | undefined): void {
		this.host = inbox
	}

	/** Called when a message names an inbox nobody registered. */
	setUndeliverableHandler(fn: (event: UiEvent, address: Address) => void): void {
		this.onUndeliverable = fn
	}

	/** Register an inbox that outlives any single mount. For hosts. */
	register(address: Address, inbox: Inbox): void {
		this.inboxes.set(address, inbox)
	}

	/**
	 * Register a unit instance's inbox, owned by the current mount.
	 *
	 * Only units declaring `logic` get one — a button emits, it does not
	 * receive.
	 */
	registerOwned(address: Address, inbox: Inbox): void {
		this.inboxes.set(address, inbox)
		this.owned.add(address)
	}

	/** Drop an instance's inbox when it unmounts, so it cannot receive again. */
	unregister(address: Address): void {
		this.inboxes.delete(address)
	}

	/** Every registered address, for diagnostics and for the docs surface. */
	addresses(): Address[] {
		return [...this.inboxes.keys()]
	}

	/**
	 * Deliver one message.
	 *
	 * A message addressed to an inbox that exists goes there and stops. Anything
	 * else reaches the host, which is what makes `$host` the default and what
	 * keeps every view written before addresses existed working unchanged.
	 */
	async deliver(event: UiEvent, address: Address): Promise<void> {
		if (address !== HOST) {
			const inbox = this.inboxes.get(address)
			if (inbox) {
				await inbox(event)
				return
			}
			this.onUndeliverable?.(event, address)
		}
		await this.host?.({ ...event, to: address })
	}

	/**
	 * Drop the inboxes this mount created, keeping the host's own.
	 *
	 * Called when a vibe unmounts, including the implicit unmount at the start
	 * of every mount.
	 */
	clearOwned(): void {
		for (const address of this.owned) this.inboxes.delete(address)
		this.owned.clear()
	}

	/** Forget everything, host included. For tearing a surface down entirely. */
	clear(): void {
		this.inboxes.clear()
		this.owned.clear()
		this.host = undefined
	}
}

/* ── Messages, for the i18n primitive ───────────────────────────────────── */

/** A locale's copy: `key -> string`, flat or nested. */
export type MessageCatalog = Record<string, unknown>

/**
 * Resolve `{ $t: 'key' }` against a catalog, with ICU-style interpolation.
 *
 * A view never carries display copy directly. That is not tidiness: the same
 * unit has to render in every locale, and a string baked into a view is a unit
 * that only works in one. `$t` keeps the view structural and the words data.
 *
 * A missing key returns the key itself rather than an empty string, so a gap in
 * a catalog shows up as visible nonsense in the page instead of a blank space
 * nobody notices.
 */
export function translate(
	key: string,
	catalog: MessageCatalog,
	values: Record<string, unknown> = {}
): string {
	const parts = key.split('.')
	let node: unknown = catalog
	for (const part of parts) {
		if (node && typeof node === 'object' && part in (node as object)) {
			node = (node as Record<string, unknown>)[part]
		} else {
			return key
		}
	}
	if (typeof node !== 'string') return key
	return node.replace(/\{(\w+)\}/g, (whole, name: string) =>
		name in values ? String(values[name]) : whole
	)
}
