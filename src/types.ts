export type ViewNode = {
	tag?: string
	class?: string
	text?: string
	value?: string
	format?: 'md' | 'markdown'
	attrs?: Record<string, string>
	children?: ViewNode[]
	$each?: { items: string; template: ViewNode }
	$slot?: string
	/** Place another unit here, with values and children. See `unit.ts`. */
	$use?: import('./unit.js').UseDef
	/** Render the children a parent passed into this named slot. */
	$children?: string
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

export type SlotRegistry = Record<string, ViewDef | ViewNode>

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
	slots?: SlotRegistry
	/** The units this vibe's view may place with `$use`. */
	units?: import('./unit.js').UnitRegistry
	/** The locale's copy, resolved by `$t`. Injected here, cascades to every unit. */
	messages?: import('./messages.js').MessageCatalog
}

export type InterfaceDef = {
	properties?: Record<string, Record<string, unknown>>
}

/** Fixture assets passed to sandbox-quickjs; state comes from QJS initState. */
export type UiFixtureShell = {
	view: ViewDef
	style: StyleDef
	source: Record<string, unknown>
	interface: InterfaceDef
	logic: string
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
}
