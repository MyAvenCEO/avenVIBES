# Actors and messages

Think of a hotel with pigeonholes at the front desk. A note for room 12
goes into pigeonhole 12, no matter who wrote it or where they stood. That
is how avenVIBES pieces talk: not by bubbling events up a tree, but by
addressing a named inbox through one router.

The difference matters. DOM bubbling routes by tree position, so where a
piece *sits* decides who hears it — move a card into a different column
and its behaviour silently changes. Actors route by **address**: a
message names its recipient, and `MessageRouter` delivers it.

## Messages out: `$on` and `events`

A view node emits with `$on`:

```json
{
	"tag": "button",
	"text": "$props.label",
	"$on": {
		"click": {
			"send": "set-open",
			"to": "menu",
			"payload": { "open": true }
		}
	}
}
```

`send` is the message name, `payload` its data (expressions allowed —
`"$value"` reads the input that fired the event), and `to` is the
address. The actor declares what it emits in `interface.events`, so a
reader learns the actor's outputs from its contract, not from spelunking
its view.

## Addresses: four symbolic forms

`to` resolves at delivery time via `resolveAddress`:

- `$self` — the actor that emitted it, for driving its own state
- `$parent` — the composite that placed it
- `$host` — the surface outside the vibe, for app-level concerns
- any other string — a named inbox, including a sibling's

Absent means `$host`, which is how every view written before addresses
existed keeps working unchanged.

The rule that keeps this from becoming spaghetti is not a restriction on
who may talk to whom — it is *where the wiring lives*. A reusable actor
never names a concrete inbox inside its own definition; `to` is supplied
by whoever **places** the actor. A button does not know it belongs to a
pricing page. The pricing page's composition says so, and the whole
topology is readable in that one file.

## Messages in: `accepts`, the declarative handler

The mirror of `events` is `accepts` — the messages an actor receives:

```json
{
	"name": "menu",
	"interface": {
		"accepts": { "set-open": { "open": "boolean" } }
	},
	"state": { "open": false }
}
```

Declaring `accepts` registers an inbox for the actor at mount. And where
the actor declares no `logic`, the engine serves the inbox **itself**: the
payload merges into the actor's state slice. No code runs anywhere.

Read that again, because it is the heart of the model: a menu toggle is a
*complete behaviour* expressed as two pieces of data — a button that
sends `{ "send": "set-open", "payload": { "open": true } }`, and a menu
whose contract says `set-open` carries a boolean. The engine does the
merge, the state store notifies, the view re-renders. Open a menu, pick a
tab, set a field: most interactivity on most pages is exactly this
shape, and none of it needs a sandbox, a framework or a single line of
JavaScript written by you.

The merge is a merge, never a replace — a message that sets `open` must
not erase a `label` that arrived at mount.

Here is that menu, live:

```demo
menu-island
```

## The contract refuses what it does not name

An inbox is a contract, not a funnel. A message whose name the contract
does not list is **refused**: `MessageRouter.refuse` hands it to the
undeliverable handler and then the host, exactly as if the address did
not exist. A typo'd `send` that silently patches nothing is the message
equivalent of the silently ignored prop, and it is caught the same way —
loudly. The payload shape hints (`{ "open": "boolean" }`) are
documentation and a check, in that order.

Undeliverable messages likewise go to the host rather than being
dropped, because a message addressed to an inbox that does not exist is
a wiring mistake, and silently swallowing it is how those stay hidden
for weeks.

## The root is an actor too

A vibe's own root can hold state — a menu island whose bundle state is
`{ "open": false }`. For that, the bundle names itself:

```json
{
	"name": "menu-island",
	"accepts": { "set-open": { "open": "boolean" } }
}
```

Same rule, one level up: the payload merges into the **root** state.
Without this, the only way into the island would be `$host`, and the
host would have to know the island's internals.

## Who gets an inbox, and what it costs

`wireInboxes` (shared by `VibeEngine` and `Island`) registers:

- an inbox per actor declaring `accepts` — cost: a Map entry
- a sandbox instance per actor declaring `logic` — cost: a real runtime

The two used to be fused — reception gated on the sandbox — and the
fusion was a bug worth remembering: on a surface with no QuickJS
configured, *no* actor could receive a message at all. An address is
cheap; a runtime is expensive; an actor is an actor whether or not
anything expensive serves its inbox.
