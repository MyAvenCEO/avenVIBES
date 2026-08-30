# Under the hood

Everything so far is the instrument as the player sees it. This section
opens the lid: the five small machines the engine is made of, and the
security decisions threaded through them. None of it is required
reading to use avenVIBES; all of it is required reading to extend it.

## MessageRouter

One delivery path for every message in a vibe (`src/messages.ts`). A
`Map` of address to inbox, a host inbox for the surface, and three
verbs:

- `deliver` — a message addressed to a registered inbox goes there and
  stops; anything else falls through to the host. That fallthrough is
  what makes `$host` the default and keeps pre-address views working.
- `refuse` — an inbox rejecting a message its contract does not name.
  Same consequences as a miss: the undeliverable handler hears it, then
  the host. The inbox exists; it is the contract that says no.
- `clearOwned` — the remount rule. The router distinguishes inboxes the
  *engine* registered (`registerOwned`, one per actor, torn down on
  unmount) from inboxes the *host* registered (`register`, which
  outlive any mount). The distinction earned its place the hard way:
  clearing everything on remount silently unregistered the host's
  inboxes, and every addressed message fell through as though it had no
  address at all.

## StateStore

Thirty lines (`src/state-store.ts`), and deliberately so: an immutable
snapshot (`get`), replace (`set`), shallow merge (`patch`), and
subscribers notified on every change. The engine subscribes once and
re-renders on notification. There is no selector graph, no memoisation,
no middleware — a vibe's state is one object, and the renderers are
fast enough to redraw from it wholesale.

## The Evaluator

The expression grammar (`src/view-validator.ts`) is three prefixes and
a fallthrough:

- `$props.x` reads the props scope
- `$$x` reads the current `$each` item
- `$x` resolves a dot-path into state
- anything else is a literal

Two guards close it. Path resolution refuses the forbidden keys
(`__proto__`, `constructor`, `prototype`) at every segment, so an
expression cannot climb the prototype chain. And evaluation carries a
depth limit (default 50), so a pathological definition terminates
instead of recursing. The validator has already rejected ternaries and
conditional operators before the evaluator ever runs — the grammar
stays tiny because every addition is something two renderers must
implement identically forever.

## The security allowlists

`src/security.ts` is short and is the whole wall:

- `SAFE_TAGS` — the elements a view may render. No `script`, no
  `style`, no `iframe`, no `svg`. An unknown tag becomes a `div`,
  silently, so an attack degrades to inert markup rather than an error
  page.
- `URL_ATTRS` — `href`, `src`, `action`, `formaction`, `poster` are
  screened against a protocol allowlist; `javascript:` never survives.
- `BOOLEAN_ATTRS` — HTML's own boolean attributes, the list behind the
  bare-or-omitted rule from the rendering section.
- attribute and class values pass a character whitelist; CSS values are
  screened against injection patterns (`expression(`, `@import`,
  `-moz-binding` and friends).

Why can a view not emit script, even in principle? Because every string
a view controls passes through one of these gates, and none of the
gates emits executable context. The one apparent exception proves the
rule: `$icon` renders SVG — but from a registry of geometry validated
at registration, referenced by name. The view supplies only the name;
there is no hole to reach through, because the view never supplies
markup at all.

## The style engine, in brief

`StyleEngine` (`src/style-engine.ts`) compiles a `StyleDef` into
constructable stylesheets: tokens flatten to CSS custom properties on
`:host` (with container-query setup), components become class rules
with `{token.path}` interpolation, and every interpolated value passes
the injection screen. Sheets are cached by style content, so remounts
do not recompile. Above it, `compileUnitStyling` translates each unit's
`styling` declaration — base, parts, variants, states, keyframes,
reduced motion — into that flat components map, with the state
selectors fixed centrally so two units cannot spell `focus` differently.

## Where to go from here

Read `src/unit.ts` first; it is the most commented file in the engine
and carries the design history. Then `src/inboxes.ts` for the actor
wiring, and the tests — `tests/` is organised as one contract per file,
and each file's header comment states the drift or defect it exists to
prevent. The engine is around three thousand lines total. It is meant
to be readable in an afternoon, and the comments are written for the
afternoon you try.
