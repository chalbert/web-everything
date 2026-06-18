---
type: issue
workItem: task
parent: "170"
status: resolved
blockedBy: ["725", "950"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts"
tags: []
---

# Dual-mode (unplugged+plugged) plug-test backfill for webguards/webvalidation in FUI + flip PLUG_UNPLUGGED_TEST_ENFORCED

Hand-off from #637: author the unplugged + plugged test suites for the two last-uncovered plug domains (webguards, webvalidation) in FUI once both are ported (#725 + #950), then flip PLUG_UNPLUGGED_TEST_ENFORCED=true (#636) — the last gate-promotion the #170 plugs-dedup chain waits on. Sliced from #725 (we:reports/2026-06-18-backlog-split-analysis.md).

## Subsumed by #726 — resolved in batch-2026-06-18

This item's scope is a **strict subset** of #726 (backfill the remaining unplugged plug-tests + flip
`PLUG_UNPLUGGED_TEST_ENFORCED`): #951 covered webguards + webvalidation specifically; by batch-2026-06-18
those were the **only** two domains the WE gate still warned on, so #726's "remaining" set *was* exactly
this scope. Critically, #951 could **not** flip the flag standalone — flipping it requires *all* domains to
ship an unplugged test, so only the comprehensive #726 (which verified the whole set) could own the flip.

#726 delivered this item's entire deliverable: the webguards + webvalidation unplugged-mode tests
(`we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts`,
`we:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts`) and the flag flip. The FUI
canonical-home relocation is carried on #449. Nothing left here → resolved as graduated to #726 (dedup, not
a separate build).

> **Note on the title's "in FUI":** the *enforcing* gate walks WE's `we:plugs/` (per
> `we:scripts/check-standards.mjs` §8b), so the tests landed there to satisfy the flip; #449 carries them to
> the FUI canonical home on dedup.
