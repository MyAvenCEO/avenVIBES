# Actors

Suppose your site has forty buttons. In raw view JSON, that is forty
copies of the same five lines, and the day the design changes you edit
forty places. What a design system needs is to define the button once,
then *place* it with different labels and let each placement stay small.

That definition is an **actor** — or precisely, the `ActorDef` is the
CLASS, and every placement makes an INSTANCE of it. The same word covers
both on purpose, the way "Button" names both the component and each
button on the page: an actor is an address, a declared interface, and a
view, whether you are reading its definition or clicking its instance.
Here is one:

```json
{
	"name": "btn",
	"description": "The one action element. Variant picks its role.",
	"interface": {
		"props": { "label": "string" },
		"events": { "press": {} }
	},
	"view": {
		"tag": "button",
		"text": "$props.label",
		"$on": { "click": { "send": "press" } }
	},
	"styling": {
		"interactive": true,
		"base": { "borderRadius": "{radius.control}" },
		"variants": {
			"variant": {
				"primary": { "background": "{color.action.primary}" },
				"danger": { "background": "{color.action.destructive}" }
			}
		},
		"states": {
			"hover": { "filter": "brightness(1.05)" },
			"focus": { "outline": "2px solid {color.focus}" },
			"active": { "transform": "translateY(1px)" },
			"disabled": { "opacity": "0.5" }
		}
	}
}
```

And here is a placement, inside any view:

```json
{
	"$use": {
		"unit": "btn",
		"props": { "label": "Delete account" },
		"variants": { "variant": "danger" }
	}
}
```

Actors live in a `ActorRegistry` — a plain `name -> ActorDef` map handed to
the engine in the bundle — and `$use` resolves against it.

## Leaf and composite are the same thing

Frameworks and atomic-design taxonomies split components into atoms,
molecules and organisms, and teams argue about the ladder forever.
avenVIBES has exactly one type, `ActorDef`, and one structural question:
**does its interface declare slots?**

- No slots: a *leaf*. A button, a badge, an icon-label.
- Slots: a *composite*. A card that accepts a body, a page section that
  accepts anything.

"Leaf" is not a kind, it is the absence of slots. Composites nest inside
composites without limit, so the hierarchy is emergent rather than
decreed. The vibe itself is just the root composite plus a manifest.

## The interface is a contract, not documentation

```json
{
	"interface": {
		"props": { "label": "string", "href": "string" },
		"events": { "press": { "id": "string" } },
		"accepts": { "set-open": { "open": "boolean" } },
		"slots": { "body": { "required": true } }
	}
}
```

Four clauses, four directions of traffic:

- `props` — values in, at placement time
- `events` — messages out, while running
- `accepts` — messages in, while running (the actor's inbox contract)
- `slots` — children in, at placement time

The crucial behaviour: **an unknown prop is a mount error, not a silent
`undefined`.** `checkPlacement` compares every `$use` against the
interface and reports every problem at once. A typo'd prop that is
silently ignored is the single most common way a JSON UI renders subtly
wrong — the actor falls back to its default, the page looks plausible, and
nothing says why. The contract exists so that cannot happen. The same
strictness applies to slots (`"btn" declares no slot body`) and to variant
axes and options.

## Slots: different children per placement

A slot is declared in the interface and rendered by a `$children` node in
the actor's view:

```json
{
	"name": "card",
	"interface": { "slots": { "body": {} } },
	"view": {
		"tag": "article",
		"children": [{ "$children": "body" }]
	}
}
```

The placement passes children in:

```json
{
	"$use": {
		"unit": "card",
		"slots": { "body": { "tag": "p", "text": "Any view nodes at all." } }
	}
}
```

This is what makes a single `card` actor every card on the site. A slot may
also restrict which actors can fill it (`"accepts": ["stat", "badge"]`)
and mark itself `required`.

## The scope boundary

When `expandUse` expands a placement, it builds a fresh scope: the actor's
expressions see the actor's **own** `state` and the **resolved** props —
and nothing of the parent's state. Props are resolved in the *caller's*
scope first (they are expressions the parent wrote), then the boundary
closes. `item` and `index` do carry through, so an actor placed inside
`$each` can still read its row.

That boundary is what makes an actor a black box instead of a template that
happens to be nested.

## Actor is the class, the placed instance is the actor

One definition of `btn` in the registry; forty placements in the views.
The definition is like a class — it says what any button is. Each
placement is an instance with its own props, its own slot children, and —
if the actor declares `accepts` — its own inbox and address. The messaging
section picks this up; for now the sentence to keep is the one from
`src/actor.ts`: each actor is an address with a contract — props in, events out, its own
private state — and it cannot see inside another actor, nor can any other
actor see inside it.
