# Hydration and islands

A prerendered page is a stage with the set already built. Hydration is
the crew arriving: nothing on stage is rebuilt, the props are where the
script says they are, and the work is purely to wire the lights and
microphones. If the crew arrives and finds nothing matching the script,
something shipped stale — and you want to know loudly.

## Vibe or island: who owns the surface

`VibeEngine` owns its surface: it renders into a shadow root, adopts its
own compiled stylesheets, and everything inside is its DOM. That is
right for an app that mounts a vibe as its whole UI.

An `Island` is the opposite arrangement. Its markup was written at build
time by `renderViewToString`; it sits in the page's **light DOM**, styled
by the page's own brand stylesheet, indexed by anything that reads the
file. Moving it into a shadow root would cut it off from the CSS it was
rendered with — so an island has no shadow root on purpose, and its
bundle carries no `style` at all: the brand stylesheet was compiled at
build time, and styling is not the island's job.

## How `Island.hydrate` works

```ts
import { Island } from '@myavenceo/aven-vibes'

const island = new Island({ container })
const attached = await island.hydrate(bundle)
```

`hydrate` does four things, in order:

1. seeds the `StateStore` with the bundle's state
2. wires inboxes — the same `wireInboxes` a `VibeEngine` uses, so an actor
   that works in a vibe works on an island unchanged
3. **re-walks the definition**: for every node carrying `$on`, it
   computes the `data-aven-path` that node must have landed at, queries
   the container for that element, and attaches the listeners
4. subscribes to state changes for re-rendering

Step 3 is the whole trick. It creates nothing, diffs nothing, and never
touches text — the markup is already correct, because build and client
walked one definition. `$use` expands with the actor's own state and
resolved props, `$each` re-evaluates its items against state, slots walk
the children the caller passed: the hydration walk mirrors the render
walk exactly, minus the rendering.

## Zero listeners means a stale build

`hydrate` returns the number of listeners it attached. Check it:

```ts
if (attached === 0) console.warn('island hydrated nothing - stale build?')
```

A hydration that attached zero is almost always a path mismatch between
build and client — the page was built from one version of the bundle and
the client shipped another. Because the hydrator finds elements by
computed path, a mismatch does not throw; it simply finds nothing. The
return value exists so the caller can notice without diffing DOM.

## Re-rendering in place, with focus carried by path

When a message merges into state, the island re-renders — scoped to
itself. The engine builds a fresh tree from the definition
(`ViewEngine.renderTree`, the DOM half of the string renderer, exposed
for light-DOM hosts) and swaps it for the element at path `0`. The page
around the island is static and never touched.

Focus survives the swap by the same algebra that made hydration work: if
the active element is inside the island, its `data-aven-path` is
captured before the swap and the element at that path is focused after.
An input keeps its caret through a re-render, because the path names the
same logical element in both trees.

By the time any of this can happen, the island is interactive; the
build's HTML has already done its job. The static file served the
content, hydration added the behaviour, and state changes redraw only
what the island owns.
