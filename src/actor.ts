/**
 * THE UNIT — one schema for a vibe, a composite and a leaf.
 *
 * The engine could already repeat a node (`$each`) and inject a named view — a
 * registry lookup that rendered a fixed view with the SAME data as its host.
 * That is composition of a kind, and it was not enough: what a design system
 * needs constantly is to hand a piece some values and some children and get a
 * different instance of it back. So a button that differed by label was a
 * second view, a card that differed by variant was a second view, and the only
 * way to build a real library was to stop using the engine and write Svelte.
 *
 * `$use` replaces that mechanism outright rather than sitting beside it. Two
 * ways to compose is how a codebase ends up with both, forever.
 *
 * A unit fixes that, and it is deliberately ONE type rather than three:
 *
 *   LEAF        a unit whose interface declares no slots
 *   COMPOSITE   a unit with slots, which accept other units, without limit
 *   VIBE        the root composite, plus a manifest naming it and injecting
 *               the theme
 *
 * Nothing distinguishes them structurally. "Leaf" is not a kind, it is the
 * absence of slots — so the hierarchy is emergent, and a composite can be
 * nested inside a composite as deep as the design goes. This is atomic design
 * without the fixed ladder of atoms, molecules and organisms, which is a
 * taxonomy every team argues about and no renderer needs.
 *
 * Each unit is an ACTOR: props in, events out, its own private state, and
 * behaviour that runs in a sandbox if it declares any. It cannot see inside
 * another unit and no other unit can see inside it.
 */
import type { Decl } from './brand/types.js'
import type { UnitStyling } from './states.js'
import { checkStateContract, compileUnitStyling, variantClasses } from './states.js'
import type { RenderData, StyleDef, ViewNode } from './types.js'

/* ── What a unit declares ───────────────────────────────────────────────── */

/**
 * A unit's contract with whoever places it.
 *
 * Declaring it is what makes the black box safe to use: a caller reads the
 * interface rather than the view, and passing something the unit never asked
 * for fails at mount instead of rendering `undefined` into the page.
 */
export type ActorInterface = {
	/** Accepted props, `name -> type hint`. The hint is documentation and a check. */
	props?: Record<string, string>
	/** Events this unit emits, `name -> payload shape`. */
	events?: Record<string, Record<string, string>>
	/**
	 * Messages this unit RECEIVES, `name -> payload shape` — the mirror of
	 * `events`, and the half the interface was missing.
	 *
	 * A unit could always declare what goes out; what came in was a convention
	 * living in whoever wired the composition. That asymmetry made the inbox
	 * informal: nothing checked a message name, nothing documented what a unit
	 * answered to, and the docs surface had nothing to list.
	 *
	 * Declaring `accepts` does three things at once. It registers an inbox for
	 * the unit at mount — WITHOUT a sandbox: an inbox is a Map entry, and gating
	 * the cheap half of the actor model on the expensive half is the conflation
	 * this field exists to undo. It makes the inbox a CONTRACT: a message whose
	 * name is not listed is undeliverable, loudly, instead of half-handled. And
	 * where the unit declares no `logic`, the engine serves the inbox itself by
	 * merging the payload into the unit's state slice — a declarative handler,
	 * which is all most interactive units need. `logic` upgrades the handler; it
	 * no longer gates the address.
	 */
	accepts?: Record<string, Record<string, string>>
	/** Named slots, and optionally which units may fill them. */
	slots?: Record<string, { accepts?: string[]; required?: boolean }>
}

/**
 * How a composite arranges its children.
 *
 * DECLARED, not styled: a composite names one of the brand's layout primitives
 * and the tokens for its gap and alignment, and the engine resolves that to
 * classes. The separation matters because arrangement and content are
 * different concerns that get tangled the moment a view is allowed to carry
 * raw CSS — and because a brand that renames its primitives should not have to
 * edit every unit.
 */
export type LayoutDef = {
	/** A layout primitive the brand defines: stack, cluster, center, sidebar... */
	primitive: string
	/** A spacing token name, e.g. `space-loose`. */
	gap?: string
	align?: string
	justify?: string
}

/** A unit: the whole of what a piece of interface is. */
export type ActorDef = {
	name: string
	/** Prose, for the docs surface that lists units. */
	description?: string
	interface?: ActorInterface
	layout?: LayoutDef
	/** The structure. May contain `$use` references to other units. */
	view: ViewNode
	/** Styles scoped to this unit. Merged into the vibe's stylesheet. */
	style?: StyleDef
	/**
	 * How this unit looks, varies and responds.
	 *
	 * Preferred over `style` for anything a person operates: it is what carries
	 * the variant axes and the eight states, and what `checkStateContract`
	 * measures. `style` remains for a unit that needs a selector the contract
	 * does not model.
	 */
	styling?: UnitStyling
	/** The unit's own private state. Never visible to another unit. */
	state?: Record<string, unknown>
	/**
	 * Sandbox source for this unit's behaviour, if it has any.
	 *
	 * Optional ON PURPOSE. Every unit speaks the actor protocol — validated
	 * props in, typed events out — but only a unit that declares `logic` gets a
	 * sandbox context and an inbox. A button emits; the message is delivered to
	 * whichever inbox it was wired to. Booting a QuickJS context per button
	 * would make the model uniform and the page slow.
	 */
	logic?: string
}

/** Name -> unit. What `$use` resolves against. */
export type ActorRegistry = Record<string, ActorDef>

/* ── Placing one ────────────────────────────────────────────────────────── */

/**
 * A `$use` node: place a unit, with values and children.
 *
 * The children are what the old named-view lookup could not do. It injected one
 * fixed view; `slots` here passes DIFFERENT children to each instance, which is
 * what lets a single `card` unit be every card on the site.
 */
export type UseDef = {
	unit: string
	props?: Record<string, unknown>
	slots?: Record<string, ViewNode | ViewNode[]>
	/** Chosen options per variant axis, e.g. `{ variant: 'danger', size: 'lg' }`. */
	variants?: Record<string, string>
}

/* ── Checking ───────────────────────────────────────────────────────────── */

/** Refuse a unit that cannot be rendered, naming everything wrong at once. */
export function validateActor(unit: unknown, at = 'unit'): asserts unit is ActorDef {
	const u = unit as Partial<ActorDef> | null
	if (!u || typeof u !== 'object') throw new Error(`${at}: not an object`)
	const problems: string[] = []
	if (!u.name) problems.push('missing `name`')
	if (!u.view || typeof u.view !== 'object') problems.push('missing `view`')
	if (u.layout && !u.layout.primitive) problems.push('`layout` declares no `primitive`')
	if (u.interface?.slots)
		for (const [slot, def] of Object.entries(u.interface.slots))
			if (def && typeof def !== 'object') problems.push(`slot \`${slot}\` is not an object`)
	if (u.interface?.accepts)
		for (const [message, shape] of Object.entries(u.interface.accepts)) {
			if (!shape || typeof shape !== 'object')
				problems.push(`accepts \`${message}\` declares no payload shape (use {} for none)`)
			else
				for (const [field, hint] of Object.entries(shape))
					if (typeof hint !== 'string')
						problems.push(`accepts \`${message}\`.\`${field}\`: type hint must be a string`)
		}
	/* Logic with no inbox contract is an actor nobody can talk to on purpose —
	   almost always a unit written before `accepts` existed. Refusing it here
	   turns a silent dead letterbox into a build error with a named fix. */
	if (u.logic && !u.interface?.accepts)
		problems.push('declares `logic` but no `interface.accepts` — an inbox with no contract')
	if (u.styling && u.name) problems.push(...checkStateContract(u.name, u.styling))
	if (problems.length) throw new Error(`${at} (${u.name ?? 'unnamed'}): ${problems.join('; ')}`)
}

/** Refuse a registry containing a unit that cannot be rendered. */
export function validateRegistry(registry: ActorRegistry): void {
	for (const [name, unit] of Object.entries(registry)) {
		validateActor(unit, `unit "${name}"`)
		if (unit.name !== name)
			throw new Error(`unit "${name}": its own \`name\` is "${unit.name}"; the two must match`)
	}
}

/**
 * Check a placement against the unit's declared interface.
 *
 * Returns problems rather than throwing, so a caller can report every bad
 * placement in a view at once instead of one per render.
 *
 * Unknown props are an ERROR, not a warning. A typo'd prop that is silently
 * ignored is the single most common way a JSON UI renders subtly wrong: the
 * unit falls back to its default, the page looks plausible, and nothing says
 * why. The interface exists so that cannot happen.
 */
export function checkPlacement(use: UseDef, unit: ActorDef): string[] {
	const problems: string[] = []
	const declared = unit.interface ?? {}

	for (const name of Object.keys(use.props ?? {}))
		if (!declared.props || !(name in declared.props))
			problems.push(`"${unit.name}" declares no prop \`${name}\``)

	for (const name of Object.keys(use.slots ?? {}))
		if (!declared.slots || !(name in declared.slots))
			problems.push(`"${unit.name}" declares no slot \`${name}\``)

	for (const [name, def] of Object.entries(declared.slots ?? {}))
		if (def?.required && !(use.slots && name in use.slots))
			problems.push(`"${unit.name}" requires slot \`${name}\``)

	for (const [axis, option] of Object.entries(use.variants ?? {})) {
		const options = unit.styling?.variants?.[axis]
		if (!options) problems.push(`"${unit.name}" has no variant axis \`${axis}\``)
		else if (!(option in options))
			problems.push(`"${unit.name}" axis \`${axis}\` has no option \`${option}\``)
	}

	return problems
}

/* ── Rendering one ──────────────────────────────────────────────────────── */

/**
 * The class list a declared layout resolves to.
 *
 * The primitive is the brand's own class; gap and alignment become utilities in
 * the same vocabulary the rest of the system uses, so a layout cannot reach for
 * a value that is not on a scale.
 */
export function layoutClasses(layout: LayoutDef | undefined): string {
	if (!layout) return ''
	const parts = [layout.primitive]
	if (layout.gap) parts.push(`gap-[var(--${layout.gap})]`)
	if (layout.align) parts.push(`items-${layout.align}`)
	if (layout.justify) parts.push(`justify-${layout.justify}`)
	return parts.join(' ')
}

/**
 * Expand a `$use` into the node to render and the scope to render it in.
 *
 * The scope is the boundary. A unit's expressions see its OWN state and the
 * props it was handed, and nothing of its parent — which is what makes it a
 * black box rather than a template that happens to be nested. `item` and
 * `index` do carry through, so a unit placed inside `$each` can still read the
 * row it belongs to.
 */
/**
 * Resolve a unit view's `part` names into the classes its stylesheet emits.
 *
 * `compileUnitStyling` addresses a unit's anatomy as `.unit-part` — that is
 * where `.nav-menu-crest` and every selector like it comes from — but the
 * renderers knew nothing of `part`, so a placed unit rendered its structure
 * with NO classes at all: the stylesheet named parts and nothing wore the
 * names. Every `$use` of a real library unit came out unstyled, which is why
 * the surfaces kept hand-writing the markup the units were supposed to own.
 *
 * Resolved HERE, in placement, because this is the one spot all three walks
 * share — the DOM renderer, the string renderer and the hydrator all render
 * what `expandUse` returns, so the class algebra cannot drift between build
 * and client. The walk stops at nested `$use`: that unit expands later, under
 * its own name. Slot content is untouched — it belongs to the caller's view
 * and was resolved (or not) in the caller's own context.
 *
 * Cached per unit: the resolution is pure and a unit's view does not change
 * between placements.
 */
const partResolved = new WeakMap<object, ViewNode>()

function resolveParts(node: ViewNode, unitName: string): ViewNode {
	if (!node || typeof node !== 'object') return node
	const out: ViewNode = { ...node }
	if (out.part) {
		const partClass = `${unitName}-${out.part}`
		out.class = out.class ? `${partClass} ${out.class}` : partClass
	}
	if (out.children) out.children = out.children.map((c) => resolveParts(c, unitName))
	if (out.$each) out.$each = { ...out.$each, template: resolveParts(out.$each.template, unitName) }
	return out
}

export function expandUse(
	use: UseDef,
	registry: ActorRegistry,
	data: RenderData,
	resolvedProps: Record<string, unknown>
): { node: ViewNode; data: RenderData; unit: ActorDef } {
	const unit = registry[use.unit]
	if (!unit) throw new Error(`no unit named "${use.unit}" in the registry`)

	const problems = checkPlacement(use, unit)
	if (problems.length) throw new Error(`placing "${use.unit}": ${problems.join('; ')}`)

	/*
	 * A unit that declares styling always wears its own class.
	 *
	 * This used to come out of `variantClasses`, which names the unit and then
	 * its chosen options — so a unit placed WITHOUT variants got no class at
	 * all and rendered unstyled. `nav-link` did exactly that, and it was
	 * invisible in tests because every fixture happened to pass a variant.
	 */
	const layout = layoutClasses(unit.layout)
	const variants = unit.styling ? variantClasses(unit.name, use.variants ?? {}) : ''
	const extra = [layout, variants].filter(Boolean).join(' ')
	let resolved = partResolved.get(unit)
	if (!resolved) {
		resolved = resolveParts(unit.view, unit.name)
		partResolved.set(unit, resolved)
	}
	const node: ViewNode = extra
		? { ...resolved, class: [extra, resolved.class].filter(Boolean).join(' ') }
		: resolved

	return {
		node,
		unit,
		data: {
			state: unit.state ?? {},
			props: resolvedProps,
			slots: use.slots,
			item: data.item,
			index: data.index
		}
	}
}

/**
 * Every unit's styling, compiled into the flat `components` map the style
 * engine consumes.
 *
 * Called once per vibe rather than per instance: a unit's CSS does not depend
 * on where it is placed, which is the whole reason a design system can have a
 * stylesheet at all.
 */
export function registryStyles(registry: ActorRegistry): Record<string, Decl> {
	const out: Record<string, Decl> = {}
	for (const unit of Object.values(registry))
		if (unit.styling) Object.assign(out, compileUnitStyling(unit.name, unit.styling))
	return out
}

/* ── Behaviour ──────────────────────────────────────────────────────────── */

/**
 * A running instance of a unit's logic.
 *
 * The engine never runs the code itself. It cannot: the sandbox is QuickJS in a
 * Tauri plugin on the desktop and a worker in the browser, and this package is
 * pure — no filesystem, no Node built-ins, nothing platform-specific. So the
 * host supplies a `SandboxHost` and the engine drives it through this contract.
 *
 * That indirection is the point rather than a compromise. A unit's logic must
 * behave identically wherever it runs, so it is written against a message
 * interface and never against a runtime.
 */
export type ActorInstance = {
	/** Deliver a message to this instance's inbox and get the next state back. */
	send(event: { send: string; payload: Record<string, unknown> }): Promise<Record<string, unknown>>
	/** Tear the instance down. */
	dispose(): void | Promise<void>
}

/** What a surface must provide for units that declare `logic`. */
export type SandboxHost = {
	/**
	 * Start one instance of a unit's logic.
	 *
	 * `address` is the inbox the instance will be reachable at, passed in so a
	 * host can route or log by it.
	 */
	start(options: {
		unit: ActorDef
		address: string
		initialState: Record<string, unknown>
	}): Promise<ActorInstance>
}

/**
 * Which units in a registry need a sandbox context.
 *
 * Only those declaring `logic`. Every unit speaks the actor protocol, but a
 * button that emits and never receives has nothing to run, and starting a
 * QuickJS context per button would make the model uniform and the page slow.
 */
export function actorsWithLogic(registry: ActorRegistry): ActorDef[] {
	return Object.values(registry).filter((unit) => Boolean(unit.logic))
}

/**
 * Which units in a registry get an inbox: everything that declares `accepts`.
 *
 * Distinct from `actorsWithLogic` on purpose, because the two questions were
 * fused and the fusion was the bug: reception was gated on the sandbox, so on
 * a surface with no QuickJS configured NO unit could receive a message at all.
 * An inbox costs a Map entry; a sandbox costs a context. A unit is an actor —
 * an address with a declared inbox — whether or not anything expensive serves
 * that inbox. The UNIT is the class; the placed instance is the actor.
 */
export function actorsWithInbox(registry: ActorRegistry): ActorDef[] {
	return Object.values(registry).filter((unit) => Boolean(unit.interface?.accepts))
}

/* ── The old unit-taxonomy names, kept as aliases ───────────────────────────
 *
 * The model was always actors — an address, a declared inbox, props in and
 * events out — but the types said "unit", which read as a THIRD concept beside
 * unit-the-class and actor-the-instance. The taxonomy now says it plainly:
 * an `ActorDef` is the class, an `ActorInstance` is the running actor, and
 * `ActorInterface` is the contract between them and everyone else. These
 * aliases keep pre-rename consumers compiling; new code uses the real names.
 */
/** @deprecated use ActorDef */
export type UnitDef = ActorDef
/** @deprecated use ActorInterface */
export type UnitInterface = ActorInterface
/** @deprecated use ActorRegistry */
export type UnitRegistry = ActorRegistry
/** @deprecated use ActorInstance */
export type UnitInstance = ActorInstance
/** @deprecated use actorsWithLogic */
export const unitsWithLogic = actorsWithLogic
/** @deprecated use actorsWithInbox */
export const unitsWithInbox = actorsWithInbox
/** @deprecated use validateActor */
export const validateUnit = validateActor
