#!/usr/bin/env bun
/**
 * Build the aven-vibes site — with aven-vibes.
 *
 *   bun run site
 *
 * The landing page, the architecture overview, the docs and the demos are all
 * `ViewDef`s rendered by this framework's own string renderer. Nothing on the
 * site is hand-written HTML.
 *
 * That is partly a demonstration and mostly a test. If the renderer cannot
 * carry a real multi-page site — nesting, lists, code blocks, escaping — it
 * fails here, publicly, before anyone builds a product on it. A framework whose
 * own website is built with something else is telling you something.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderViewToString } from '../src/index.js'
import type { ViewDef, ViewNode } from '../src/types.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'site')

/* ── tiny helpers so the page definitions read like content ────────────── */
const el = (tag: string, cls: string | undefined, children: ViewNode[]): ViewNode => ({
	tag,
	...(cls ? { class: cls } : {}),
	children
})
const t = (tag: string, cls: string | undefined, text: string): ViewNode => ({
	tag,
	...(cls ? { class: cls } : {}),
	text
})
const code = (body: string): ViewNode => el('pre', 'code', [t('code', undefined, body)])

/* ── the pieces every page shares ──────────────────────────────────────── */
const nav = (active: string): ViewNode =>
	el('nav', 'nav', [
		t('a', 'brand', 'aven-vibes'),
		el('div', 'nav-links', [
			{
				tag: 'a',
				class: active === 'index' ? 'on' : '',
				text: 'Overview',
				attrs: { href: './index.html' }
			},
			{
				tag: 'a',
				class: active === 'architecture' ? 'on' : '',
				text: 'Architecture',
				attrs: { href: './architecture.html' }
			},
			{
				tag: 'a',
				class: active === 'docs' ? 'on' : '',
				text: 'Docs',
				attrs: { href: './docs.html' }
			},
			{
				tag: 'a',
				class: active === 'demos' ? 'on' : '',
				text: 'Demos',
				attrs: { href: './demos.html' }
			}
		])
	])

const footer = (): ViewNode =>
	el('footer', 'footer', [
		t(
			'p',
			'muted',
			'This entire site is rendered by aven-vibes from view definitions. No hand-written HTML.'
		),
		{
			tag: 'a',
			class: 'muted',
			text: 'github.com/MyAvenCEO/avenVIBES',
			attrs: { href: 'https://github.com/MyAvenCEO/avenVIBES' }
		}
	])

/* ── pages ─────────────────────────────────────────────────────────────── */

const indexView = (): ViewDef =>
	el('main', 'page', [
		nav('index'),
		el('header', 'hero', [
			t('p', 'eyebrow', 'A UI framework where the interface is data'),
			t('h1', 'h1', 'A vibe is a complete little app.'),
			t(
				'p',
				'lede',
				'View, style, state and logic in one bundle — rendered into an isolated shadow root, or to a string at build time. The interface is data, so it can be stored, versioned, sent over a wire, or generated.'
			),
			code(`bun add @myavenceo/aven-vibes`)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'The whole idea'),
			code(`import { VibeEngine } from '@myavenceo/aven-vibes'

const engine = new VibeEngine({ container: document.querySelector('#app')! })

await engine.mount({
  view:  { tag: 'button', class: 'btn', text: '{state.label}', $on: { click: { send: 'TICK' } } },
  style: { tokens: { accent: '#d2a24a' },
           components: { btn: { background: 'var(--accent)', borderRadius: '9999px' } } },
  state: { label: 'Clicked 0 times' }
})`),
			t(
				'p',
				'lede',
				'No template compiler, no build step for the view. The bundle is a plain object, and the engine renders it.'
			)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Why it is shaped this way'),
			el('div', 'grid', [
				el('article', 'card', [
					t('h3', 'h3', 'Isolated by construction'),
					t(
						'p',
						'muted',
						'Every vibe mounts into its own shadow root with its own adopted stylesheet. A vibe cannot leak styles into your page, and your page cannot bleed into it. That is what makes it safe to render a component you did not write.'
					)
				]),
				el('article', 'card', [
					t('h3', 'h3', 'The view is data'),
					t(
						'p',
						'muted',
						'A view is JSON, not markup. It can be stored in a database, diffed, sent over a wire, or produced by a model — and validated before it renders. Markup in a string can do none of those safely.'
					)
				]),
				el('article', 'card', [
					t('h3', 'h3', 'Logic runs sandboxed'),
					t(
						'p',
						'muted',
						'A vibe’s behaviour executes in QuickJS compiled to WebAssembly, not on your main thread with your globals. It sees the state you hand it and nothing else.'
					)
				]),
				el('article', 'card', [
					t('h3', 'h3', 'Renders to DOM or to string'),
					t(
						'p',
						'muted',
						'The same bundle renders into a live shadow root, or to HTML text at build time. Static sites keep their content in the file, where search engines and readers without JavaScript can find it.'
					)
				])
			])
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Honest about what it is not'),
			el('ul', 'list', [
				t(
					'li',
					'muted',
					'Not a React replacement. It renders self-contained units inside an app, not the app itself — routing, data loading and page structure stay with your framework.'
				),
				t(
					'li',
					'muted',
					'Not a template language. There is no expression compiler; a view resolves values through an evaluator you supply.'
				),
				t(
					'li',
					'muted',
					'Not batteries-included styling. It ships no design system. Tokens arrive through the bundle.'
				)
			])
		]),

		footer()
	])

const architectureView = (): ViewDef =>
	el('main', 'page', [
		nav('architecture'),
		el('header', 'hero', [
			t('p', 'eyebrow', 'Architecture'),
			t('h1', 'h1', 'How a vibe becomes pixels'),
			t('p', 'lede', 'Four parts go in, two kinds of output come out.')
		]),

		el('section', 'section', [
			t('h2', 'h2', 'The bundle'),
			code(`Vibe
├── view    ViewDef      the structure, as data
├── style   StyleDef     tokens, components, selectors
├── state   object       what the view renders against
└── slots   registry     named views this one can pull in`)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'The pipeline'),
			code(`         ┌──────────────┐
bundle ─▶ │ view-validator│─▶ rejects unsafe tags and shapes
         └──────────────┘
         ┌──────────────┐
         │ style-engine  │─▶ StyleDef ─▶ CSSStyleSheet (constructable)
         └──────────────┘
         ┌──────────────┐
         │ view-engine   │─▶ DOM nodes ─▶ shadow root      (browser)
         │ string-render │─▶ HTML text  ─▶ a file          (build time)
         └──────────────┘
         ┌──────────────┐
         │ QuickJS-WASM  │─▶ logic, sandboxed
         └──────────────┘`),
			t(
				'p',
				'muted',
				'Two renderers walk one definition. A conformance suite pins their agreement, because the failure they invite is silent divergence.'
			)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Security posture'),
			el('ul', 'list', [
				t(
					'li',
					'muted',
					'Tags are whitelisted; anything else renders as a div rather than executing.'
				),
				t(
					'li',
					'muted',
					'Attribute values pass a whitelist that strips quotes, so a value cannot close its attribute and open a handler.'
				),
				t(
					'li',
					'muted',
					'Raw CSS is rejected outright — a style is structured data, never a string of CSS.'
				),
				t('li', 'muted', 'URL attributes are scheme-checked; javascript: never survives.'),
				t('li', 'muted', 'Markdown is sanitised through DOMPurify before it reaches the DOM.')
			]),
			t(
				'p',
				'muted',
				'These matter because the point of data-as-UI is that the data might not be yours.'
			)
		]),

		footer()
	])

const docsView = (): ViewDef =>
	el('main', 'page', [
		nav('docs'),
		el('header', 'hero', [
			t('p', 'eyebrow', 'Docs'),
			t('h1', 'h1', 'Enough to build something'),
			t('p', 'lede', 'The whole API is a class, a function and three types.')
		]),

		el('section', 'section', [
			t('h2', 'h2', 'VibeEngine'),
			code(`const engine = new VibeEngine({
  container,                      // the element to mount into
  containerName: 'my-app',        // names the CSS container for @container queries
  onEvent: (e) => { ... }         // receives what $on dispatches
})

await engine.mount(bundle)
await engine.updateState({ count: 1 })   // merges
await engine.replaceState({ count: 1 })  // replaces
engine.getState()
await engine.unmount()`)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Writing a view'),
			code(`{
  tag: 'ul',
  class: 'list',
  $each: {
    items: '{state.todos}',
    template: {
      tag: 'li',
      text: '{item.title}',
      $on: { click: { send: 'TOGGLE', payload: { id: '{item.id}' } } }
    }
  }
}`),
			el('ul', 'list', [
				t('li', 'muted', 'tag — whitelisted element name; anything unsafe becomes a div'),
				t('li', 'muted', 'text / value — resolved through your evaluator'),
				t('li', 'muted', 'format: "md" — renders markdown, sanitised'),
				t('li', 'muted', '$each — repeat a template over a list'),
				t('li', 'muted', '$slot — pull in a named view from the registry'),
				t('li', 'muted', '$on — dispatch an event; $value in a payload reads the input')
			])
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Rendering to a string'),
			code(`import { renderViewToString } from '@myavenceo/aven-vibes'

const html = await renderViewToString(view, state, {
  evaluate: (expression, data) => resolve(expression, data)
})`),
			t(
				'p',
				'muted',
				'Same walk, same safety rules, no event wiring — behaviour is the client renderer’s job. Use it to prerender, then hydrate.'
			)
		]),

		footer()
	])

const demosView = (): ViewDef =>
	el('main', 'page', [
		nav('demos'),
		el('header', 'hero', [
			t('p', 'eyebrow', 'Demos'),
			t('h1', 'h1', 'Vibes, rendered'),
			t(
				'p',
				'lede',
				'Each block below is a view definition rendered by the string renderer — the same code path a browser takes, minus the interaction.'
			)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'A card'),
			el('div', 'demo', [
				el('div', 'card', [
					t('p', 'eyebrow', 'Invoice'),
					t('h3', 'h3', 'AVENCEO-0001'),
					t('p', 'muted', 'Paid · 24 August 2026')
				])
			]),
			code(`{ tag: 'div', class: 'card', children: [
  { tag: 'p',  class: 'eyebrow', text: 'Invoice' },
  { tag: 'h3', class: 'h3',      text: 'AVENCEO-0001' },
  { tag: 'p',  class: 'muted',   text: 'Paid · 24 August 2026' }
]}`)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'A list, from $each'),
			el('div', 'demo', [
				el('ul', 'list', [
					t('li', 'muted', 'Reconcile August statements'),
					t('li', 'muted', 'File the quarterly return'),
					t('li', 'muted', 'Renew the domain')
				])
			]),
			code(`{ tag: 'ul', class: 'list',
  $each: { items: '{state.todos}',
           template: { tag: 'li', class: 'muted', text: '{item}' } } }`)
		]),

		el('section', 'section', [
			t('h2', 'h2', 'Escaping is not optional'),
			el('div', 'demo', [t('p', 'muted', '<script>alert(1)</script>')]),
			t(
				'p',
				'muted',
				'That line is text in a view definition. It renders as characters, not as a script — the renderer escapes on the way out, and the tag whitelist would have refused it anyway.'
			)
		]),

		footer()
	])

/* ── the site's own styling, kept deliberately small ───────────────────── */
const css = `
:root {
  --ink: #1f2a3d; --muted: color-mix(in srgb, var(--ink) 62%, transparent);
  --bg: #faf9f4; --surface: #fffdf7; --line: color-mix(in srgb, var(--ink) 12%, transparent);
  --accent: #d2a24a; --marine: #1e293b;
  --measure: 46rem;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 400 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased; }
.page { max-inline-size: var(--measure); margin-inline: auto; padding: 2rem 1.25rem 5rem; }
.nav { display: flex; align-items: baseline; gap: 1.5rem; flex-wrap: wrap;
  padding-block-end: 1.5rem; border-block-end: 1px solid var(--line); }
.brand { font-weight: 600; letter-spacing: -0.02em; text-decoration: none; color: var(--ink); }
.nav-links { display: flex; gap: 1rem; margin-inline-start: auto; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; }
.nav-links a.on, .nav-links a:hover { color: var(--ink); }
.hero { padding-block: 3rem 2rem; }
.eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.16em; color: var(--accent); margin: 0 0 .75rem; }
.h1 { font-size: clamp(2rem, 6vw, 2.75rem); line-height: 1.1; letter-spacing: -0.03em; margin: 0 0 1rem; }
.h2 { font-size: 1.25rem; letter-spacing: -0.02em; margin: 0 0 .75rem; }
.h3 { font-size: 1rem; margin: 0 0 .25rem; }
.lede { color: var(--muted); font-size: 1.0625rem; margin: 0 0 1.5rem; text-wrap: pretty; }
.muted { color: var(--muted); }
.section { padding-block: 2rem; border-block-start: 1px solid var(--line); }
.code { background: var(--marine); color: #f8fafc; border-radius: .75rem;
  padding: 1rem 1.25rem; overflow-x: auto; font: 400 13px/1.65 ui-monospace, Menlo, monospace; }
.code code { white-space: pre; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr)); }
.card { background: var(--surface); border: 1px solid var(--line);
  border-radius: 1rem; padding: 1.25rem; }
.list { padding-inline-start: 1.1rem; display: grid; gap: .5rem; margin: 0; }
.demo { background: var(--surface); border: 1px dashed var(--line);
  border-radius: 1rem; padding: 1.25rem; margin-block-end: 1rem; }
.footer { margin-block-start: 3rem; padding-block-start: 1.5rem;
  border-block-start: 1px solid var(--line); display: grid; gap: .35rem; font-size: 14px; }
.footer a { color: var(--muted); }
`

const page = (title: string, body: string) => `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="aven-vibes — a vibe is a complete little app: view, style, state and logic, rendered from data.">
<style>${css}</style>
${body}
`

const evaluate = (expression: unknown) => expression

mkdirSync(out, { recursive: true })

const pages: Array<[string, string, ViewDef]> = [
	['index.html', 'aven-vibes — the interface is data', indexView()],
	['architecture.html', 'Architecture — aven-vibes', architectureView()],
	['docs.html', 'Docs — aven-vibes', docsView()],
	['demos.html', 'Demos — aven-vibes', demosView()]
]

for (const [file, title, view] of pages) {
	const body = await renderViewToString(view, {}, { evaluate })
	writeFileSync(path.join(out, file), page(title, body))
	console.log(`  ${file} (${Math.round(page(title, body).length / 1024)} KB)`)
}
console.log(`site -> ${path.relative(root, out)}/  — rendered by aven-vibes itself`)
