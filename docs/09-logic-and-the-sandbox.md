# Logic and the sandbox

A vending machine takes a coin and a button press, and hands out a can.
You do not get to reach inside it, and it does not get to reach into
your pockets. That is the deal an actor's `logic` gets: messages in, next
state out, and no hands through the glass in either direction.

## Behaviour as data

An actor that needs real behaviour — branching, validation, computation —
declares it as `logic`: a string of source code carried in the
definition, exactly as the view is carried as JSON.

```json
{
	"name": "checkout",
	"interface": {
		"accepts": { "apply-coupon": { "code": "string" } }
	},
	"state": { "total": 100, "discount": 0 },
	"logic": "..."
}
```

Behaviour-as-data completes the picture: view, style, state and logic
are all data, so a whole vibe can be stored in a database, sent over a
wire, authored by a tool, reviewed as text — and run without being
trusted.

One rule guards the door: `validateActor` rejects an actor that declares
`logic` without `interface.accepts`. Logic with no inbox contract is an
actor nobody can talk to on purpose — almost always an actor written
before `accepts` existed — and refusing it at validation turns a silent
dead letterbox into a build error with a named fix.

## The engine never runs the code

This package is pure — no filesystem, no Node built-ins, nothing
platform-specific — so it *cannot* execute the logic itself, and that
inability is the design. The surface supplies a `SandboxHost`:

```ts
type SandboxHost = {
	start(options: {
		unit: ActorDef
		address: string
		initialState: Record<string, unknown>
	}): Promise<ActorInstance>
}

type ActorInstance = {
	send(event: {
		send: string
		payload: Record<string, unknown>
	}): Promise<Record<string, unknown>>
	dispose(): void | Promise<void>
}
```

That is the entire contract: a host starts an instance, and an instance
answers `send` and `dispose`. The engine drives it and nothing else. On
desktop the host is QuickJS inside a Tauri plugin; in the browser it is
a worker; in a test it is ten lines of TypeScript. An actor's logic must
behave identically wherever it runs, so it is written against a message
interface and never against a runtime — the indirection is the point
rather than a compromise.

## What a message round-trip looks like

When a message arrives at a logic-bearing actor's inbox (wired by
`wireInboxes`):

1. the contract check — a `send` the `accepts` clause does not name is
   refused before any code runs
2. `instance.send({ send, payload })` crosses into the sandbox
3. the logic computes and returns the next state
4. the reply **replaces that actor's state slice** — `{ [actor.name]:
   next }` — and nothing else. An actor's logic owns its own state; it has
   no way to write anyone else's.

Compare the declarative tier, where the payload *merges* into the slice.
Logic upgrades the handler; it does not change the addressing, the
contract, or the refusal path.

## What the sandbox cannot do

The logic runs with no DOM, no network, no timers it was not given, and
no reference to the page. It cannot query an element, install a global,
or phone home. If it hangs or throws, the instance is disposable —
`dispose` tears it down — and the rest of the vibe keeps rendering.

This is why a vibe can be "authored, shipped and even generated without
handing it the run of your application". The threat model is not
hypothetical: definitions are meant to come from CMSes, tools and
models. Views are safe because they are inert data; logic is safe
because it runs inside the vending machine.

## When to reach for logic at all

Later than you think. The declarative inbox covers every behaviour of
the shape "message in, state patch out" — menus, tabs, counters, form
fields. Reach for `logic` when the next state genuinely depends on
computation: validating a coupon, checking a name, pricing a cart. If
your logic function would just copy the payload into state, delete it
and let the engine do the merge; booting a QuickJS context per button
would make the model uniform and the page slow.
