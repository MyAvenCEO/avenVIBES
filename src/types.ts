export type ViewNode = {
	tag?: string
	class?: string
	text?: string
	value?: string
	format?: 'md' | 'markdown'
	attrs?: Record<string, string>
	children?: ViewNode[]
	$each?: { items: string; template: ViewNode }
	/** Place another unit here, with values and children. See `unit.ts`. */
	$use?: import('./unit.js').UseDef
	/** Render the children a parent passed into this named slot. */
	$children?: string
	/**
	 * Draw a registered icon here.
	 *
	 * A NAME, never markup. `SAFE_TAGS` admits no SVG because a view that can
	 * emit arbitrary SVG can emit script; this is the one door, and it opens
	 * onto a registry whose contents were validated as geometry when they were
	 * registered.
	 */
	$icon?: { name: string; size?: string; title?: string }
	$on?: Record<string, UiEventDef>
}

export type ViewDef = {
	content?: ViewNode
} & ViewNode

export type StyleDef = {
	tokens?: Record<string, unknown>
	components?: Record<string, Record<string, unknown>>
	selectors?: Record<string, Record<string, unknown>>
}

export type UiEventDef = {
	send: string
	/**
	 * The inbox this message is addressed to.
	 *
	 * `$self`, `$parent`, `$host`, or a named inbox. Resolved at mount, and
	 * deliberately supplied by whoever PLACES the unit rather than written
	 * inside it: a reusable unit that names a concrete inbox is not reusable.
	 * Absent means `$host`, which is how every existing view keeps working.
	 */
	to?: string
	payload?: Record<string, unknown>
}

export type UiEvent = {
	send: string
	/** The resolved inbox address this message was delivered to. */
	to?: string
	payload: Record<string, unknown>
}

export type UiBundle = {
	view: ViewDef
	style: StyleDef
	state: Record<string, unknown>
	/** The units this vibe's view may place with `$use`. */
	units?: import('./unit.js').UnitRegistry
	/** The locale's copy, resolved by `$t`. Injected here, cascades to every unit. */
	messages?: import('./messages.js').MessageCatalog
	/**
	 * The vibe root's own address, when it accepts messages of its own.
	 *
	 * A vibe is a composite like any other, and the root is an actor like any
	 * placed unit — a menu island whose root state holds `open` has to be
	 * addressable, or the only way in is `$host` and the host has to know the
	 * island's internals. Optional because a vibe that only composes other
	 * actors has nothing to receive.
	 */
	name?: string
	/**
	 * Messages the ROOT accepts, `name -> payload shape` — the root's inbox
	 * contract, served declaratively: the payload merges into the root state.
	 * Same rule as a unit's `interface.accepts`, at the level above.
	 */
	accepts?: Record<string, Record<string, string>>
}

export type RenderData = {
	state: Record<string, unknown>
	/** The values this unit was placed with. Read as `$props.name`. */
	props?: Record<string, unknown>
	/** Children a parent passed in, by slot name. Rendered by `$children`. */
	slots?: Record<string, ViewNode | ViewNode[]>
	item?: unknown
	index?: number
}

export type VibeEngineOptions = {
	container: HTMLElement
	containerName?: string
	onEvent?: (event: UiEvent) => void
	/**
	 * Runs the logic of units that declare any.
	 *
	 * Optional: a vibe of purely presentational units needs no sandbox, and the
	 * engine must not require a platform it cannot provide.
	 */
	sandbox?: import('./unit.js').SandboxHost
}
