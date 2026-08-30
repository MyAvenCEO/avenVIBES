# Views

A view is the answer to one question: what is on the screen? Not how it
got there, not what happens when you click it — just the structure, as
data.

Start with the card again, this time with real state behind it:

```json
{
	"view": {
		"tag": "article",
		"class": "card",
		"children": [
			{ "tag": "h3", "text": "$title" },
			{ "tag": "p", "text": "$summary" }
		]
	},
	"state": {
		"title": "Universal inboxes",
		"summary": "Every unit with a contract is an addressable actor."
	}
}
```

The renderer walks the `view`, and wherever it finds an expression, it
looks the value up in `state`. Change the state and the rendered output
changes; the view itself never does. The view is the sheet music; state is
tempo and dynamics.

## The node

Every node in a view is a `ViewNode`, and it has a small, closed
vocabulary:

- `tag` — the element to render. Checked against an allowlist; an unknown
  or unsafe tag becomes a `div`.
- `class` — a class string, or an expression resolving to one.
- `text` — the text content, or an expression, or a `$t` reference.
- `attrs` — attributes by name. URL attributes and boolean attributes get
  special, safer treatment (see Under the hood).
- `value` — for inputs and textareas, the controlled value.
- `children` — an array of more nodes.
- `format: "md"` — render `text` as markdown instead of plain text.

Plus the operators, each starting with `$`: `$each`, `$use`, `$children`,
`$icon`, `$on`. A node uses at most one of the structural ones.

## Expressions: three sigils, nothing else

The expression language is deliberately tiny. There are exactly three
prefixes, implemented in the `Evaluator` (`src/view-validator.ts`):

- `$name` — read `name` from the current **state**. Dots reach deeper:
  `$user.email`.
- `$props.label` — read `label` from the **props** this unit was placed
  with. Props are a separate scope from state on purpose, so a unit can
  never accidentally read a parent value that happens to share a name.
- `$$field` — read `field` from the **current list item**, inside a
  `$each` loop.

Anything that does not start with `$` is a literal. There are no ternaries
and no inline conditionals — the validator rejects them with a pointer
toward state machines, because a view that computes is a view that can
disagree between renderers.

## Lists with `$each`

```json
{
	"tag": "ul",
	"$each": {
		"items": "$plans",
		"template": {
			"tag": "li",
			"children": [
				{ "tag": "strong", "text": "$$name" },
				{ "tag": "span", "text": "$$price" }
			]
		}
	}
}
```

`items` is an expression that must resolve to an array in state. The
`template` renders once per item, and inside it `$$name` reads
`item.name`. The template still sees `$` state expressions too — the item
scope is added, not swapped.

## Copy with `$t`

A view never carries display strings directly. This looks like tidiness
and is actually internationalisation: the same unit has to render in every
locale, and a string baked into a view is a unit that only works in one.

```json
{ "tag": "button", "text": { "$t": "pricing.cta" } }
```

The bundle's `messages` catalog supplies the words:

```json
{ "pricing": { "cta": "Start free" } }
```

Interpolation is ICU-flavoured — `"You have {count} items"` — and the
values can come from state. A missing key renders the key itself, as
visible nonsense, because a silently blank string is a gap nobody files a
bug about.

## What a view cannot say

Just as important as the vocabulary is its edges:

- No `<script>`, no `<style>`, no `<iframe>` — `SAFE_TAGS` does not
  contain them, and there is no escape hatch.
- No inline event handler strings. Behaviour is `$on`, which emits a
  *message* (see Actors and messages), never code.
- No arbitrary SVG. Icons come from a registry of validated geometry via
  `$icon: { "name": "check" }` — a name, never markup.
- No conditional operators. Show-and-hide is a state concern: render both
  states' data or drive visibility with an attribute the state sets.

These edges are what let a surface accept view definitions from a CMS, a
plugin, or a generator without auditing each one by hand. The language is
small enough to trust.
