# Styling and the brand

Ask why a button in a well-run design system is never the wrong shade of
blue. The answer is not discipline — it is that the button has no way to
*say* a shade of blue. It can only name a token, and the brand resolves
the token. avenVIBES builds that inability into the data format.

## Tokens: the one theme source

A bundle's `style.tokens` is a nested map of named values:

```json
{
	"tokens": {
		"color": {
			"action": { "primary": "#295BFF" },
			"focus": "#0B1B4D"
		},
		"radius": { "control": "8px" }
	}
}
```

The style engine flattens it into CSS custom properties
(`--color-action-primary`, `--radius-control`) on the vibe's root. Every
declaration in an actor's styling references tokens by interpolation:

```json
{ "background": "{color.action.primary}" }
```

Switching brand or theme means editing the token source once. An actor that
hardcoded `#295BFF` would keep it through the rebrand — which is exactly
why actors never see raw values, only names.

## `styling`: base, parts, variants, states

An actor's look is declared in `styling`, a structure the engine compiles
rather than CSS the author writes:

- `base` — the resting look.
- `parts` — named sub-elements. A field has a label, a hint, an error;
  they compile to flat classes (`field-label`, `field-error`) a view can
  carry and a caller can never invent.
- `variants` — named axes of variation: `variant: primary | danger`,
  `size: sm | lg`. Compiled to modifier classes (`btn--danger`,
  `btn--size-lg`). The placement chooses options; `checkPlacement`
  rejects an axis or option the actor never declared.
- `states` — per-state overrides, described next.
- `keyframes` and `reducedMotion` — an actor that animates ships its own
  keyframes and must say what it does under
  `prefers-reduced-motion: reduce`.

`compileUnitStyling` (in `src/states.ts`) turns this into the flat
components map the style engine consumes, and `registryStyles` does it
once for a whole registry — once per vibe, not per instance, because a
actor's CSS does not depend on where it is placed. That property is the
whole reason a design system can have a stylesheet at all.

## The eight states

A design system is not a set of components; it is a set of components in
every state they can be in. The engine names eight:

default, hover, focus, active, disabled, loading, error, selected.

Four are required the moment an actor says `"interactive": true` — hover,
focus, active, disabled (`REQUIRED_INTERACTIVE_STATES`). The other three
apply where they mean something: `loading` for async actions, `error` for
inputs, `selected` for selectable things.

The selectors are fixed centrally in `STATE_SELECTORS`, and they are
opinionated on purpose:

- focus is `:focus-visible`, never `:focus` — a mouse click should not
  draw a focus ring, and `:focus` is why so many systems have one that
  everybody then removes with `outline: none`.
- disabled matches the `disabled` attribute *and* `aria-disabled`,
  because a non-button cannot carry `disabled` and half of them get it
  wrong.
- loading is `[aria-busy="true"]` — a distinct state, and the screen
  reader announcement comes free.
- selected matches `aria-selected`, `aria-pressed` *and* `aria-current`,
  because "this is the current one" is spelled three ways in ARIA and
  each is correct in its own place.

`checkStateContract` enforces two rules that matter more than
completeness: a `focus` state must actually draw something (outline,
box-shadow or border — a background change is invisible to the people who
need it), and `loading` may not simply reuse `disabled`'s declarations —
an action in flight must not read as unavailable.

## What the compiler refuses

The styling compiler validates before it compiles, and its errors come
from real defects:

- An unknown `styling` key is an error, because twelve actors were once
  written with `parts`, `keyframes` and `reducedMotion` against a
  compiler that had none of them — and every one compiled cleanly while
  silently emitting half its CSS.
- An actor that animates without declaring `reducedMotion` is an error,
  because an entrance animation is often the only thing that reveals the
  content, and a blanket `animation: none` from a user's OS setting can
  leave the element invisible. The right answer differs per actor — a
  spinner slows, a skeleton stops pulsing, a drawer still moves — so it
  has to be said per actor.

## Raw CSS stays out

`validateStyleDef` rejects `rawCss` fields outright and screens every
value against CSS injection patterns (`javascript:`, `expression(...)`,
`@import` and friends). A style definition is data about the brand's
vocabulary, not a stylesheet smuggled in as JSON.
