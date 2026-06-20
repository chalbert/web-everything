---
kind: decision
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
relatedProject: webplugs
tags: [plugs, webbehaviors, naming, validation]
---

# Does #1120 define()-name validation apply beyond CustomAttribute (parser/expression registries)?

Naming-scope fork gating the #1333/#1120 throw flip and the [#1348](/backlog/1348-enforce-1120-name-validation-throw-in-fui-webbehaviors-renam/)
enforcement build. WE #1120 (resolved, `we:plugs/webbehaviors/CustomAttributeRegistry.ts`) put a
hyphen-**OR**-colon `#assertValidName` guard **on `CustomAttributeRegistry.define()/defineLazy()` only** —
its intent is collision-avoidance with standard HTML attribute names (a colon namespace satisfies it too,
so `nav:list` is accepted). Carved out of #1333 (`/slice` 2026-06-20) so the fork doesn't ride buried in a
build body.

## The fork

FUI registers **bare single-word names** in registries that are **not** `CustomAttributeRegistry`:

- `fui:plugs/bootstrap.ts:190-192` — `expressionParsers.define('value'|'pipe'|'call', …)` →
  `CustomExpressionParserRegistry`
- `fui:plugs/bootstrap.ts:200-201` — `textNodeParsers.define('mustache'|'polymer', …)` →
  `CustomTextNodeParserRegistry`
- `fui:plugs/bootstrap.ts:211-212` — `textNodes.define('mustache'|'polymer', …)` →
  `CustomTextNodeRegistry`

In those registries single-word tokens (`value`, `pipe`, `mustache`, `polymer`) are the **established
grammar**, not HTML-attribute-colliding names. So:

- **(a) CustomAttribute-only (lean ~75%).** The throw stays on `CustomAttributeRegistry`; the parser/
  expression/text-node registries keep bare single-word grammar names. Rationale: #1120's guard already
  lives only on `CustomAttributeRegistry`; its *reason* (collision with native HTML attributes) doesn't
  apply to parser-grammar tokens, which never become attributes. Residual: a future reader may expect a
  *uniform* naming rule across all `define()`-bearing registries — (a) accepts deliberate per-registry
  grammar instead.
- **(b) All `define()`-bearing registries hyphenate / colon-namespace.** One uniform rule; would force
  `value`→`expr:value` / `mustache`→`text:mustache`-style renames across the parser registries.

The ruling sets the **rename scope** of [#1348](/backlog/1348-enforce-1120-name-validation-throw-in-fui-webbehaviors-renam/):
under (a) only bare *CustomAttribute* names rename; under (b) the parser-registry names rename too.
