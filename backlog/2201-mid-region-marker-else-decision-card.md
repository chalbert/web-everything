---
kind: decision
status: open
parent: "2094"
dateOpened: "2026-07-03"
relatedTo: ["2074", "2112", "2114", "2115", "2118"]
relatedReport: reports/2026-07-04-template-alternation-node-modelling.md
preparedDate: "2026-07-04"
tags: [custom-nodes, delimiter-grammar, region, mid-marker, decision]
---

# Mid-region-marker (`{{else}}` / `{:else}` / `@else`) decision card

## Context

The #2114 Handlebars/Mustache delimiter-bundle grammar-fidelity scorecard (scored via #2113) confirmed the
**mid-region-marker** as a model gap: the #2074 `we:customNodes` recipe model can express a region's open
(`{{#if}}`) and its close (`{{/if}}`), but the `{{else}}` marker that divides the if-body from the else-body has
**no recipe axis**. The same gap appears in every bundle with conditional/alternation constructs — Handlebars
`{{else}}`, Liquid/Jinja `{% else %}`, Blade `@else`, Svelte `{:else}`. This is the *first confirming gap list*
per the #2094 epic instruction.

> **Prep note (2026-07-04).** A prior-art survey now grounds this card — published as research topic
> [`template-alternation-node-modelling`](/research/template-alternation-node-modelling/) (report
> [we:reports/2026-07-04-template-alternation-node-modelling.md](../reports/2026-07-04-template-alternation-node-modelling.md)).
> The survey **reshaped the forks**: it found a *canonical* model the card's original three options missed
> (**named body programs**), gave the two original modelling options (a `mid` scalar; a nested `{{#else}}`
> region) **zero prior art**, and **dissolved the "park" recommendation** — parking's own stated precondition
> ("two more bundles confirm the gap") is already met (#2115 and #2118 both **resolved 2026-07-03**, both scored
> the gap). So this is now a *ready-to-ratify* modelling call, not a wait.

## Grounding digest

- **The model has a *binary* region contract today.** A region recipe materializes onto a **single**
  `<template>` host whose `.content` holds the whole region body
  ([fui:plugs/webnodes/recipes/RegionNode.ts:66](../../frontierui/plugs/webnodes/recipes/RegionNode.ts#L66)),
  carved by a **binary** open↔name-echo-close match-stack — the walk pairs `open + regionName` against exactly
  one `regionClose`, balancing depth ([fui:plugs/webnodes/CustomNodeRegistry.ts:670](../../frontierui/plugs/webnodes/CustomNodeRegistry.ts#L670),
  [fui:CustomNodeRegistry.ts:714](../../frontierui/plugs/webnodes/CustomNodeRegistry.ts#L714)). There is **no
  third in-region token** and no way to split `.content` into labelled sub-fragments — a `{{else}}` in the body
  lands as inert literal text. That absence *is* the gap.
- **The recipe axes are a fixed set — none is a segment map.** `static open` / `close` / `value` / `children` /
  `regionName` / `regionClose` ([we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk:85-97](../src/_includes/spec-descriptions/plugs/customnoderegistry.njk#L85);
  the "Nature = which static field is set" rule at [we:docs/agent/block-standard.md:578-584](../docs/agent/block-standard.md#L578)).
  `children` is a **scalar enum of body-scan modes** (`'inert'`/`'live'`/`'raw'`) — *not* a labelled-segment map.
  The mid-marker needs an axis that does not exist.
- **Mainstream engines converge on ONE model — named body programs.** Survey of primary AST sources
  ([research topic](/research/template-alternation-node-modelling/)): the conditional block is **one node
  carrying multiple named body programs**, and the mid-marker is a *parse-time delimiter* deciding which named
  program subsequent statements accumulate into — never itself a node or a field.
  Handlebars `BlockStatement` = `program`(if) + `inverse`(else); Svelte `IfBlock` = `consequent` + `alternate`;
  Jinja `If` = `body`/`elif_`/`else_`; estree `IfStatement` = `consequent` + `alternate`; even HTML named slots
  (`<slot name>`) are the same "one host, labelled regions" shape. `{{else if}}` chains uniformly by the trailing
  program holding a single nested block of the same kind (recursion).
- **The two original modelling options have ZERO prior art.** No surveyed engine models the mid-marker as a
  **scalar `mid` field** (original Fork 1) or as a **degenerate nested `{{#else}}` region** (original Fork 2).
- **The parking precondition is already met.** #2115 (Liquid/Jinja) and #2118 (Svelte) are both **resolved
  (2026-07-03)** and both scored the same mid-marker gap — three grammars now confirm it, and the survey resolves
  *what shape* it takes. The evidence the "park" recommendation was waiting for exists.

## Axis-framing

The live axis is **how the recipe model expresses the mid-region marker** — an axis on the #2074 standard-layer
IDL, not an FUI impl detail (it changes the region host contract: a single `.content` fragment vs a named-program
map, [fui:RegionNode.ts:66](../../frontierui/plugs/webnodes/recipes/RegionNode.ts#L66)). Running the fork-existence
test: this is a **real fork** because the *excluded* branch — model the mid-marker unfaithfully, or not at all
(options c/d) — leaves **every** alternation-bearing framework bundle scoring a permanent grammar-fidelity gap,
which defeats the #2094 bundle program's entire purpose; and the two coherent *shapes* (named programs vs a scalar
axis) **cannot both be the region contract** — one wins the IDL. The fork turns on a **code-level shape** (the
recipe static-field surface + the `<template>` host contract), so it carries a concrete code example. Which layer:
**standard-layer** (the customNodes IDL), a #2074 model extension — take it with the same reversible-extension
lineage discipline #2112 used (never narrow the model to dodge the axis).

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | How does the recipe model express the mid-region marker (`{{else}}`)? | **(a) Named body programs — the region exposes a labelled-segment map (`programs: {main, inverse}`) split at the declared mid-marker; `{{else if}}` recurses.** The canonical model (Handlebars/Svelte/Jinja/estree), taken as a reversible #2074 extension. | **(b) A `mid` scalar static axis** (zero prior art) · **(c) a degenerate nested `{{#else}}` region** (zero prior art, breaks fidelity) · **(d) park** (precondition already met) |

## Fork 1 — How the recipe model expresses the mid-region marker

**Fork exists because** the *excluded* branch is real and broken: leaving the mid-marker unmodelled or modelled
unfaithfully (options c/d) makes every alternation-bearing bundle — Handlebars, Liquid/Jinja, Svelte, Blade —
score a **permanent grammar-fidelity gap**, defeating the #2094 bundle program whose whole point is faithful
grammar reproduction. And the two coherent *shapes* (a named-program map vs a scalar axis) genuinely cannot
coexist as **the** region contract — a caller reads `.content` **or** a named-program map, not both.

- **(a) Named body programs / labelled-segment bodies (default).** A region recipe declares a **mid-marker** that
  the region walk treats as a parse-time delimiter, splitting the body into a **named-program map** on the host
  instead of a single `.content`. `{{#if}}…{{else}}…{{/if}}` materializes as `{ main, inverse }` (the if-body and
  else-body); `{{else if}}` recurses — the trailing program holds a single nested block of the same kind. This is
  the **canonical model shared verbatim** by Handlebars (`program`/`inverse`), Svelte (`consequent`/`alternate`),
  Jinja (`body`/`else_`), and estree (`consequent`/`alternate`), and echoes the platform's own named-slot shape
  (`<slot name>`). Cost: a **standard-layer contract change** — a region's single `.content` becomes a labelled
  map, so `.content` callers migrate to the named-program surface. Taken as a reversible #2074 extension with
  lineage (mirrors #2112's `children:'raw'` addition at [we:docs/agent/block-standard.md:578-584](../docs/agent/block-standard.md#L578)).
  **Two firewall constraints on how (a) is ratified** (red-team fold-ins, so the standard grows the *contract*,
  not FUI's host internals): (1) the IDL specifies the **abstract labelled-segment contract** — *a region exposes
  N named body programs split at a declared mid-marker* — and leaves the concrete host materialization
  (`host.programs` as `DocumentFragment`s vs any other shape) to FUI, per #2074 rule 2's "never name a concrete
  host class"; (2) the mid-marker is an **in-region parse token consumed by the region walk, NOT a registered
  recipe `open`** — it mints **no second dispatch key** `(open, regionName)` and raises no `ReservedDelimiterError`
  (that is precisely the trap option (c) falls into by spelling `{{#else}}` as its own region).
- **(b) A `mid` scalar static axis (dominated).** Add a fourth static field — `static mid = '{{else}}'` — keyed to
  the parent region kind; the walk splits the body at the mid-marker into two named `<template>` slots. Closes the
  gap, but **no surveyed engine carries the mid-marker as a scalar property** — the mainstream always makes it a
  delimiter *between programs*, not a field. A scalar `mid` also does not naturally express `{{else if}}` chains
  (it is one token, not a recursive structure) without special-casing. Dominated by (a) on prior art and on the
  n-way `elsif` case.
- **(c) Degenerate nested `{{#else}}` region (rejected).** Author writes `{{#else}}…{{/else}}` (or a recipe
  intercepts `{{else` with a zero-close form); the else-body is an inert `<template>` nested inside the if-body's
  `.content`. Avoids a new axis but **does not reproduce the real grammar** (Handlebars' authored `{{else}}` is
  *not* `{{#else}}`) — a direct grammar-fidelity violation, the exact failure the bundle program exists to catch —
  and again has **zero prior art**.
- **(d) Park — record the gap, don't model yet (dissolved).** The card's original recommendation: wait until two
  more bundles confirm the gap. **Dissolved** — that precondition is *already satisfied* (#2115 Liquid/Jinja and
  #2118 Svelte both resolved 2026-07-03, both scored the gap), and the survey resolves the design uncertainty that
  motivated the wait (Handlebars `program`/`inverse` is the canonical answer). Parking now would sit on
  ready-to-decide evidence.

Recipe shape under the default (keyed to the real IDL — the added axis + the host contract change):

```ts
// (a default) — a region recipe declares a MID-marker; the walk splits .content into a named-program map.
class HandlebarsIfNode extends CustomNode {
  static open   = '{{#if';
  static regionName  = 'if';
  static regionClose = '{{/if}}';
  static children    = 'inert';
  static mid = { marker: '{{else}}', program: 'inverse' };   // NEW axis: parse-time delimiter → named program
  // {{else if}} → the `inverse` program contains a single nested HandlebarsIfNode (recursion)
}
// host contract change: instead of one `.content`, the region host exposes a labelled map —
//   host.programs === { main: DocumentFragment, inverse: DocumentFragment }
// callers that read `.content` migrate to `host.programs.main` (default program).

// (b dominated) — a scalar `mid`, no program map; two anonymous <template> slots, no natural elseif recursion:
class HandlebarsIfNode_scalar extends CustomNode {
  static mid = '{{else}}';   // a bare token on the node — the shape NO surveyed engine uses
}
```

**Skeptic:** SURVIVES (fresh-context refutation, all four axes). **(0) Classification:** genuine one-shape-wins fork,
not settled-by-precedent (#2074's 6-axis set has no segment map; #2112 added only `children:'raw'` + the collision
predicate) and not support-both (a caller reads `.content` XOR a named-program map — the host cannot carry both as
*the* contract). Pressure-tested "impl-detail masquerading as standard-layer": survives because the surface is
observable across WE↔FUI — but *only* if ratified as the **abstract labelled-segment contract**, not by pinning the
concrete `host.programs` object shape (fold-in 1 above). **(1) Merit:** the `{{else if}}`-recursion claim has no
hole — (a) nests a block-of-same-kind in the trailing program, verbatim Handlebars `inverse` / estree `alternate`;
scalar (b) cannot express n-way chaining without special-casing. "Zero prior art for (b)" is a *supporting*
disqualifier; the load-bearing one is the structural (distinct named roles + recursion) argument, which holds even
without AST authority. **(2) Statute-overlap:** the [we:docs/agent/block-standard.md](../docs/agent/block-standard.md)
`#custom-node-recipes` rule-3 amendment is *additive* — `mid` is legal only *alongside* `children` (a region
already), so it mints no third nature and does not break the `value` XOR `children` invariant
([we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk:114-116](../src/_includes/spec-descriptions/plugs/customnoderegistry.njk#L114));
and the mid-marker mints **no second `(open, regionName)` dispatch key** (fold-in 2), so it does not collide with
#2112's collision predicate. **(3) Citation-scope:** verified #2115 (resolved 2026-07-03, body names the `{% else %}`
gap) and #2118 (resolved 2026-07-03; the gap is scored in the shared #2113 scorecard report even though its item
carries no gap-list) — both confirm the gap, so the park-dissolution's precondition genuinely holds; the survey
authorizes the *shape*, the three-grammar evidence authorizes *growing now*.
**Screen:** clear (fresh-context two-confusion screen). (1) Real **standard-layer** call, not impl churn — the
`.content`→named-program surface is observable to a userland recipe author and any body consumer across the WE↔FUI
boundary (with the fold-in-1 caveat: ratify the abstract contract, leave the host object to FUI). (2) With all
branches free-to-build, a **merit** gap remains — (a) reproduces the canonical grammars and expresses `elsif`, (c)
violates fidelity (`{{else}}` ≠ `{{#else}}`), (b) has no natural n-way chaining — genuine merit, not prioritization.

## Downstream

Ratifying (a) grows the #2074 model by one region axis (the mid-marker → named-program split) and changes the
region host contract (`.content` → labelled program map). Implementation arm: the FUI region walk
([fui:CustomNodeRegistry.ts:670-714](../../frontierui/plugs/webnodes/CustomNodeRegistry.ts#L670)) learns the
mid-marker split; the WE IDL + `we:docs/agent/block-standard.md` `#custom-node-recipes` grow the axis with lineage;
the #2114/#2115/#2118 bundle scorecards flip their mid-marker rows from gap to modelled — and the Handlebars
scorecard row (currently classified `marker`/out-of-scope, vs `children`/gap for Svelte and Blade) is reconciled to
`children`/gap so all three bundles flip uniformly (red-team fold-in 3). File as a #2074-model extension slice under
the #2094 epic once ratified.

---

First confirming gap of the #2094 delimiter-bundle program; sibling of #2112 (reserved-delimiter policy). Prep
research: [we:reports/2026-07-04-template-alternation-node-modelling.md](../reports/2026-07-04-template-alternation-node-modelling.md);
research topic [`template-alternation-node-modelling`](/research/template-alternation-node-modelling/).
