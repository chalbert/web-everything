---
kind: decision
status: open
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
preparedDate: "2026-07-01"
relatedReport: reports/2026-07-01-custom-node-registry.md
tags: [standard-proposal, custom-nodes, node-kind, webdirectives, webexpressions, expressions, native-first, decision]
---

# CustomNodeRegistry — a node-kind extensibility standard (`customNodes` : node kinds :: `customElements` : tags)

**Prepared, ready to ratify.** The question is not "can userland do this today" (it can't — that's the normal
starting point for a WE proposal, per the plug = proposed-missing-standard model) but **"is a node-kind
extensibility standard worth proposing, and in what shape."** Prep verdict: **GO — but honestly reframed by the
survey and a skeptic pass.** The proposable, precedented shape is *registered delimiter/keyed grammars that
materialize into existing DOM node kinds* (what DOM Parts, Custom Elements, the fresh PI PR, and FUI's own four
registries all do) — **not** minting a new `nodeType`, which has zero prior art. **Honest-naming caveat (folded from
the skeptic):** the ratifiable invariant is the *negative* — *never mint a new `nodeType`*; "node-*kind*
extensibility" is the aspirational north-star framing, and the standard should say so plainly rather than imply an
extension point at the `nodeType` enum it deliberately refuses. Grounded in a code read of the real FUI tree plus a
standards-track + framework prior-art survey published as the [`custom-node-registry`](/research/custom-node-registry/)
topic (report via `relatedReport`).

## Grounding digest

The "register a kind + upgrade-walk to materialize it" pattern **already ships in FUI four times over**, as parallel
plug families: **webexpressions** (`Text` → `CustomTextNode`, via `CustomTextNodeParserRegistry`), and
**webdirectives** in three carriers — comment (`Comment` → `CustomComment`), template (`HTMLTemplateElement` →
`CustomTemplateType`), script (`HTMLScriptElement` → `CustomScriptType`). #1986 ratified the three directive
registries as **sibling** registries (`we:docs/agent/block-standard.md:568-590`). The text-node parser base class
**already carries an opening/closing delimiter grammar** and ships `{{`/`}}` and `[[`/`]]` parsers;
platform-decisions already says "reuse its grammar" (`we:docs/agent/platform-decisions.md:747`). So this decision is
not greenfield invention — it is **naming and unifying a primitive the codebase already has four instances of**, and
deciding the shape of its standard.

The survey moved the framing twice. (1) Every precedent (DOM Parts / Template Instantiation, Custom Elements, the
2026-06-25 PI PR, all four FUI families) extends *within* an existing node kind or adds *handles onto* one — **there
is no prior art for a userland-minted `nodeType`.** (2) The skeptic pass surfaced that "materialize into a subclass"
is only *one* of the admissible non-minting shapes (subclass · reuse-a-dormant-kind · handle), and that the delimiter
fork bundled three separable decisions. Both fold below.

## Axis-framing

The forced direction — *the pattern exists; name it and propose it as a standard* — is not re-litigated here (four
shipped registries + a stalled WICG effort at the same target = a real, un-owned primitive). What is open is the
**shape**, and three genuine calls fall out. **Fork 1** — what a "custom node" *is*: a subclass of an existing kind
(`fui:plugs/webexpressions/CustomTextNode.ts:48` extends `Text`; `fui:plugs/webdirectives/CustomComment.ts:27`
extends `Comment`), a reuse of a dormant standard kind (the PI PR), or a handle (DOM Parts) — but never a new
`nodeType` (`Node.nodeType` is a closed integer enum). **Fork 2** — the unification scope across the four registries
(`fui:plugs/webexpressions/CustomTextNodeParserRegistry.ts:31`, `fui:plugs/webdirectives/CustomCommentRegistry.ts:50`,
`fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:56`, `fui:plugs/webdirectives/CustomScriptTypeRegistry.ts:51`).
**Fork 3** — the delimiter grammar the text/comment-carried kinds register with
(`openingIdentifier`/`closingIdentifier` at `fui:plugs/webexpressions/CustomTextNodeParser.ts:39,45`). The
*extends-Element-or-not*, *family-split*, and *escape-hatch* questions are **not** forks (see Supported by default).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — what is a custom node | **never a new `nodeType`; materialize as one of three admissible shapes — (a) subclass an existing kind [default, shipped], (b) reuse a dormant standard kind (cf PI PR), (c) a handle (cf DOM Parts)** | mint a new `nodeType`/`Node` subclass (the literal north-star; *zero prior art, closed enum* — documented residual) | high |
| **Fork 2** — unification scope | **share a `CustomNodeKind` contract only across the delimiter-grammar leaves (Text + Comment); keep Template/Script as attribute-keyed sibling registries with no forced common interface** | one contract over all four (premature, leaky) · one monolithic registry · leave four unrelated | med-high |
| **Fork 3** — delimiter grammar | **close = reverse-mirror of the open (`{$`→`$}`, `<%`→`%>`), name-echo for named paired kinds (`{{#x}}`→`{{/x}}`); length not fixed at 2** | author-declares an arbitrary close per kind · hard-fixed 2-char | med-high |

## Retro-compatible by construction (supported invariant — not a fork)

**A page that registers no custom node does nothing** — unregistered delimiter syntax is inert text, exactly as an
unregistered `<my-el>` is an inert unknown element. Opt-in and backward-compatible by construction. This is the
platform-shape guarantee (`<template>` inert content model, `<script type>` data blocks, `<!DOCTYPE html>` /
`"use strict"` mode switches), not a branch to pick.

## The polyfill path is already covered (supported — not a fork)

The near-term polyfill needs no new primitive — it composes ones that exist: **`transform`** (stamp-time
materialize, e.g. `fui:blocks/view/ViewIfDirective.ts:147-163`), **`CustomTextNodeParser`** (delimiter syntax in
text — `{{ }}` / `[[ ]]`), and **`CustomComment`** (paired-region carrier). A registered custom node materializes
from these carriers today and gains first-class identity once standardized — a working degradation story, not just a
spec wish.

## Fork 1 — what is a "custom node": a new `nodeType`, or a non-minting materialization?

**Fork-existence:** a genuine either/or with the aggressive branch under heavy evidentiary pressure — a custom node
is *either* a brand-new `Node`/`nodeType` (the literal reading of the title) *or* a non-minting materialization into
the existing kind space. The branches cannot both be "what the standard proposes." The new-`nodeType` branch is not
logically impossible (the platform *could* add a kind), so this is a **merit weigh, not a forced invariant** — but
the merit is lopsided and the *default is the negative rule*, not a single positive shape (the skeptic's correction).

Crux: does the standard's credibility and polyfillability survive the branch?

- **(a) Never mint a new `nodeType`; materialize as one of three admissible shapes** *(recommended default, high)*:
  - **(i) subclass an existing kind** — what all four FUI families do (`fui:plugs/webexpressions/CustomTextNode.ts:48`
    : `Text`; `fui:plugs/webdirectives/CustomComment.ts:27` : `Comment`); polyfillable today; the default shape.
  - **(ii) reuse a dormant standard kind** — cf. WHATWG PR #12118 (merged 2026-06-25), which materializes `<?…?>`
    into the existing `ProcessingInstruction` kind, gated by target-grammar + blocklist. A live platform precedent
    for delimiter→distinct-kind *without* a subclass or a new integer.
  - **(iii) a handle with no new node** — cf. DOM Parts, which models `{{ }}` as positions into existing nodes.
  - The unifying invariant: `switch (node.nodeType)` / `instanceof Text` across the ecosystem keeps working, because
    no new kind enters the enum. **The skeptic's naming point is folded:** because (i) yields `nodeType === 3` etc.,
    "node-*kind* extensibility" is an overclaim — the honest name is closer to "a unified directive/expression node
    registry"; the standard states the negative invariant, not a new-kind promise.
- **(b) Mint a new `nodeType` / `Node` subclass** — *Rejected (dominated):* the literal north-star, not *broken*, but
  `Node.nodeType` is a **closed integer enum** with pervasive `instanceof`/`switch` branching everywhere, and **zero
  prior art** for a userland kind. Un-polyfillable, un-shippable without a decade-long platform fight. **Kept as a
  documented residual.**

```
// (a) default — materialize into the EXISTING kind space; never a new nodeType:
class ContextProvider extends Comment {}                    // (i) subclass — nodeType 8, is-a Comment
customNodes.define({ carrier: 'comment', name: 'context-provider', ctor: ContextProvider })
//   (ii) reuse dormant kind: a ProcessingInstruction target (cf PR #12118)  — no subclass, no new integer
//   (iii) handle: a Part positioned in an existing node (cf DOM Parts)      — no new node object
// (b) rejected — breaks switch(node.nodeType) everywhere, no userland path:
class X extends Node { static nodeType = 42 } // ← no
```

`Skeptic: SURVIVES-WITH-AMENDMENT — the technical core (never mint a nodeType) holds and is arguably *forced* for
anything living in the tree; two amendments folded: (1) the default is the **negative rule** with **three** admissible
materializations (subclass / dormant-kind-reuse per PI PR / handle per DOM Parts), not the single "MUST subclass" the
draft asserted; (2) the "node-kind extensibility" **name** overclaims — flagged in the verdict and here, invariant
restated as the negative. The new-nodeType branch stays dominated (zero prior art, closed enum).`

## Fork 2 — unification scope: contract across all four, across the alike two, a monolith, or unrelated?

**Fork-existence:** a genuine either/or — the registries can share *one registration contract* (all four, or only the
alike ones), collapse into *one monolithic registry*, or stay *unrelated*. One catalog shape; they cannot all be
"the" structure. None is broken → a **merit weigh**, echoing #1989 Fork 2's unity question a layer up.

Crux (sharpened by the skeptic): the four do **not** share load-bearing mechanics — only a slogan. `SHOW_TEXT` vs
`SHOW_COMMENT` vs element-tag matching; and Text/Comment are **leaf nodes keyed by a delimiter grammar**, whereas
Template/Script are **attribute-keyed** (`type=`), have children, and carry clone/inert-content semantics leaves
never touch. A contract general enough to span all four collapses to `{ matches(node); upgrade(node) }` — near-empty
and leaky.

- **(a) Share a `CustomNodeKind` contract only across the delimiter-grammar leaves (Text + Comment); keep
  Template/Script as attribute-keyed sibling registries with no forced common interface** *(recommended default,
  med-high)*:
  - Text + Comment genuinely share the `openingIdentifier`/`closingIdentifier` grammar (Fork 3's substance) and a
    leaf-node upgrade — a real, non-leaky common surface.
  - Template/Script are attribute-keyed with element lifecycles; forcing them under the same interface buys nothing.
  - **Honesty correction (skeptic):** #1986's *sibling filing* is a placement fact, **not** evidence of an
    implementable supertype — `HTMLTemplateElement`/`HTMLScriptElement` are siblings under `HTMLElement` yet share no
    directive contract. Do not cite the sibling relationship as proof a common interface exists.
- **(b) One contract over all four** — *Rejected:* premature abstraction; the shared surface is near-empty and leaks
  the delimiter grammar (which only two carriers have).
- **(c) One monolithic registry** — *Rejected:* couples four lifecycles for a marginal single-pass win the differing
  `NodeFilter`s negate.
- **(d) Leave four unrelated** — *Rejected:* then the node-kind standard has no single surface to codify and the
  #1989-style serialization questions recur per carrier.

```ts
// (a) default — contract spans ONLY the delimiter-grammar leaves; Template/Script stay attribute-keyed siblings:
interface CustomNodeKind {              // implemented by CustomTextNodeParserRegistry + CustomCommentRegistry
  readonly carrier: 'text' | 'comment'  // both leaf, both grammar-keyed
  readonly opening: string; readonly closing: string
  upgrade(node: Text | Comment): void
}
// CustomTemplateTypeRegistry / CustomScriptTypeRegistry: siblings, attribute-keyed, NO shared supertype forced.
```

`Skeptic: SURVIVES-AS-SCOPE-CUT — the attack lands as a narrowing, not a reversal: a contract over *all four* is
premature/leaky (they differ in NodeFilter + carrier lifecycle), and the #1986-sibling citation was a cherry-pick
(siblings ≠ shared supertype) — both folded. But it does not reach "leave unrelated": Text+Comment genuinely share
the delimiter grammar and should share a contract. Default narrowed from four-way to leaves-only.`

## Fork 3 — delimiter grammar for text/comment-carried kinds

**Fork-existence:** a genuine either/or on the reserved grammar a delimiter-keyed kind registers with — the close is
either *mechanically derived from the open* or *author-declared per kind*. One catalog rule; both ship in the wild →
a **merit weigh**. (The skeptic's key service: the draft **bundled three separable decisions** — grammar shape,
family split, escape hatch. Only the *grammar shape* is this fork; the other two are Supported-by-default below.)

Crux: a delimiter grammar should be predictable (close derivable from open), collision-safe, and aligned with what
authors know.

- **(a) Close = reverse-mirror of the open; named paired kinds echo the name** *(recommended default, med-high)*:
  - **Reverse-mirror is well-precedented and covers the asymmetric cases too** — reverse the opening, mirror each
    bracketing char (non-bracket chars are identity): `{{`→`}}`, `[[`→`]]`, `{$`→`$}`, **`{%`→`%}`, `<%`→`%>`**,
    `{{--`→`--}}`. (This corrects the skeptic's factual slip — it read "reflection" as naive same-position and
    concluded ERB/Jinja were excluded; under reverse-mirror they are *included*.)
  - **Named paired kinds echo the name on the close** — `{{#each}}`→`{{/each}}` (Handlebars), and #1989's
    `[for-each`→`]for-each`: the *delimiter* reverse-mirrors, the *name* echoes with a close sigil. This folds the
    one genuine residual the skeptic raised (name-echo block closes) into the rule rather than against it.
  - **Length is not fixed at 2** (skeptic amendment): 2-char is the recommended common case, but real grammars use
    3 (`{{{`) and 4 (`{{--`); the rule is "reverse-mirror," length is free. FUI ships 2-char `{{`/`[[`.
- **(b) Author declares an arbitrary close per kind** — *Rejected:* maximally flexible but forfeits the "never
  memorize the close" predictability win and lets two co-resident kinds pick confusably-similar closes; reverse-mirror
  already admits every real grammar surveyed, so the flexibility buys little.

```ts
// (a) default — close is derived (reverse-mirror), not author-chosen; named kinds echo the name:
const mirror = (c: string) => ({ '{':'}', '[':']', '(':')', '<':'>' }[c] ?? c)   // non-brackets identity
const reflect = (open: string) => [...open].reverse().map(mirror).join('')
reflect('{$')   // '$}'      reflect('<%') // '%>'      reflect('{{--') // '--}}'
// named paired kind (Handlebars / #1989 residue): delimiter reflects, name echoes with close sigil
//   open  '{{#each users}}'  →  close '{{/each}}'
```

`Skeptic: SURVIVES-WITH-AMENDMENT (the hardest-hit fork) — two structural amendments folded: (1) the draft **bundled
three decisions**; the family-split and escape-hatch are hived off to Supported-by-default, leaving this fork to the
grammar shape alone; (2) **drop the hard 2-char** — real grammars are 3/4-char, so length is a recommendation, not a
rule. The skeptic's *central* attack (reflected-close "falsified by ERB/Handlebars") **fails on the facts**: under
reverse-mirror, `<%`→`%>` and `{%`→`%}` hold, and Handlebars `{{#x}}`→`{{/x}}` is delimiter-reflect + name-echo (now
an explicit clause). Default (derived close) survives over author-declared.`

## Supported by default (not forks)

- **Extends-Element-or-not is per-kind config, not a global fork.** FUI already mixes bases — `CustomTextNode` :
  `Text`, `CustomComment` : `Comment`, `CustomTemplateType` : `HTMLTemplateElement`. The carrier decides; declared
  per kind — a config dimension (`#config-extends-platform-default`), no ratifiable global default.
- **The expression/statement two-family split** — near-universal (`{{ }}` emit-value vs `{% %}` control-flow), so
  adopt it as the in-grain default; stated as its own supported item (skeptic: it was smuggled into Fork 3 — decide
  it on its own merits, which point the same way).
- **A raw/verbatim escape hatch + delimiter-override is a mandatory conformance requirement** — every `{{`-engine
  ships one because `{{` collides when template layers stack. A stacking-safety property of *any* delimiter system,
  not a grammar-shape choice (skeptic: separated from Fork 3).
- **Expression interpolation is already one instance** of the pattern (`webexpressions`), not a separate seam.
- **The name+behavior payload rides the open marker** (mirrors #1989 and the inspector read) — capability
  requirement, not a choice.

## Deferred to children (out of scope here)

- **The comment-directive spec** (its concrete authored form + residue) — largely answered by Fork 1 (a `Comment`
  subclass = a polyfill-shaped standard) and by #1989 downstream; file a child if a dedicated comment-directive
  standard is still wanted.
- **The concrete reserved-delimiter-family policy** — *which* specific families are platform-reserved for userland
  (the Custom-Elements hyphen-rule analogue applied to delimiters) and the exact escape-hatch/override grammar.

## Statute-overlap (reconcile at codification)

This **generalizes** #1986's directive-registration mechanism: #1986's three sibling registries become *instances*
of the node-kind contract (Fork 2, leaves-only for the shared-contract part). Codifies into a new
`we:docs/agent/block-standard.md` node-kind section (or a `we:docs/agent/platform-decisions.md` anchor) that #1986
**nests under** — do not duplicate #1986's rules; point them at the generalized frame. No rule *conflict* (a
superset), but an unreconciled cross-reference to fix when `codifiedIn` is set.

## Blocks / relationships

- **Blocks #1989** (directive residue marker grammar) — residue markers are the serialized wire-format of a text/
  comment-carried region kind, so Fork 3's grammar (reverse-mirror + name-echo) and Fork 1's "materialize into an
  existing kind" settle the frame #1989's residue form sits in (`$`/`/$` vs a reflected `{$ … $}` / `[name`/`]name`).
- **Generalizes #1986**; **parent frame** for the comment-directive standard-vs-polyfill question.
- Surfaced in the #1989 decision session (2026-07-01); see `we:reports/2026-07-01-custom-node-registry.md`.
