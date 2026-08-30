/**
 * INBOX WIRING — where every actor gets its address, and only some get a runtime.
 *
 * This used to live inside `VibeEngine.startLogic`, and its first line was
 * `if (!this.sandbox) return`. That one line fused two facts that differ by
 * orders of magnitude: registering an inbox is a Map entry, starting a sandbox
 * is a QuickJS context — and gating the cheap one on the expensive one meant
 * that on a surface with no sandbox configured, no unit could receive a
 * message at all. A whole marketing site's worth of actors, mute, because
 * nobody had wired a runtime none of them needed.
 *
 * The model this module implements instead:
 *
 *   UNIT   the class — a definition in the registry
 *   ACTOR  an instance with an address and a declared inbox (`accepts`)
 *
 * Three handlers can serve an inbox, in ascending cost:
 *
 *   declarative   the engine merges the payload into the actor's state slice.
 *                 No code runs. This is the default, and it is what most
 *                 interactive units need — open a menu, pick a tab, set a
 *                 field. `{ send: 'set-open', payload: { open: true } }` is a
 *                 complete behaviour.
 *   sandbox       the unit declares `logic`, and a SandboxHost runs it. The
 *                 reply replaces the actor's state slice. This is for real
 *                 branching — a checkout, a name check — and it is the ONLY
 *                 tier that needs the sandbox.
 *   host          no `accepts` at all: messages fall through to the surface,
 *                 which is what keeps every pre-address view working.
 *
 * The inbox is a CONTRACT, not a funnel: a message whose name the actor did
 * not declare is refused to the undeliverable handler rather than half
 * applied. A typo'd `send` that silently patches nothing is the JSON-UI
 * equivalent of the ignored prop, and it is caught the same way — loudly.
 */

import type { ActorInstance, SandboxHost } from './actor.js'
import { actorsWithInbox } from './actor.js'
import type { MessageRouter } from './messages.js'
import type { Vibe } from './types.js'

export type InboxWiringOptions = {
	bundle: Vibe
	router: MessageRouter
	sandbox?: SandboxHost
	/** Patch a slice of the vibe state; the engine's own `updateState`. */
	updateState: (partial: Record<string, unknown>) => Promise<void>
	/** Read the current vibe state, for the declarative merge. */
	getState: () => Record<string, unknown>
}

/** What `wireInboxes` started, so the caller can tear it down symmetrically. */
export type WiredInboxes = {
	instances: Map<string, ActorInstance>
}

/** Does the contract name this message? The refusal itself goes through `router.refuse`. */
function accepted(contract: Record<string, Record<string, string>>, send: string): boolean {
	return send in contract
}

export async function wireInboxes(options: InboxWiringOptions): Promise<WiredInboxes> {
	const { bundle, router, sandbox, updateState, getState } = options
	const instances = new Map<string, ActorInstance>()

	/* The root is an actor too. A menu island whose state holds `open` must be
	   addressable without the host learning its internals. */
	if (bundle.name && bundle.accepts) {
		const contract = bundle.accepts
		const address = bundle.name
		router.registerOwned(address, async (event) => {
			if (!accepted(contract, event.send)) {
				await router.refuse(event, address)
				return
			}
			await updateState(event.payload)
		})
	}

	for (const unit of actorsWithInbox(bundle.units ?? {})) {
		const contract = unit.interface?.accepts ?? {}

		if (unit.logic) {
			/* The sandbox tier. Missing runtime is a wiring error worth hearing
			   about once, not a reason to silence every other actor — so THIS
			   unit is skipped loudly and the loop continues. */
			if (!sandbox) {
				console.warn(
					`[aven-vibes] unit "${unit.name}" declares logic but no SandboxHost was supplied — ` +
						`its inbox is not registered; messages to it will reach the host as undeliverable.`
				)
				continue
			}
			const instance = await sandbox.start({
				unit,
				address: unit.name,
				initialState: unit.state ?? {}
			})
			instances.set(unit.name, instance)
			router.registerOwned(unit.name, async (event) => {
				if (!accepted(contract, event.send)) {
					await router.refuse(event, unit.name)
					return
				}
				const next = await instance.send({ send: event.send, payload: event.payload })
				/* A unit's logic owns its own state, so what comes back replaces
				   that unit's slice and nothing else. */
				if (next) await updateState({ [unit.name]: next })
			})
			continue
		}

		/* The declarative tier: the engine is the handler. The payload merges
		   into the unit's slice — never replaces it, because a message that sets
		   `open` must not erase a `label` that arrived at mount. */
		router.registerOwned(unit.name, async (event) => {
			if (!accepted(contract, event.send)) {
				await router.refuse(event, unit.name)
				return
			}
			const current = getState()[unit.name]
			const slice = current && typeof current === 'object' ? (current as object) : {}
			await updateState({ [unit.name]: { ...slice, ...event.payload } })
		})
	}

	return { instances }
}
