# Template alternation node modelling — how mainstream engines represent the mid-region marker

**Date:** 2026-07-04 · **For:** decision #2201 (mid-region-marker card), child of #2094 · **Research topic:**
[`template-alternation-node-modelling`](/research/template-alternation-node-modelling/)

## Question

How should the #2074 `we:customNodes` recipe model express the **mid-region marker** (`{{else}}` / `{% else %}` /
`{:else}` / `@else`) that divides a `{{#if}}…{{else}}…{{/if}}` region into an if-body and an else-body — an axis
the model has for the region *open* (`{{#if}}`) and *close* (`{{/if}}`) but not for the mid-marker?

## Code ground truth

A region recipe materializes onto a **single** `<template>` host whose `.content` holds the whole region body
([fui:plugs/webnodes/recipes/RegionNode.ts:66](../../frontierui/plugs/webnodes/recipes/RegionNode.ts#L66)), carved
by a **binary** open↔name-echo-close match-stack ([fui:plugs/webnodes/CustomNodeRegistry.ts:670](../../frontierui/plugs/webnodes/CustomNodeRegistry.ts#L670),
[:714](../../frontierui/plugs/webnodes/CustomNodeRegistry.ts#L714)). The IDL axes are `static open`/`close`/`value`/`children`/`regionName`/`regionClose`
([we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk:85-97](../src/_includes/spec-descriptions/plugs/customnoderegistry.njk#L85);
[we:docs/agent/block-standard.md:578-584](../docs/agent/block-standard.md#L578)) — `children` is a scalar enum of
body-scan modes, not a labelled-segment map. A `{{else}}` in the body has no axis and lands as inert literal text.

## Prior-art survey (primary AST sources)

| System | Mid-marker | AST representation | Model |
| --- | --- | --- | --- |
| Handlebars | `{{else}}` / `{{else if}}` | `BlockStatement` `program`(if) + `inverse`(else); `else if` nests a `BlockStatement` in `inverse` | named programs |
| Mustache | *(none)* | negative branch is a separate inverted section `{{^}}…{{/}}` | separate section |
| Svelte 5 | `{:else}` / `{:else if}` | `IfBlock` `consequent` + `alternate` + `elseif` flag | named programs |
| Jinja2 | `{% else %}` / `{% elif %}` | `class If` fields `test`/`body`/`elif_`/`else_` | named programs |
| Nunjucks | `{% else %}` / `{% elif %}` | `If` fields `cond`/`body`/`else_` | named programs |
| Liquid | `{% else %}` / `{% elsif %}` | flat `@blocks` list of `Condition`; `else` = `ElseCondition` sibling | flat sibling list |
| estree (JS) | `else` | `IfStatement` `consequent` + `alternate` | named programs |
| HTML named slots | `slot="name"` | one host, multiple labelled named regions | named regions (analogue) |

**Sources:** [Handlebars compiler API](https://github.com/handlebars-lang/handlebars.js/blob/master/docs/compiler-api.md) ·
[Mustache spec](https://github.com/mustache/spec/blob/master/specs/inverted.yml) ·
[Svelte template types](https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/compiler/types/template.d.ts) ·
[Jinja nodes](https://github.com/pallets/jinja/blob/main/src/jinja2/nodes.py) ·
[Nunjucks nodes](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/nodes.js) ·
[Liquid if tag](https://github.com/Shopify/liquid/blob/main/lib/liquid/tags/if.rb) ·
[estree ES5](https://github.com/estree/estree/blob/master/es5.md) ·
[MDN &lt;slot&gt;](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot).

## Findings

1. **Canonical model = named body programs.** The mid-marker is a *parse-time delimiter* that partitions the body
   into named programs (`program`/`inverse`, `consequent`/`alternate`, `body`/`else_`) — never itself a node or a
   scalar field. `{{else if}}` chains uniformly by recursion (trailing program holds a nested block of the same kind).
2. **Zero prior art for the two original options.** No surveyed engine models the mid-marker as a **scalar `mid`
   field** (#2201's original Fork 1) or a **degenerate nested `{{#else}}` region** (original Fork 2).
3. **Parking is dissolvable.** The card's park recommendation waited for "two more bundles" — #2115 (Liquid/Jinja)
   and #2118 (Svelte) are both **resolved 2026-07-03**, both scored the gap. The precondition is met and the design
   uncertainty is resolved.

## Recommendation into the fork

Adopt **(a) named body programs / labelled-segment bodies**: a region exposes `programs: {main, inverse}` split at
a declared mid-marker, `{{else if}}` recursing — taken as a reversible #2074 model extension (the region's single
`.content` becomes a labelled program map). Demote the `mid` scalar to a dominated alternative, reject the nested
`{{#else}}` region on fidelity, dissolve park. See #2201 Fork 1 for the prepared shape.
