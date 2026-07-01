# CustomNodeRegistry — node-kind extensibility standard: prep research for #2074

**Decision:** [#2074](../backlog/2074-customnoderegistry-node-kind-extensibility-standard.md) · surfaced from the
#1989 residue-grammar session (2026-07-01), which it now blocks · 2026-07-01 · research topic:
[`custom-node-registry`](../src/_data/researchTopics/custom-node-registry.json).

## The question

Is a **node-kind extensibility standard** worth proposing — a bounded, safe way to register new delimiter-based
syntaxes that materialize into DOM nodes — and in what shape? The idea (`customNodes : node kinds :: customElements :
tags`) surfaced when #1989's residue markers were reframed as the *serialized wire-format of a would-be region
node-kind*. The prep must decide whether this is a real proposable standard and settle the minimum shape that
unblocks #1989.

## Code ground truth (frontierui) — the pattern already ships, four times over

FUI already implements "register a node kind + upgrade-walk to materialize it" as **four parallel plug families**,
each with a registry + an upgrade walk:

| Family | Carrier node | Registry | Materialized subclass |
|---|---|---|---|
| **webexpressions** | `Text` | `fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts:31` | `CustomTextNode` (`fui:plugs/webexpressions/CustomTextNode.ts:48`) |
| **webdirectives (comment)** | `Comment` | `fui:plugs/webdirectives/CustomCommentRegistry.ts:50` | `CustomComment` (`fui:plugs/webdirectives/CustomComment.ts:27`) |
| **webdirectives (template)** | `HTMLTemplateElement` | `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:56` | `CustomTemplateType` (`fui:plugs/webdirectives/CustomTemplateType.ts:42`) |
| **webdirectives (script)** | `HTMLScriptElement` | `fui:plugs/webdirectives/CustomScriptTypeRegistry.ts:51` | `CustomScriptType` (`fui:plugs/webdirectives/CustomScriptType.ts:30`) |

Critical detail for the delimiter question: the text-node parser base class **already carries a 2-char
opening/closing delimiter grammar** — `openingIdentifier` (`fui:plugs/webexpressions/CustomTextNodeParser.ts:39`)
and `closingIdentifier` (`fui:plugs/webexpressions/CustomTextNodeParser.ts:45`) — with **two concrete parsers
shipped**: `{{`/`}}` (`fui:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts:19-22`) and `[[`/`]]`
(`fui:blocks/parsers/text-node/double-square/DoubleSquareBracketParser.ts`). Platform-decisions already says
"reuse its grammar" (`we:docs/agent/platform-decisions.md:747`) and shows `nodes="[[ data.tree ]]"` reusing the
expression parser (`we:docs/agent/platform-decisions.md:1018-1019`).

The upgrade walks differ only by `NodeFilter` (SHOW_COMMENT vs SHOW_TEXT —
`fui:plugs/webdirectives/CustomCommentRegistry.ts:75-83`), and the namespace guards already mirror the Custom
Elements reserved-name technique (`fui:plugs/webdirectives/CustomScriptTypeRegistry.ts:67-73` blocklists
`module`/`importmap`/`speculationrules`; `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:79-85` rejects `:`).
#1986 codified the three directive registries as **sibling** registries (`we:docs/agent/block-standard.md:568-590`).

**No `CustomNodeRegistry` exists** — it would be the generalization of these four. `customElements.define` is used
natively (no custom CE registry); `fui:plugs/webinjectors/InjectorRoot.ts:287-290` carries a TODO about a scoped CE
registry migration.

## Prior art — standards-track

- **DOM Parts / Template Instantiation** (WICG, the closest work): `{{ }}` delimiter syntax **inside the inert
  `<template>` carrier** (not a top-level parser change), materializing into addressable units. Crucially it models
  the new thing as **handles/positions into existing nodes, deliberately avoiding a new `Node` subclass**.
  `defineTemplateType(type, {processCallback, createCallback})` is a register-a-new-interpretation analog. **Status:
  stalled** — scope too broad, the low-level Parts perf case was a wash (±10-20%), three vendors never converged
  (2025-03-26 W3C minutes). Sources: WICG DOM-Parts + Template-Instantiation explainers (github.com/WICG/webcomponents).
- **Custom Elements hyphen rule** — the canonical extensibility-bounding technique: a valid custom element name
  **must contain a hyphen**, spec rationale *"for namespacing and to ensure forward compatibility (since no elements
  will be added to HTML/SVG/MathML with hyphen-containing local names going forward)."* The platform permanently
  forfeits a naming subspace so userland never collides with future built-ins. Source: WHATWG custom-elements.
- **The node-kind set is CLOSED and there is NO prior art for a new userland `nodeType`/`Node` subclass.**
  `Node.nodeType` is a small closed integer enum; pervasive `instanceof`/`switch(nodeType)` branching is why. Every
  extensibility mechanism extends *within* Element (Custom Elements) or adds *handles onto* existing nodes (DOM
  Parts). **This is the load-bearing risk in "node-KIND" framing.** Source: MDN Node.nodeType; exhaustive-negative,
  flagged UNCERTAIN only in that absence-of-proposal can't be fully proven.
- **Fresh, on-point precedent — WHATWG PR #12118, merged 2026-06-25:** HTML now parses `<?target data?>` into a
  **real `ProcessingInstruction` node** when the target matches `[letter][alnum|-|_]*`, with `xml`/`xml-stylesheet`
  **blocklisted** (kept as bogus comments). The platform is *actively re-opening a delimiter→non-Element-node path*
  with exactly the bounding technique (target-grammar + blocklist) this proposal wants. Chromium + WebKit committed.
- **Inert-carrier / opt-in precedents:** `<template>` (new inert content model), `<script type=importmap|…>` (any
  unknown `type` is an inert "data block"), `<!DOCTYPE html>` (mode switch), `"use strict"` (directive prologue
  riding a no-op string). **Cross-cutting law: successful extensions hide new syntax inside an already-inert carrier
  OR reuse a token legacy parsers tolerate as a no-op** — top-level new delimiter syntax forgoes this.
- **Scoped Custom Element Registries** (WHATWG #10854) — precedent for a scoped/pluggable registry object shape.

## Prior art — framework delimiter grammars

- `{{` **dominates** as the interpolation opener (Mustache, Handlebars, Vue, Angular, Liquid, Jinja-family, Blade —
  7/10). 2-char openers are the **modal case** (`{{`, `{%`, `{#`, `<%`, `@(`, `@{`, `@*`).
- **Per-character reflected close is well-precedented**, not novel: `{%`→`%}`, `{#`→`#}` (Jinja/Liquid family, five
  engines), `[(`→`)]` (Angular banana-in-a-box), `@*`→`*@` (Razor). The proposed `{$`→`$}` is structurally identical
  to Liquid's `{%`→`%}`. The lone counter-case is ERB `<%`→`%>` (a tag-echo, not a mirror — `%>` ≠ `%<`).
- **The expression-vs-statement two-family split is near-universal** — `{{ }}` (emit a value) vs `{% %}` (control
  flow/block), explicit in the entire Jinja/Liquid family and in spirit everywhere (Blade `{{ }}` vs `@directive`,
  Svelte `{x}` vs `{#if}`, ERB `<%= %>` vs `<% %>`). **Keying node kinds by opening delimiter is aligned with
  universal prior art.**
- **Escaping is universal and mandatory:** every `{{`-engine ships a raw/verbatim escape hatch (`{% raw %}`,
  `@verbatim`, `{{{{raw}}}}`) and usually a delimiter-override, precisely because `{{` collides when two template
  layers stack. **A `{{`-keyed kind must ship an escape hatch + override from day one.**
- Variable-length delimiters (`{{`/`{{{`) exist only as an escaping modifier (Mustache), never to key different
  kinds — a **fixed 2-char keying rule is cleaner than any deployed system.**

## Synthesis → the forks (see the item)

1. **What is a "custom node kind"?** Forced toward: a registered grammar that **materializes into a subclass of an
   existing node kind** (Text/Comment/Element — what DOM Parts, Custom Elements, the PI PR, and all four FUI
   families already do), **not** a new `nodeType` (zero prior art, closed enum). The literal "new kind" is the
   north-star residual, documented, not the proposable shape.
2. **Unification scope** — one shared `CustomNodeKind` **registration contract** that the existing per-carrier
   registries implement (predicate/interface unity, mirroring #1989 Fork 2 and #1986's ratified sibling structure),
   vs one monolithic registry (dominated) vs status-quo four-unrelated-registries.
3. **Delimiter grammar** — 2-char opening + per-character reflected close, keyed into the expression/statement
   two-family split, **with a mandatory raw/verbatim escape hatch + delimiter-override** — grounded in the
   near-universal precedent and FUI's shipped `{{`/`[[` parsers. Alternative: allow non-reflected tag-echo closes
   (ERB-style) — rejected, breaks the "never memorize the close" consistency win.

Supported-by-default (not forks): **extends-Element-or-not is per-kind config** (FUI already mixes Text/Comment/
Template/Script subclasses — the carrier decides); **expression interpolation is already one instance** of the
pattern (webexpressions), not a separate seam. Deferred to children: the comment-directive spec, the concrete
reserved-delimiter-family policy (the hyphen-rule analogue applied to delimiters).

Statute-overlap: this **generalizes** #1986's directive-registration mechanism — #1986's three registries become
instances of the node-kind contract. Codifies into a new `we:docs/agent/block-standard.md` section (or
`we:docs/agent/platform-decisions.md` anchor) that #1986 nests under; reconcile at ratification, don't duplicate.
