---
kind: story
size: 5
parent: "2610"
status: open
scope: ["we:scripts/conveyor/", "we:scripts/lib/", "plateau:src/backlog-view/"]
dateOpened: "2026-07-28"
tags: []
---

# Opt-in feedback capture: tenant-ready schema + scrub gate + verbatim preview

The foundation slice of the multi-tenant feedback channel: a client-side suggestion capture over a minimal-by-construction, tenant-ready schema (generalized lessons only, no code/diffs/secrets/paths), the deterministic scrub gate at the SEND seam that denies on hit (the learnings-drop validateEntry/scrubReasons throw precedent, we:scripts/conveyor/learnings-drop.mjs, likely factored into we:scripts/lib/ so a product send-seam and the CLI share one tested core), and the opt-in verbatim payload preview. Defines the schema the review and routing slices read.
