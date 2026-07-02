---
kind: story
size: 2
parent: "2094"
status: open
blockedBy: ["2113"]
dateOpened: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, bundle, vue]
---

# Vue delimiter bundle (out-of-scope firewall proof)

Ship the Vue bundle — the firewall proof: Vue's delimiter surface is only {{ }} interpolation (+ the configurable delimiters app option, parity with recipe open/close statics), so the deliverable is mostly the out-of-scope map (v-if/v-for/v-model/:prop/@event → the #1986 attribute registry; attr-value interpolation → sibling surface) and the smallest passing scorecard. No regions needed — blockedBy only the scorecard #2113, not the region recipe. Scored via #2113; gap list published as a we:reports/ topic.
