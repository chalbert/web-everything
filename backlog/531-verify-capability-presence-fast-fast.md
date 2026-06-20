---
kind: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — FAST (fast)

Per-source slice of #495: walk the FAST docs (https://www.fast.design/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId fast — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved (source unavailable; finding captured)

Attempted to walk the FAST docs (fast.design) but **every component doc page returns HTTP 404** — verified across all version paths (`/docs/1.x|2.x|3.x/components/<name>` for accordion, button, data-grid, dialog, menu, select, slider, switch, tabs, text-field, tooltip, card, checkbox, badge, avatar, anchor, + the category index); only top-level landing pages (e.g. `/docs/1.x/introduction/`) still resolve, and `explore.fast.design` does not resolve at all. Microsoft has **decommissioned the FAST docs site**. So **zero verified rows** can be added honestly — fabricating presence from reputation would violate the method.

This is a real data-quality finding about the corpus, not a verification I can complete: scaffolded **[#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/)** to decide whether to repoint the `fast` source's `docsUrl` at an archived snapshot and re-run, or retire `fast` from `benchmarkCorpus`. No change to `we:benchmarkCapabilityPresence.json`. `check:standards` green.
