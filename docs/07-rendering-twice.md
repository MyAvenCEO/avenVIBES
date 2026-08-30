# Rendering twice

The same sheet music, performed twice: once by the build, once by the
browser. `renderViewToString` (in `src/string-renderer.ts`) walks a
`ViewDef` into HTML text at build time; `ViewEngine.renderNode` (in
`src/view-engine.ts`) walks the identical definition into DOM elements at
runtime. Two renderers over one definition is a real cost — they can
drift — and this section is about the machinery that keeps them honest.

## The same walk, in the same order

Both renderers make the same decisions at every node:

- the same tag safety: an unknown tag falls back to `div` via `SAFE_TAGS`
- the same attribute sanitising, URL screening and class filtering
- the same structural precedence: `$icon`, then `$use`, then
  `$children`, then `$each`, then `children`
- the same two-scope rule for `$use`: props resolve in the caller's
  scope, the unit renders in its own
- the same `$t` resolution, so copy cannot differ between build and
  client

A conformance test runs a fixture through both and compares the output,
because "the shape of the walk is the same" is a claim worth pinning.

## The path algebra

Every rendered element carries `data-aven-path` — its coordinate in the
definition. The forms compose:

- `0` — the root node
- `0.2` — the root's third child (plain children index with `.`)
- `0.2.$each.4` — the fifth repetition of a `$each` template
- `0.1~btn` — a `btn` unit placed by `$use` at position `0.1`
- `0.1~card.body.0` — the first child passed into the `card` unit's
  `body` slot

Both renderers stamp identical paths because both derive them from the
same definition walk. This shared algebra is the contract that makes
hydration possible at all: the hydrator can compute, for any node in the
definition, the path its element must have landed at in the built markup
— and find it with one query.

The paths also carry structure the router uses: instance ids are paths,
so `$parent` resolves by string operation (`0.2.1` to `0.2`) rather
than a tree walk. Where a piece sits is encoded in its address.

## What the string renderer must do by hand

The DOM gives the client renderer two things for free that a string
builder has to earn:

**Escaping.** `textContent` cannot inject; string concatenation can.
Every resolved value is escaped (`&`, `<`, `>`, and quotes in
attributes), because a `ViewDef` may carry state that came from a user,
and forgetting is how a generator becomes an injection vector.

**Void elements.** `<input>` and `<br>` must not be given closing tags;
the DOM never asks.

## The boolean-attribute parity rule

The subtlest drift the two renderers ever had is worth telling in full,
because it is the kind boolean logic invites.

HTML's own boolean attributes — `disabled`, `checked`, `required` — are
bare-or-omitted: their presence is true, their absence false. ARIA state
attributes look similar and behave opposite: `aria-expanded="false"` is
meaningful, load-bearing information, and *omitting* it says nothing at
all.

The string renderer once treated every boolean value the bare-or-omitted
way. Result: `aria-expanded: false` on a closed menu's toggle rendered
correctly in the browser and *vanished from the static file*. The closed
menu told a screen reader nothing until JavaScript arrived — precisely
the reader the static file exists to serve first.

The rule now, in both renderers: bare-or-omitted applies to the
attributes in `BOOLEAN_ATTRS` (HTML's own list) and to nothing else. A
boolean anywhere else renders as the string `"true"` or `"false"`. The
lesson generalises: parity between the renderers is not an aesthetic
preference, it is an accessibility guarantee.

## Where interaction lives

`$on` handlers are deliberately absent from the string renderer. They
are DOM listeners; static output carries the markup, and the client
attaches the behaviour on top of it. This is not a limitation of the
string renderer — it is the delivery-tier boundary drawn in the code:
tier 0 output is exactly the string renderer's output, and everything a
tier 1 island adds is what the string renderer deliberately leaves out.
