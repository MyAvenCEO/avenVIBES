/**
 * VARIANTS AND THE EIGHT STATES.
 *
 * A design system is not a set of components, it is a set of components in
 * every state they can be in. The states are where systems actually fail: the
 * resting look gets designed, hover and focus get added by whoever needed them,
 * disabled gets an opacity, and loading gets reused from disabled — at which
 * point an in-flight action reads as "you cannot do this" instead of "this is
 * happening". None of that is visible in a screenshot of the resting state,
 * which is why it survives review.
 *
 * So states are DECLARED per unit, the selectors are fixed here rather than
 * chosen per component, and a unit that says it is interactive is checked for
 * the ones it must have.
 *
 * The selectors are opinionated on purpose:
 *
 *   focus     `:focus-visible`, never `:focus` — a mouse click should not draw
 *             a focus ring, and `:focus` is why so many systems have one that
 *             everybody then removes with `outline: none`.
 *   disabled  matches the attribute AND `aria-disabled`, because a non-button
 *             cannot carry `disabled` and half of them get it wrong.
 *   loading   `[aria-busy="true"]` — a distinct state from disabled, and the
 *             screen-reader announcement comes free.
 *   selected  `[aria-selected]` and `[aria-pressed]`, the two ARIA spellings of
 *             the same idea, so a toggle and a tab share one declaration.
 */
import type { Decl } from './brand/types.js'

/** The eight states every interactive unit is measured against. */
export type StateName =
	| 'default'
	| 'hover'
	| 'focus'
	| 'active'
	| 'disabled'
	| 'loading'
	| 'error'
	| 'selected'

/** How each state is selected in CSS, relative to the unit's own class. */
export const STATE_SELECTORS: Record<Exclude<StateName, 'default'>, string> = {
	hover: ':hover:not([disabled]):not([aria-disabled="true"])',
	focus: ':focus-visible',
	active: ':active:not([disabled]):not([aria-disabled="true"])',
	disabled: '[disabled], &[aria-disabled="true"]',
	loading: '[aria-busy="true"]',
	error: '[data-state~="error"], &[aria-invalid="true"]',
	selected: '[aria-selected="true"], &[aria-pressed="true"]'
}

/**
 * The states an interactive unit must declare.
 *
 * Four, not eight. `loading` only means something for an async action, `error`
 * only for something that takes input, and `selected` only for something
 * selectable — requiring them everywhere would produce declarations written to
 * satisfy a checker, which is worse than not having them.
 */
export const REQUIRED_INTERACTIVE_STATES: StateName[] = ['hover', 'focus', 'active', 'disabled']

/** What a unit declares about how it varies and how it responds. */
export type UnitStyling = {
	/** The resting look. */
	base?: Decl
	/** Named axes of variation: `variant: { primary, secondary, danger }`. */
	variants?: Record<string, Record<string, Decl>>
	/** Per-state overrides. `default` is a synonym for `base`. */
	states?: Partial<Record<StateName, Decl>>
	/**
	 * Whether this unit is operated by a person.
	 *
	 * Set it and the four required states are enforced. It is explicit rather
	 * than inferred from the tag, because a `div` with a click handler is
	 * interactive and a `button` used purely as a label is not.
	 */
	interactive?: boolean
}

/**
 * Compile a unit's styling into the flat `components` map the style engine
 * already understands.
 *
 * Variants become modifier classes (`btn--danger`), states become selectors on
 * the base class. Nothing here invents a CSS mechanism: it decides the NAMES
 * and the SELECTORS once, centrally, so two components cannot spell the same
 * state differently.
 */
export function compileUnitStyling(
	name: string,
	styling: UnitStyling
): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {}

	const base: Record<string, unknown> = {
		...(styling.base ?? {}),
		...(styling.states?.default ?? {})
	}

	for (const [state, decl] of Object.entries(styling.states ?? {})) {
		if (state === 'default' || !decl) continue
		const selector = STATE_SELECTORS[state as Exclude<StateName, 'default'>]
		if (!selector) continue
		base[`&${selector}`] = decl
	}

	if (Object.keys(base).length) out[name] = base

	for (const [axis, options] of Object.entries(styling.variants ?? {}))
		for (const [option, decl] of Object.entries(options)) {
			/* `variant` is the default axis and is not repeated in the class name,
			   so the common case reads `btn--danger` rather than `btn--variant-danger`. */
			const suffix = axis === 'variant' ? option : `${axis}-${option}`
			out[`${name}--${suffix}`] = { ...decl }
		}

	return out
}

/**
 * Check a unit's styling against the contract, returning every problem.
 *
 * Two checks that are not about completeness, and matter more than it:
 *
 * `loading` must not simply reuse `disabled`'s declarations. Dimming a control
 * while its action is in flight tells the user the wrong thing — the control
 * should stay at full strength and swap its label for a spinner.
 *
 * `focus` must actually draw something. A focus state that only changes a
 * background colour is invisible to the people who need it, so it has to touch
 * `outline` or `box-shadow`.
 */
export function checkStateContract(name: string, styling: UnitStyling): string[] {
	const problems: string[] = []
	if (!styling.interactive) return problems

	const declared = styling.states ?? {}
	for (const state of REQUIRED_INTERACTIVE_STATES)
		if (!declared[state])
			problems.push(`"${name}" is interactive but declares no \`${state}\` state`)

	const focus = declared.focus
	if (focus && !Object.keys(focus).some((p) => /outline|box-shadow|border/i.test(p)))
		problems.push(
			`"${name}" declares a \`focus\` state that draws no ring — it must set outline, box-shadow or border`
		)

	const loading = declared.loading
	const disabled = declared.disabled
	if (loading && disabled && JSON.stringify(loading) === JSON.stringify(disabled))
		problems.push(
			`"${name}" gives \`loading\` the same declarations as \`disabled\` — an action in flight must not read as unavailable`
		)

	return problems
}

/** The class list for a placement: the unit's class plus its chosen variants. */
export function variantClasses(name: string, chosen: Record<string, string> = {}): string {
	const parts = [name]
	for (const [axis, option] of Object.entries(chosen)) {
		if (!option) continue
		parts.push(`${name}--${axis === 'variant' ? option : `${axis}-${option}`}`)
	}
	return parts.join(' ')
}
