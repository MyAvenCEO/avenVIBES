# Units

Suppose your site has forty buttons. In raw view JSON, that is forty
copies of the same five lines, and the day the design changes you edit
forty places. What a design system needs is to define the button once,
then *place* it with different labels and let each placement stay small.

That is a unit. Here is one:

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

Units live in a `UnitRegistry` — a plain `name -> UnitDef` map handed to
the engine in the bundle — and `$use` resolves against it.

## Leaf and composite are the same thing

Frameworks and atomic-design taxonomies split components into atoms,
molecules and organisms, and teams argue about the ladder forever.
avenVIBES has exactly one type, `UnitDef`, and one structural question:
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
- `accepts` — messages in, while running (the unit's inbox contract)
- `slots` — children in, at placement time

The crucial behaviour: **an unknown prop is a mount error, not a silent
`undefined`.** `checkPlacement` compares every `$use` against the
interface and reports every problem at once. A typo'd prop that is
silently ignored is the single most common way a JSON UI renders subtly
wrong — the unit falls back to its default, the page looks plausible, and
nothing says why. The contract exists so that cannot happen. The same
strictness applies to slots (`"btn" declares no slot body`) and to variant
axes and options.

## Slots: different children per placement

A slot is declared in the interface and rendered by a `$children` node in
the unit's view:

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

This is what makes a single `card` unit every card on the site. A slot may
also restrict which units can fill it (`"accepts": ["stat", "badge"]`)
and mark itself `required`.

## The scope boundary

When `expandUse` expands a placement, it builds a fresh scope: the unit's
expressions see the unit's **own** `state` and the **resolved** props —
and nothing of the parent's state. Props are resolved in the *caller's*
scope first (they are expressions the parent wrote), then the boundary
closes. `item` and `index` do carry through, so a unit placed inside
`$each` can still read its row.

That boundary is what makes a unit a black box instead of a template that
happens to be nested.

## Unit is the class, the placed instance is the actor

One definition of `btn` in the registry; forty placements in the views.
The definition is like a class — it says what any button is. Each
placement is an instance with its own props, its own slot children, and —
if the unit declares `accepts` — its own inbox and address. The messaging
section picks this up; for now the sentence to keep is the one from
`src/unit.ts`: each unit is an actor — props in, events out, its own
private state — and it cannot see inside another unit, nor can any other
unit see inside it.
