---
kind: epic
status: open
blockedBy: ["2104"]
dateOpened: "2026-07-02"
tags: [custom-nodes, delimiter-grammar, bundle]
---

# Framework-flavored delimiter bundles

Umbrella for the customNodes bundles that reproduce popular template languages' delimiter grammars as ready-made authoring styles over the #2074 recipe model (we:docs/agent/block-standard.md#custom-node-recipes) — the delimiter-language analogue of the parity program (#1226). Dual purpose: a familiar syntax to build in (not only FUI's native grammar), and a stress-test of customNodes against real, diverse grammars (the sigil and declared-close edge cases Fork 3 surfaced). Sliced 2026-07-02 (we:reports/2026-07-02-backlog-split-analysis.md): scorecard keystone #2113 (the #2024 analogue), then one bundle per flavor — Handlebars/Mustache #2114, Liquid/Jinja #2115, Blade #2116, Angular blocks #2117, Svelte #2118, Vue #2119 — each scored on faithful reproduction, gap list as the real deliverable. Rides behind the #2093 build (#2104 registry; #2110 regions). Include/outlet constructs are #1980-gated scorecard rows; the anticipated mid-region-marker gap ({{else}}/{:else}/@else) gets its decision card from the first confirming gap list, not a guess.
