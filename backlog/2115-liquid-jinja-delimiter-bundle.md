---
kind: story
size: 5
parent: "2094"
status: resolved
blockedBy: ["2113", "2110"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
relatedReport: reports/2026-07-03-delimiter-bundle-grammar-fidelity.md
tags: [custom-nodes, delimiter-grammar, bundle, liquid, jinja]
---

# Liquid/Jinja delimiter bundle

Ship the Liquid/Jinja bundle: dual-sigil {{ }} + {% %} with end-prefix name-echo closes ({% for %}...{% endfor %} -- a second declared-close shape stressing Fork 3), {% raw %} verbatim escape (the mandatory escape hatch), {# #}/{% comment %} hidden. One bundle: the delimiter skeleton is shared; Liquid/Jinja divergence is expression vocabulary (filters/tags), out of grammar scope -- fork a second bundle only if the gap lists diverge. Scored via #2113; gap list published as a we:reports/ topic.

## Resolution (2026-07-03, #2115)

Built the Liquid/Jinja delimiter bundle as a single shared-skeleton bundle -- one grammar covers both Liquid and Jinja since they share the same delimiter surface (`{{ }}` + `{% %}` + `{# #}`); their divergence is expression vocabulary (filters/pipes, custom tags), not delimiter grammar.

- **Bundle (FUI impl):** `frontierui:plugs/webnodes/recipes/liquidJinjaBundle.ts` -- 7 recipe subclasses reproducing the full delimiter grammar: `LiquidJinjaInterpolationNode` (`{{ }}`), `LiquidJinjaForRegionNode` (`{% for %}...{% endfor %}`), `LiquidJinjaIfRegionNode` (`{% if %}...{% endif %}`), `LiquidJinjaBlockRegionNode` (`{% block %}...{% endblock %}`), `LiquidJinjaRawRegionNode` (`{% raw %}...{% endraw %}`), `LiquidJinjaCommentRegionNode` (`{% comment %}...{% endcomment %}`), `JinjaInlineCommentNode` (`{# #}`).
- **Fork 3 stress -- end-prefix closes:** All six `{%` block-tag regions use the `end`-prefix close shape (`{% endfor %}`, `{% endif %}`, etc.) -- the second declared-close shape in the corpus alongside `{#each}...{/each}`. The `regionClose` is fully author-declared per Fork 3; the registry walk handles both close shapes identically. Registry key design (shared-sigil constraint): since `{% %}` is a shared sigil across all block-tag types, each recipe encodes its full keyword in `static open` (`{% for`, `{% if`, etc.) and sets `static regionName = ''` -- so the registry needle equals `open` exactly (`'{% for' + '' = '{% for'`). This surfaces a boundary in the #2074 model (the registry cannot express multiple named regions under one sigil when `regionName` carries the discriminator) and is the concrete design trade-off documented in each recipe's JSDoc.
- **`{% raw %}` escape hatch:** `LiquidJinjaRawRegionNode` models the verbatim escape as `children:'inert'` -- body parked inert in `<template>.content`, consumer re-emits raw content. Mandatory escape hatch per the backlog scope.
- **Dual comment paths:** `JinjaInlineCommentNode` (`{# #}`, `rendered:false` marker) + `LiquidJinjaCommentRegionNode` (`{% comment %}...{% endcomment %}`, inert region) -- the two declared-close shapes for comments. The asymmetric `{# #}` close (`#}`, not `}`) is author-declared per Fork 3.
- **Registry change (FUI):** `frontierui:plugs/webnodes/CustomNodeRegistry.ts` -- extended `#regionRecipes()` to accept `regionName = ''` (checks `regionName !== undefined` instead of truthy) so that full-keyword `open` sigils can omit the separate region name. Gate-green; existing tests (84) all pass.
- **Conformance fixture (FUI):** `frontierui:plugs/webnodes/__tests__/unit/liquidJinjaBundle.test.ts` -- 15 tests covering identity, scorecard (100% fidelity, 0 gaps, 3 out-of-scope), bundle-zero gap list, registry integration, and Fork 3 end-prefix materialization (including nesting match-stack).
- **Grammar checklist (WE):** `we:design-systems/grammars/liquid-jinja.grammar.json` -- 10 constructs (7 in-scope + 3 out-of-scope).
- **Report + scorecard emitter (WE):** `we:scripts/grammar-scorecard.mjs` updated to export the bundle recipes and include `liquid-jinja` in the default checklist (scores each built bundle against its own checklist, not bundle zero). `we:reports/2026-07-03-delimiter-bundle-grammar-fidelity.md` updated: Liquid/Jinja **100%** (7/7 in-scope, 3 out-of-scope).

**Gap list:** No delimiter-grammar gaps (all 7 in-scope constructs reproduce). Known out-of-scope: filter/pipe vocabulary (`{{ x | filter }}`), inclusion tags (`{% include %}` / `{% extends %}`), attribute-value interpolation. The mid-region-marker (`{% else %}` / `{% elsif %}`) is a structural grammar gap not yet surfaced as a scored construct -- it lands in the anticipated decision card once the first confirming gap list from this program earns it.
