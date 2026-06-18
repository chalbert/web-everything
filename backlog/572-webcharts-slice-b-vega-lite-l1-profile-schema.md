---
type: issue
workItem: task
parent: "570"
status: resolved
blockedBy: ["571"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
tags: []
---

# webcharts slice b — Vega-Lite L1 profile schema

Slice b of #570 (webcharts scaffold). Author the Vega-Lite L1 profile schema as TS/pseudocode in we:src/_includes/project-webcharts.njk (precedent: the Mock Contract schema in we:project-webcases.njk) plus glossary terms in we:src/_data/semantics.json. Keep the semantic plane (data->encoding, the a11y-derivable mapping) separate from the presentation/theme plane (concrete palettes/animation/alignment consuming webtheme tokens); thin L1 core = data/mark/encoding + scales/axes/legends, with selections/transforms/composition deferred to L2+ tiers (additive). Color/size mapping is semantic; resolved values are theme. Leaves the spec section rendering; check:standards green. Blocked by #571 (needs the project page).
