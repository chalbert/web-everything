---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1566"]
dateOpened: "2026-06-22"
tags: []
---

# FUI-host pagination renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/pagination backend

Swap we:demos/pagination-demo.html to a #701 fuiDemo iframe over fui:demos/pagination-demo.html; live-verify the FUI demo renders on the FUI dev server first; then delete the WE runnable backend we:blocks/renderers/pagination (renderPagination + compute; keep PageState type per #1467) + we:demos/pagination-demo.{ts,css}. blockedBy #1356 (golden-vector verifier redesign) — deleting renderPagination strands the WE conformance tests until #1356 drops their value-import. Sibling of #1355 (data-table delete). Carved from #1356 per we:reports/2026-06-22-backlog-split-analysis.md (Run 5).

## Pre-flight (batch-2026-06-22-1545-1549) — shares #1355's fork → `blockedBy: 1566` (was #1356, resolved)

The original blocker #1356 (verifier redesign) is **resolved** — `auditPagination` is now a stored-golden
data-reader. But grounding the delete shows that does **not** unblock it: `we:blocks/__tests__/unit/renderers/pagination.test.ts`
still value-imports `renderPagination` to **render a root** (the capture step the audit runs over) and to run
the **golden-drift guard** (`committed goldens == fresh capture from the reference renderer`), and
`pagination-behavior.test.ts` renders via the runtime. Deleting `renderPagination` strands both. This is the
**same unresolved mechanism fork** as the data-table sibling #1355 — how WE produces a root / guards golden
drift without the renderer — filed as **#1566**. Re-pointed `blockedBy: 1356 → 1566`. Carry-forward reason:
**not-batchable** (fork, shared with #1355).
