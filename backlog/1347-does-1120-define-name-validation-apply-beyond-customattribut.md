---
kind: decision
parent: "1250"
locus: frontierui
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedProject: webplugs
relatedReport: reports/2026-06-20-define-name-validation-scope.md
tags: [plugs, webbehaviors, naming, validation]
---

# Does #1120 define()-name validation apply beyond CustomAttribute (parser/expression registries)?

Naming-scope fork gating the #1333/#1120 throw flip and the [#1348](/backlog/1348-enforce-1120-name-validation-throw-in-fui-webbehaviors-renam/)
enforcement build. Carved out of #1333 (`/slice` 2026-06-20) so the fork doesn't ride buried in a build
body. This ratifies the **scope** of shipped naming — no greenfield design — so prep skipped the web
survey and grounded against the real tree; concrete-refs artifact: `we:reports/2026-06-20-define-name-validation-scope.md`.

## Grounding digest

- **The guard is local to `CustomAttributeRegistry`, not the base.** #1120 added `#assertValidName` (throws
  unless the name contains `-` **or** `:`) and wired it into `CustomAttributeRegistry.define()` and the
  second registration path — `we:plugs/webbehaviors/CustomAttributeRegistry.ts:193-199,202,277`. The shared
  base `we:plugs/core/CustomRegistry.ts:19,35` has **no** name guard (its comment at `:29-30` notes
  subclasses may override the registration shape); `we:plugs/core/HTMLRegistry.ts:21` adds none either. So
  the placement was a deliberate per-registry choice, not a base invariant accidentally narrowed.
- **The guard's stated reason is HTML-attribute collision.** The doc-comment
  `we:plugs/webbehaviors/CustomAttributeRegistry.ts:186-192` says the separator exists *"so it can't
  collide with a standard HTML attribute"*, mirroring the `SyntaxError` native `customElements.define`
  throws; `:` is accepted because `nav:list` is an established namespace form and a colon can't appear in a
  standard attribute name.
- **The only bare single-word registrations are internal grammar tokens.** `fui:plugs/bootstrap.ts:190-192`
  (`expressionParsers.define('value'|'pipe'|'call')`), `fui:plugs/bootstrap.ts:200-201`
  (`textNodeParsers.define('mustache'|'polymer')`), `fui:plugs/bootstrap.ts:211-212`
  (`textNodes.define('mustache'|'polymer')`). Their registry classes
  (`we:plugs/webexpressions/CustomExpressionParserRegistry.ts:64`,
  `we:plugs/webexpressions/CustomTextNodeParserRegistry.ts:31`,
  `we:plugs/webexpressions/CustomTextNodeRegistry.ts:46`) carry **no** name guard. `value`/`pipe`/`call`/
  `mustache`/`polymer` are the established grammar of the interpolation engine — framework-internal tokens
  that never appear in the DOM.
- **There are ~18 `CustomRegistry` subclasses** (guards, change/storage strategies, validity-merge,
  trackers, comment/attribute parsers, contexts, stores, elements, …). A flat "all `define()` registries"
  rule would touch every one; the author-facing ones (stores/contexts) already hyphenate by convention
  (`fui:plugs/bootstrap.ts:9-10`), and element names are hyphen-forced by the platform itself.

## Axis framing

The real axis is **namespace sharing**, not "is it a `define()` call." #1120's guard exists to keep a key
out of a namespace it shares with the host platform — the **HTML attribute** namespace — where a bare name
would collide with a built-in (`title`, `value`, `type`…). A registry's keys are guard-worthy iff they
*enter that shared namespace*. By that test (read off the tree above): `CustomAttributeRegistry` keys
become DOM attributes → **shared** → guard justified; `CustomElementRegistry` keys become tags →
hyphen-forced **natively** already; store/context keys are author-private ids (and hyphenate by
convention); parser / text-node / grammar registry keys are **framework-internal tokens** that never reach
the DOM → **not shared** → the guard's reason does not transfer. The fork is therefore whether the rename
scope is set by this *namespace-collision* property (guard where keys are HTML-facing — today
`CustomAttributeRegistry` only) or by a flat *syntactic uniformity* rule (every `define()` key must carry a
separator regardless of namespace).

## Classification (per-fork pass)

- **Layer:** WE standard concern — the naming invariant on the `define()` contract (#1120 is resolved in
  WE `we:plugs/webbehaviors/`); enforcement is per-registry in FUI. Not a protocol/intent dimension.
- **Fixed mechanic vs dimension:** **fixed mechanic per registry**, *derived* from each registry's
  key-namespace — not a configurable knob (no legitimate end-state where the same registry's keys are
  sometimes guarded, sometimes not).
- **DI-injectable:** no.
- **Most-permissive default:** the permissive default is **not** to add a throw to the grammar registries
  (restriction is the author's opt-in) → supports (a).
- **Separate-and-decouple bias:** keep deliberate per-registry grammar over a forced global rule → supports
  (a). Burden of proof is on combining into one uniform rule; (b) has not met it (no collision surface to
  justify the restriction).

## Recommended path at a glance

| Fork | Options | Recommended default | Confidence |
|---|---|---|---|
| Rename scope of #1120's guard | (a) namespace-collision-scoped → `CustomAttributeRegistry` only · (b) flat syntactic rule across all `define()` registries | **(a)** — keep grammar registries' bare tokens | ~85% |

## Fork 1 — does the #1120 guard generalize beyond `CustomAttributeRegistry`?

*Fork-existence:* genuine either/or — the two branches set **mutually exclusive** rename scopes for #1348
(you cannot both keep `mustache` and rename it to `text:mustache`), and the excluded branch is coherent on
its face (a reader could argue uniform syntax aids consistency), so this is a real fork, not a
support-both. The branch (b) excludes is "bare grammar tokens are fine"; the branch (a) excludes is "one
syntactic rule everywhere regardless of namespace."

- **(a) Namespace-collision-scoped — guard stays on `CustomAttributeRegistry` only (recommended, ~85%).**
  The throw applies where keys enter a host-shared namespace; today that is `CustomAttributeRegistry`
  alone (element names are already hyphen-forced natively). The parser/expression/text-node registries keep
  their bare single-word grammar (`value`, `pipe`, `call`, `mustache`, `polymer`). Grounded in: the guard's
  shipped placement (`we:plugs/webbehaviors/CustomAttributeRegistry.ts:193-202`, base guard-less at
  `we:plugs/core/CustomRegistry.ts:35`), its stated collision reason (`we:plugs/webbehaviors/CustomAttributeRegistry.ts:186-192`),
  the native precedent (the platform forces hyphens only on element tags, the namespace that collides), and
  the most-permissive-default + separate-and-decouple biases. **#1348 rename scope:** only bare
  *CustomAttribute* names (if any) rename; the parser registries are untouched.
- **(b) Flat syntactic rule — every `define()`-bearing registry hyphenates / colon-namespaces.** One
  uniform rule across all ~18 registries; forces `value`→`expr:value`, `mustache`→`text:mustache`-style
  renames across the grammar registries (and a `#assertValidName` added to each, or pushed into the base).
  The case for it is cognitive consistency — one rule a reader learns once. It is **not** recommended: it
  imposes a restriction with no collision surface to justify it, contradicts the deliberate base-class
  guard-lessness, and churns the established interpolation grammar for no safety gain. **#1348 rename
  scope:** parser-registry names rename too.

*Red-team note for the deciding turn:* the strongest attack on (a) is the consistency argument — "a future
contributor calls `someRegistry.define('foo')` expecting the same rule everywhere and is surprised it's
allowed." The default answer: the rule **is** uniform once stated correctly — *guard the namespace you
share with the host* — and that's documentable in one line on the base `define()` doc-comment; surprise is
cured by documentation, not by churning grammar tokens that have no collision surface. The residual ~15%
is purely that someone may still prefer flat syntax for its own sake; flag this fork for the decider's
skeptic sub-pass.

The ruling sets the **rename scope** of [#1348](/backlog/1348-enforce-1120-name-validation-throw-in-fui-webbehaviors-renam/).
