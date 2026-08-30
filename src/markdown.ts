/**
 * DOCUMENTATION MARKDOWN — the package's own prose, rendered headlessly.
 *
 * `renderMarkdown` in the view-engine exists for view text a bundle carries at
 * runtime, and it runs DOMPurify because that text may have come from anywhere.
 * This module is for a different input entirely: the package's OWN docs,
 * markdown that ships inside the published artifact and was reviewed like any
 * other source file. Running DOMPurify here would buy nothing and cost the one
 * thing a headless module cannot pay — DOMPurify needs a DOM, and this renderer
 * must run at build time in a bare Node or Bun process, before any browser
 * exists. So sanitising is a HOOK rather than a default: a consumer that feeds
 * this renderer anything less trusted than its own repository supplies
 * `sanitize` and pays for the DOM it already has.
 *
 * What the renderer adds over plain `marked`:
 *
 *   ids      every heading gets a stable slug id (lowercase, alnum and dash),
 *            deduplicated within the document, so a docs surface can deep-link
 *            without inventing its own slugger and disagreeing with ours.
 *   toc      h2 and h3 headings are collected into `{ id, title, level }`
 *            entries — the outline a sidebar renders.
 *   demos    a fenced code block whose language is `demo` is not code at all:
 *            the first word of the fence body names a demo, and the block
 *            renders as `<div data-md-demo="NAME"></div>`. The renderer stays
 *            headless and theme-free; whoever consumes the docs decides what an
 *            interactive demo IS and mounts it into that placeholder.
 *
 * Everything else is marked's default semantic HTML — no inline styles, no
 * framework classes — so a brand themes the output purely through element
 * selectors (the avenCEO `prose` unit is the canonical consumer).
 */
import { Marked, type Tokens } from 'marked'

export type TocEntry = {
	/** The heading's slug id, as emitted on the element. */
	id: string
	/** The heading's plain text, tags stripped. */
	title: string
	/** 2 or 3 — the levels a sidebar outline shows. */
	level: number
}

export type MarkdownDocOptions = {
	/**
	 * Applied to the final HTML before it is returned.
	 *
	 * Absent by default on purpose: the input is the package's own trusted
	 * documentation, and the default sanitiser (DOMPurify) requires a DOM this
	 * headless module must not assume. Supply one when the markdown is not
	 * yours.
	 */
	sanitize?: (html: string) => string
}

/**
 * A heading's slug: lowercase, alphanumerics and dashes, nothing else.
 *
 * Kept deliberately dumb — no unicode folding, no smart punctuation handling —
 * because a slug's one job is to be STABLE. Every clever normalisation is a
 * future rename of every anchor that used the old spelling.
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/** Strip tags from inline-rendered heading HTML, for the toc title and the slug. */
function plainText(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * Render one markdown document to HTML plus its outline.
 *
 * A fresh `Marked` instance per call, never the module-level singleton: the
 * renderer closes over per-document state (the toc, the slug dedupe counters),
 * and the singleton is shared with `renderMarkdown` in the view-engine — two
 * callers configuring one global parser is how the docs renderer would leak
 * demo fences into runtime view text.
 */
export async function renderMarkdownDoc(
	markdown: string,
	options: MarkdownDocOptions = {}
): Promise<{ html: string; toc: TocEntry[] }> {
	const toc: TocEntry[] = []
	const seen = new Map<string, number>()

	const md = new Marked({
		renderer: {
			heading({ tokens, depth }: Tokens.Heading): string {
				const inline = this.parser.parseInline(tokens)
				const title = plainText(inline)
				const base = slugify(title) || 'section'
				/* Dedupe by suffix, so two "Example" headings link separately
				   instead of both anchors resolving to the first. */
				const count = seen.get(base) ?? 0
				seen.set(base, count + 1)
				const id = count === 0 ? base : `${base}-${count + 1}`
				if (depth === 2 || depth === 3) toc.push({ id, title, level: depth })
				return `<h${depth} id="${id}">${inline}</h${depth}>\n`
			},
			code({ text, lang }: Tokens.Code): string | false {
				if (lang === 'demo') {
					/* The fence body's FIRST word is the demo's name; the rest of
					   the body is the author's note to themselves and renders as
					   nothing. The name is slug-sanitised so a stray character in
					   a fence can never become attribute injection. */
					const name = slugify(text.trim().split(/\s+/)[0] ?? '')
					return `<div data-md-demo="${name}"></div>\n`
				}
				/* Every other language falls through to marked's default
				   `<pre><code>` — real code stays code. */
				return false
			}
		}
	})

	const html = String(await md.parse(markdown))
	return { html: options.sanitize ? options.sanitize(html) : html, toc }
}
