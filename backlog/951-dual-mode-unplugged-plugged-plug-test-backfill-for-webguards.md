---
type: issue
workItem: task
parent: "170"
status: open
blockedBy: ["725", "950"]
dateOpened: "2026-06-18"
tags: []
---

# Dual-mode (unplugged+plugged) plug-test backfill for webguards/webvalidation in FUI + flip PLUG_UNPLUGGED_TEST_ENFORCED

Hand-off from #637: author the unplugged + plugged test suites for the two last-uncovered plug domains (webguards, webvalidation) in FUI once both are ported (#725 + #950), then flip PLUG_UNPLUGGED_TEST_ENFORCED=true (#636) — the last gate-promotion the #170 plugs-dedup chain waits on. Sliced from #725 (we:reports/2026-06-18-backlog-split-analysis.md).
