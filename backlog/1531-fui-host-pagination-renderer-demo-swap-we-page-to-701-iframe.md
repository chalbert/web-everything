---
kind: story
size: 5
parent: "1353"
status: open
blockedBy: ["1660"]
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
`we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts` renders via the runtime. Deleting `renderPagination` strands both. This is the
**same unresolved mechanism fork** as the data-table sibling #1355 — how WE produces a root / guards golden
drift without the renderer — filed as **#1566**. Re-pointed `blockedBy: 1356 → 1566`. Carry-forward reason:
**not-batchable** (fork, shared with #1355).

## Pre-flight (batch-2026-06-22-1581-1582-1576-1355-1531) — #1566 ruled; re-pointed `blockedBy: 1566 → 1576` (Plateau home absent)

Mirrors the data-table sibling #1355 exactly. #1566 is **resolved** (verifier impl + `goldenToRoot` + the
conformance run move **WE→Plateau**; WE keeps only the interface + golden corpus + schema as data). The
pagination delete is **atomic** with relocating `auditPagination` + the golden-drift capture to a **Plateau
conformance home** — and that home is **verified absent** (`plateau:src/` has no conformance dir). The home
is what the concurrently-`active` **#1576** relocates; landing a competing one here would race it. So this is
**a real block on #1576** (later #1597), not a design fork: re-pointed `blockedBy: 1566 → 1576`. Cascade-frees when
#1576 lands the Plateau conformance home.

## Re-point 2026-06-22 — `blockedBy: 1576 → 1597` (#1576 sliced)

#1576 was sliced into an umbrella epic; the **Plateau conformance home** is now established by its slice
**#1597** (runner/judge impl FUI→Plateau). Re-pointed `blockedBy: 1576 → 1597` — the precise slice that
lands the home this card waits on. Per we:reports/2026-06-22-backlog-split-analysis.md (Run 10).

## Unblocked 2026-06-23 — `blockedBy: 1597 → []` (#1597 resolved, Plateau home landed)

**#1597 is now `resolved`** — the Plateau conformance home this card waited on has landed (and #1576's
remaining children are all resolved). So the earlier real-block on #1576/#1597 is **cleared**: emptied
`blockedBy`. The historical block notes above are superseded. Now genuinely ready (Tier-A), sibling of #1355.

## Pre-flight (batch-2026-06-23-1355-1531) — re-pointed `blockedBy: 1597 → 1660` (#1597 is the wrong mechanism)

Claimed + ground the delete: the re-point `1576 → 1597` rested on a **false premise**. #1597 landed the
**behavioral-vector** conformance runner (`runConformanceVector`/`judgeConformanceTrace` over a
`ConformanceBinding`, Layer-2 trace/judge) — a **different mechanism** than the renderer **golden-audit**
this delete needs (`auditDataTable(root, golden)` audits a statically-rendered DOM against a frozen golden
projection). A grep confirms **no** `auditDataTable`/`goldenToRoot`/renderer golden-audit anywhere in
`plateau:src/`, so the Plateau home #1566 Fork 2a requires is **verified absent** — and was **never filed**.
The delete is **atomic** with standing that home up (the WE backend + verifier can't leave until the run has
a Plateau home + the WE data-only suite + golden schema exist). Filed that prerequisite as **#1660** (decided
build, not a fork — #1566 Fork 2a ruled it). Re-pointed `blockedBy: 1660`; **`blocked-in-fact`**, released.
Cascade-frees when #1660 lands. Sibling shares this exactly.
