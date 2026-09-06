---
bornAs: xjktyol
kind: story
size: 5
status: open
parent: "2094"
scope: ["we:docs/agent/block-standard.md", "fui:plugs/webnodes/CustomNodeRegistry.ts"]
dateOpened: "2026-09-06"
tags: [webnodes, recipes, delimiter-bundles, standards]
crossRef: { url: /backlog/2201-mid-region-marker-else-decision-card/, label: "the ruling this implements" }
---

# Region mid-marker splits the body into named programs

#2201 ruled (2026-09-06, operator) that a region recipe declares a **mid-marker** the region walk treats as a
parse-time delimiter, splitting the body into a **named-program map** instead of a single `.content`. This is
that ruling's implementation — the #2074-model extension slice the decision's *Downstream* section directs be
filed under #2094.

## What ratified, and therefore what is not open here

`{{#if}}…{{else}}…{{/if}}` materializes as `{ main, inverse }`; `{{else if}}` recurses, the trailing program
holding a single nested block of the same kind. This is the canonical model shared verbatim by Handlebars
(`program`/`inverse`), Svelte (`consequent`/`alternate`), Jinja (`body`/`else_`) and estree
(`consequent`/`alternate`), and it echoes the platform's own `<slot name>` shape.

**Two firewall constraints ratified with the fork and bound this build:**

1. **The IDL specifies the abstract contract only** — *a region exposes N named body programs split at a
   declared mid-marker*. The concrete host materialization is Frontier UI's, per #2074 rule 2's "never name a
   concrete host class". Do not let a `DocumentFragment`-shaped decision leak into the standard.
2. **The mid-marker is an in-region parse token, not a registered recipe `open`.** It mints no second dispatch
   key `(open, regionName)` and raises no `ReservedDelimiterError`. Spelling it as its own region is option (c),
   which the ruling explicitly rejected — an implementation that registers `{{#else}}` has re-introduced the
   rejected branch.

## The accepted cost

A region's single `.content` becomes a labelled map, so `.content` callers migrate to the named-program
surface. #2201 accepted this as a reversible #2074 extension with lineage, mirroring #2112's `children:'raw'`
addition at [`we:docs/agent/block-standard.md`](../docs/agent/block-standard.md) lines 578–584. Carry that
lineage in the IDL change rather than re-deriving the rationale.

## Scorecards flip with it

The #2114 / #2115 / #2118 bundle scorecards move their mid-marker rows from gap to modelled. One reconciliation
travels with them, per the decision's red-team fold-in 3: the **Handlebars** row is currently classified
`marker` / out-of-scope while Svelte and Blade are `children` / gap — reconcile Handlebars to `children` / gap
so all three flip uniformly. A partial flip that leaves Handlebars misclassified is the failure this note
exists to prevent.

## Done when

1. **Executable** — a recipe declaring a mid-marker yields a named-program map on the host, and a fixture
   asserts both the two-program case (`{ main, inverse }`) and the recursive `{{else if}}` chain.
2. Registering the mid-marker as a recipe `open` is refused, with a test that pins the refusal — constraint 2
   is a guarantee, not a convention.
3. The IDL names the abstract labelled-segment contract and no concrete host class; the #2114/#2115/#2118
   scorecards flip together, Handlebars included.
