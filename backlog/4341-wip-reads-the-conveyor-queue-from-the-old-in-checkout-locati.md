---
bornAs: xykd1x3
kind: story
size: 2
status: open
scope: ["plateau:src/wip/wip-read.ts", "plateau:src/wip/wip-read.test.ts"]
dateOpened: "2026-09-28"
tags: []
---

# /wip reads the conveyor queue from the old in-checkout location

**Scope.** plateau:src/wip/wip-read.ts's conveyor-queue read only (~L307). Audited every /wip file
(plateau:src/wip/*.ts) for other `.conveyor/` reads that might have moved the same way (dispatch-pause,
land-advance opt-in) — none exist today; only this one hardcodes the old path.

**Problem.** It does `join(weRoot, ...)` down to `we:.conveyor/queue.json` — the pre-#2816 in-checkout location. Since
we:scripts/lib/automation-home.mjs (we:backlog/4288, epic we:backlog/4075) landed, the live queue lives in the
automation state home; the canonical resolver is we:scripts/conveyor/queue-store.mjs's exported
`resolveQueuePath()` (falls back through `legacyQueuePaths()` for a one-release compat read). /wip's "Queued"
count and rows are silently reading a stale/empty file.

**Fix.** Dynamic-import `resolveQueuePath` from `weRoot` at read time, the way plateau:src/wip/stranded-read.ts
already loads we:scripts/backlog-stranded-sweep.mjs (`pathToFileURL(...).href` + `await import`) — no copied
path logic, no new hardcoded string.

**Risks.** An older sibling WE checkout may predate the new export. Keep the existing `attempt()` fallback
(empty array, `conveyor-queue` degraded) so a stale `weRoot` degrades honestly instead of throwing raw — same
shape as today's ENOENT handling.

**Test plan.** Update plateau:src/wip/wip-read.test.ts's conveyor-queue fixture to mock the dynamic import
(mirrors the existing sibling-import mock in plateau:src/wip/stranded-read.test.ts), plus one case for an
old-shaped `weRoot` (no `resolveQueuePath` export) degrading to empty rather than throwing. `npm test` green.

**Tasks.** (1) swap the `join(...)`+`readFileSync` read for the dynamic-imported resolver; (2) keep the
degraded-fallback shape; (3) update/add the test doubles above; (4) `npm test` in plateau-app.

**Proof plan.** After the fix ships and `com.plateau.wip-publisher` republishes, the live page's "Queued" list
at https://plateau-app.nicgilbert.workers.dev/wip must equal `node we:scripts/conveyor/queue.mjs list` run from
~/workspace/wev-control — today those disagree whenever the state-home queue differs from the stale in-checkout
file.

## Done when

1. **Executable** — `npx vitest run plateau:src/wip/wip-read.test.ts` passes with a case asserting the
   conveyor-queue read goes through `resolveQueuePath()` (not a hardcoded `we:.conveyor/queue.json` join),
   plus the old-shaped-`weRoot` degrade case.
