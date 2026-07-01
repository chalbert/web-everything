---
kind: decision
status: preparing
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: [standard-proposal, custom-nodes, node-kind, webdirectives, expressions, vision, native-first]
---

# CustomNodeRegistry — a node-kind extensibility standard (`customNodes` : node kinds :: `customElements` : tags)

**Open direction / north-star — needs prep.** The question is not "can userland do this today" (it can't — that's
the normal starting point for a WE proposal, per the "plug = proposed missing standard" model) but **"is a node-kind
extensibility standard worth proposing, and in what shape."** Current read: **yes** — it's the most honest name for
the gap that a whole pile of this repo's machinery is currently faking.

## The gap

The web gave us extensibility at the **element-tag** level (Custom Elements) and, via ElementInternals / custom
states, at the **element-internal** level — but **never at the node-*kind* level**. The set of DOM node kinds
(Element / Text / Comment / ProcessingInstruction / …) is closed; you cannot introduce a new *kind* of node. Custom
Elements work only because `<my-el>` is *already* valid tag syntax the parser materializes — there is no equivalent
opening for a genuinely new node kind.

`CustomNodeRegistry` is the missing sibling: **`customNodes` : node kinds :: `customElements` : tags.** In-grain
platform shape — it mirrors `CustomElementRegistry`, so it proposes in the shape of the closest native thing rather
than as an alien DSL (propose-in-the-platform's-shape).

## The proposal in one line

A **safe, bounded registration** mechanism for new node kinds: register an **opening/closing delimiter grammar** plus
a node type (which **may or may not extend `Element`**) carrying attributes — the way Custom Elements bounded tag
extensibility to hyphenated names, this bounds *syntax* extensibility to registered delimiter families. Illustrative
candidate syntaxes (others possible):

- `{{ binding }}` — reactive expression / interpolation
- `[[ single-print-value ]]` — one-time / print-once value
- `{$ directive $}` … `{$ /directive $}` — paired directive with open/close

**Delimiter rule (candidate — strong consistency win).** An opening delimiter is always exactly **2 characters**,
and if a kind is paired (*defined as having* a close), the closing delimiter is **always the reflection of the
opening** — reverse the pair and mirror each bracketing char — never author-chosen: `{{`→`}}`, `[[`→`]]`,
`{$`→`$}`, `<%`→`%>`. So a reader never memorizes a close (it's mechanically derivable from the open), pairing is
O(1), and every registered kind reads consistently. A kind may also be *unpaired* (a point marker with no close).

## Retro-compatible by construction

**A page that registers no custom node does nothing** — unregistered delimiter syntax is inert text, exactly as an
unregistered `<my-el>` is an inert unknown element. So the feature is opt-in and backward-compatible by construction:
no registry, no behavior, no breakage. (Analogous opt-in-mode precedents: `<template>`'s new inert content model,
`<script type>` typed inert carriers, `<!DOCTYPE html>` / JS `"use strict"` mode switches, and HTML already
degrading XML processing instructions to comments.)

## The polyfill path is already covered

The near-term polyfill needs no new primitive — it composes ones that exist: **`transform`** (rewrite/materialize at
stamp time), **`CustomTextNodeParser`** (claim delimiter syntax inside text — `{{ }}` / `[[ ]]`), and
**`CustomComment`** (the paired-directive / region carrier — `{$ … $}` residue degrades to comments). So a registered
custom node kind *materializes* from these carriers today, and gets first-class node identity once the standard lands.
This makes the proposal credible: it has a working degradation story now, not just a spec wish.

## What it unifies

One root cause underlies a pile of current workarounds — *"we needed a node kind the platform lacks, so we abused an
existing one"*:

- comment-as-directive (`<!-- ns:name -->`)
- `display:contents` element-as-nonrendering-behavior (still an element: a11y tree, selectors, layout — a real,
  impactful workaround, not neutral)
- text-node parsing for `{{ expr }}` interpolation
- `<script type>` as a typed inert data carrier

Name the capability once and each becomes an **instance / plug of the node-kind primitive** — including the
text/expression parser. #1986's directive-registration mechanism generalizes into "custom node kinds," of which the
directive comment + its residue is one instance.

## Sub-questions this parent frame owns

- **Is the comment-directive a standard, or a polyfill for a nodeless-behavior node kind?** (folded here — the
  `{$ directive $}` example is its successor; a context-provider-style non-rendering behavior is the motivating
  case). Split into its own child once this direction is prepped.
- Which delimiter families are reserved, and how (the "safe, limited" boundary — the hyphen-rule analogue)?
- Node kinds that **extend `Element`** vs standalone non-element kinds — when each?
- Expression / interpolation (`{{ }}`) as a registered node kind vs a `CustomTextNodeParser` plug — where's the seam?

## Blocks

- **#1989** (directive residue marker grammar) — residue markers are the **serialized wire-format of a would-be
  region node-kind**, so the residue grammar is downstream of this frame (the `$`/`/$` vs `[`/`]` residue-comment
  form may be reframed as a CustomNode serialization, e.g. `{$ … $}`). #1989 is parked behind this.

## Relationships

- Parent frame for the comment-directive standard-vs-polyfill question and for #1989's residue grammar.
- Generalizes #1986's directive-registration mechanism (custom node kinds ⊃ directive comments).
- Surfaced in the #1989 decision session (2026-07-01). Needs a prep pass (prior-art survey: Custom Elements'
  registration/upgrade model, MDX/template-language delimiter grammars, XML PI history) before it is ratifiable.
