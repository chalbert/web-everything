---
kind: story
size: 2
parent: "2094"
status: resolved
blockedBy: ["2113"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [custom-nodes, delimiter-grammar, bundle, vue]
---

# Vue delimiter bundle (out-of-scope firewall proof)

Ship the Vue bundle — the firewall proof: Vue's delimiter surface is only {{ }} interpolation (+ the configurable delimiters app option, parity with recipe open/close statics), so the deliverable is mostly the out-of-scope map (v-if/v-for/v-model/:prop/@event → the #1986 attribute registry; attr-value interpolation → sibling surface) and the smallest passing scorecard. No regions needed — blockedBy only the scorecard #2113, not the region recipe. Scored via #2113; gap list published as a we:reports/ topic.

## Resolution (2026-07-03, #2119)

Delivered the **Vue delimiter-bundle firewall proof**: Vue's grammar surface is the smallest of the #2094 suite — one in-scope construct, seven out-of-scope, zero gaps.

- **Grammar checklist (WE):** `we:design-systems/grammars/vue.grammar.json` — the Vue construct checklist. One in-scope construct: `{{ expr }}` (value, the default text-interpolation delimiter; the configurable `delimiters` app option is parity with recipe open/close statics, same shape). Seven out-of-scope rows documenting the firewall: `v-if/v-else-if/v-else`, `v-for`, `:prop/v-bind`, `@event/v-on`, `v-model`, `v-html` (all attribute-keyed → #1986 registry) + `class="{{ x }}"` attribute-value interpolation (sibling surface, #2074 rule 5).
- **Scorecard result:** `we:reports/2026-07-03-delimiter-bundle-grammar-fidelity.md` (Vue section, new) — **100% fidelity** (1/1 in-scope construct reproduced via `MustacheInterpolationNode`; 7 out-of-scope-per-statute; gap list: **none**). The `{{ }}` delimiter reproduces against FUI's existing `MustacheInterpolationNode` — no new recipe required. The null gap list is the proof: Vue's template grammar imposes zero new delimiter-grammar requirements on the #2094 bundle program.
- **Script update (WE):** `we:scripts/grammar-scorecard.mjs` — added `vue` to the default checklist set so `npm run grammar:score` regenerates the Vue section automatically alongside FUI-native and Handlebars.
