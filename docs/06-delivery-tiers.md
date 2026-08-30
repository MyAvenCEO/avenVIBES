# Delivery tiers

Not every piece of interface earns the same shipping cost. A pricing
table that never changes should cost the reader nothing. A menu toggle
should cost a few kilobytes. A checkout with real branching logic can
justify a sandboxed runtime. avenVIBES makes this a spectrum you place
each vibe on — and the placement is *decidable from the definition
itself*.

## Tier 0: static

The string renderer runs at build time and writes finished HTML into the
page. No JavaScript ships. A vibe whose view has no `$on` handlers and
whose units declare no `accepts` and no `logic` is purely presentational
— render it once, ship the text, done.

This is most of a marketing site: heroes, feature grids, footers,
testimonials. Zero kilobytes is the correct price for content that never
changes after the build.

## Tier 1: hydrated island

The build still writes the full HTML — and then a small client script
hydrates it: `Island.hydrate` re-walks the definition, attaches the
`$on` listeners to the markup the build wrote, and wires the declarative
inboxes. Nothing is re-rendered at load; the page is interactive the
moment the listeners attach.

The cost is the engine's hydration path — on the order of five
kilobytes, not the hundreds a component framework brings — because the
island creates nothing, diffs nothing, and never touches text at
hydration. The markup is already correct; only behaviour is missing.

A menu toggle, a tab strip, a counter, a form that patches state: tier 1
covers everything whose behaviour is "message in, state merge,
re-render".

```demo
counter-island
```

## Tier 2: sandboxed logic

A unit that declares `logic` carries real behaviour — branching,
validation, computation — as source code the engine itself never runs.
The surface supplies a `SandboxHost`; on desktop that is QuickJS inside
a Tauri plugin, in the browser a worker. Messages go in, the next state
comes out, and the unit's code cannot reach the DOM, the network or the
page around it.

Tier 2 is for the checkout, the configurator, the name-availability
check — places where the declarative merge is not enough.

## The tier is decidable

You never annotate a vibe with its tier. You read it off the definition:

- Any `$on` in the view? If no: tier 0.
- Any unit (or the root) declaring `logic`? If yes: tier 2.
- Otherwise: tier 1.

Because the definition is data, a build tool can walk it and make this
decision mechanically — emit static HTML for everything, ship hydration
only where handlers exist, and boot a sandbox only where `logic`
demands one. `unitsWithLogic` and `unitsWithInbox` in `src/unit.ts` are
exactly these questions, asked of a registry.

## Why this is safe for SEO

A framework that renders on the client ships an empty shell and a
promise. Under `adapter-static` with `prerender = true`, avenVIBES ships
the opposite: the content exists in the HTML file *when the file is
written*, before any JavaScript is involved. A crawler, a reader with
scripts disabled, a screen reader hitting the page mid-load — all of
them get the real content, because the string renderer put it there at
build time.

Hydration then adds behaviour *on top of* that markup rather than
replacing it. The boolean-attribute parity rule (next section) exists
for precisely this reason: the static file is not a fallback, it is the
primary document, and it has to be correct on its own.
