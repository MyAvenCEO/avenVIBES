# What is avenVIBES

Imagine you write a piece of music. You do not record one performance and
ship the tape — you write sheet music, and any orchestra, synthesizer or
music box can perform it. The notes are data; the sound is a rendering.

avenVIBES treats user interface the same way. A **vibe** is a complete
little app — view, style, state and behaviour — written as plain data
instead of framework code. The definition is the sheet music. Rendering it
is a performance, and there is more than one performer:

- a **string renderer** performs it at build time, into static HTML files
- a **DOM renderer** performs it in the browser, into live elements
- an **island** performs only the *behaviour*, on top of HTML a build
  already wrote

One definition, many renderers. That is the entire idea, and everything
else in this documentation is a consequence of it.

## Why UI as data

Here is a card, as avenVIBES sees it:

```json
{
	"tag": "article",
	"class": "card",
	"children": [
		{ "tag": "h3", "text": "$title" },
		{ "tag": "p", "text": "$summary" }
	]
}
```

This is JSON. It has no imports, no compiler, no runtime of its own. That
buys three things frameworks struggle with:

**It travels.** A marketing site, a Tauri desktop app and a checkout flow
can share this exact card. The site renders it to a static file for SEO;
the desktop app renders it into a shadow root; the checkout hydrates it as
an island. Nobody rewrites the card three times, and the three surfaces
cannot drift apart, because there is only one card.

**It can be produced by things that are not programmers.** A CMS, a
design tool, or a model can emit a view definition. Emitting working React
requires emitting a program; emitting a vibe requires emitting data that a
validator can check before anything runs.

**It can be made safe.** Because the definition is data, the engine
decides what it may contain. A view cannot emit a `<script>` tag — the tag
allowlist (`SAFE_TAGS` in `src/security.ts`) simply does not include one,
and an unknown tag renders as a `div`. You cannot sandbox arbitrary
JavaScript components this way; you can sandbox data.

## What is in the box

The published package `@myavenceo/aven-vibes` is pure TypeScript with no
platform dependencies — no filesystem, no Node built-ins, no browser
assumed until you pick a renderer. Its main exports:

- `VibeEngine` — mounts a bundle into a shadow root and keeps it rendered
- `renderViewToString` — the same walk, producing HTML text at build time
- `Island` — attaches behaviour to prerendered markup
- `MessageRouter`, `StateStore`, `Evaluator` — the machinery underneath
- `validateUnit`, `checkPlacement`, `validateViewDef` — the contracts

A vibe arrives as a `UiBundle`:

```ts
type UiBundle = {
	view: ViewDef
	style: StyleDef
	state: Record<string, unknown>
	units?: UnitRegistry
	messages?: MessageCatalog
	name?: string
	accepts?: Record<string, Record<string, string>>
}
```

`view` is the structure, `style` the tokens and rules, `state` the data
the view reads, `units` the component library it may place, `messages`
the locale's copy. `name` and `accepts` make the vibe itself addressable,
which the section on actors explains.

## The shape of the rest of these docs

The sections build on each other in one direction:

1. **Views** — the data language: tags, text, expressions, lists
2. **Units** — reusable pieces with contracts: props, slots, variants
3. **Styling** — tokens, the eight states, one theme source
4. **Actors and messages** — how pieces talk without knowing each other
5. **Delivery tiers** — static, island, sandboxed; what each costs
6. **Rendering twice** — how build and browser stay in agreement
7. **Hydration** — how an island wakes up
8. **Logic and the sandbox** — behaviour as data, run at arm's length
9. **Under the hood** — the router, the store, the evaluator, security

If you only read one more section, read Views. Every other concept is a
refinement of what a view may say and who gets to act on it.
