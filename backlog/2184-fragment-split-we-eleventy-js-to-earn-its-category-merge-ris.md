---
kind: story
size: 5
status: open
dateOpened: "2026-07-03"
relatedTo: ["2149", "2148"]
tags: [merge-risk, lane, eleventy]
---

# Fragment-split we:.eleventy.js to earn its category-① merge-risk delisting

Off-ramp from #2149 Fork 2, which declared we:.eleventy.js a ③ merge-risk registration monolith (co-serializes touchers). Split the 380-line root into a thin loader over we:eleventy/*.cjs fragments so per-registration edits become disjoint (category ①), then delist it from RESERVED_MERGE_RISK_BY_REPO in both mirror homes. GATED on resolving the open design question the split raises: glob loading makes registration ORDER implicit (Node dir-order; CJS has no Vite-style glob), while the thin root keeps high-churn residue (plugins, markdown/server config, passthroughs). Delist ONLY if the split proves order-insensitivity or adopts an explicit ordered index — otherwise the monolith stays ③. Not pre-blessed by #2149.
