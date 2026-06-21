# Grounding: scope of the #1120 `define()`-name validation across registries

**Date:** 2026-06-20
**For:** backlog #1347 (decision) — *Does #1120 `define()`-name validation apply beyond
`CustomAttributeRegistry`?*
**Type:** concrete-refs grounding (ratify-shipped-code decision — no greenfield design, so per
`we:docs/agent/backlog-workflow.md → Fork-readiness pass` the web prior-art survey + `/research/` topic are
skipped; this report is the concrete-refs artifact linked as `relatedReport`).

## What #1120 actually shipped

`we:plugs/webbehaviors/CustomAttributeRegistry.ts:193-199` adds a private `#assertValidName(name)` that
throws a `SyntaxError` unless the name contains a `-` **or** a `:`. It is called from that class's own
`define()` (`:202`) and `defineLazy()`/second registration path (`:277`). The doc-comment
(`we:plugs/webbehaviors/CustomAttributeRegistry.ts:186-192`) states the **reason** explicitly: a custom-attribute name must
carry a namespace separator *"so it can't collide with a standard HTML attribute"*, mirroring the
`SyntaxError` native `customElements.define` throws. Colon is accepted because the namespaced form
(`nav:list`) is an established convention and a colon can't appear in a standard HTML attribute name either.

The guard is **local to `CustomAttributeRegistry`**. It is NOT in the shared base:

- `we:plugs/core/CustomRegistry.ts:19,35` — abstract base, default `define(name, …)`, **no name guard**
  (the comment at `:29-30` explicitly notes subclasses may override the registration shape).
- `we:plugs/core/HTMLRegistry.ts:21` — `extends CustomRegistry`, no name guard.
- `we:plugs/webbehaviors/CustomAttributeRegistry.ts:117` — `extends HTMLRegistry`, **adds** the guard.

So #1120's authors made a deliberate per-registry placement, not a base-class invariant.

## The registries that register bare single-word names

From `fui:plugs/bootstrap.ts`, the live bare single-word registrations are all in the
**parser / grammar** registries, none of which is `CustomAttributeRegistry`:

- `fui:plugs/bootstrap.ts:190-192` — `expressionParsers.define('value'|'pipe'|'call', …)` →
  `we:plugs/webexpressions/CustomExpressionParserRegistry.ts:64` (`extends CustomRegistry`, own `define()`
  at `:73`, no guard).
- `fui:plugs/bootstrap.ts:200-201` — `textNodeParsers.define('mustache'|'polymer', …)` →
  `we:plugs/webexpressions/CustomTextNodeParserRegistry.ts:31` (`extends CustomRegistry`, `override
  define()` at `:47`, no guard).
- `fui:plugs/bootstrap.ts:211-212` — `textNodes.define('mustache'|'polymer', …)` →
  `we:plugs/webexpressions/CustomTextNodeRegistry.ts:46` (`extends HTMLRegistry`, `define()` at `:63`, no
  guard).

`value`, `pipe`, `call`, `mustache`, `polymer` are the **established grammar** of the expression /
text-node interpolation engine — internal framework tokens, chosen by the framework, that never appear in
the DOM as attribute names.

## The discriminating property (surfaced by the classification pass)

There are ~18 `CustomRegistry`/`HTMLRegistry` subclasses across the plugs layer (guards, change/storage
strategies, validity merge, trackers, comment/attribute parsers, contexts, stores, elements, …). A flat
"all `define()` registries" rule would touch all of them. The real discriminator is **namespace
sharing**:

| Registry group | Key becomes… | Shares a host namespace? | Collision risk #1120 guards against |
|---|---|---|---|
| `CustomAttributeRegistry` | a DOM **attribute** name | **yes** — HTML attribute namespace | real → guard justified |
| `CustomElementRegistry` | a custom-element **tag** | yes — but the platform itself forces a hyphen | already covered natively |
| `CustomStoreRegistry` / `CustomContextRegistry` | author-facing id (examples already hyphenate: `my-store`, `my-context`, `fui:plugs/bootstrap.ts:9-10`) | no | none |
| parser / text-node / grammar registries | an **internal grammar token** (`value`, `mustache`, …) | **no** — never DOM-facing | none |

The guard's *reason* (avoid collision with standard HTML attribute names) only obtains where the key enters
the HTML attribute namespace. Parser-grammar tokens never do, so the reason does not transfer.

## Platform precedent already cited in-code

`customElements.define` requires a hyphen for **element** names because tags can't carry a colon; custom
*attributes* may, hence #1120's hyphen-OR-colon rule. The platform applies the naming constraint **only to
the namespace that actually collides with built-ins** (element tags), not to every framework-internal
identifier — the same principle that scopes the guard here.

## Conclusion fed into the prepared fork

The shipped placement, the guard's stated reason, the native precedent, and the standing
most-permissive-default / separate-and-decouple biases all point the same way: scope the guard by
**whether the registry's key shares a host namespace**, which today means `CustomAttributeRegistry` only.
The parser/grammar registries keep bare single-word grammar names. Confidence ~85%; the residual is a
future reader expecting one uniform syntactic rule across all `define()` calls for cognitive consistency —
addressed by documenting the namespace-collision rationale rather than imposing a hyphen everywhere.
