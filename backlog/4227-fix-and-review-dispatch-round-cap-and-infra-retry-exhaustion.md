---
bornAs: xilx617
kind: story
size: 5
parent: "4075"
status: open
blockedBy: ["4220"]
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-note-comment.mjs", "we:scripts/operations/completion-store.mjs"]
dateOpened: "2026-09-26"
tags: [conveyor, daemons, flows, flow-checker]
---

# Fix and review dispatch: round-cap and infra-retry exhaustion notify the operator; a long ci-heal session is bounded (flow gaps, reconcile-core)

reconcile-core: every cap-exhausted refusal and a PR stuck cycling blocked-on-infra push a note on the #2725 notes channel; a live ci-heal/fix/review session past a bound gets a note. Clears 6 flow findings (4235, 4232, 4237) in fix, review, ci-heal flows.

## Slice

Sliced by FILE from the four flow-checker gap cards (4235, 4232, 4237, 4226), so this slice's code scope is disjoint from every other slice's. The flow files under we:scripts/conveyor/flows/ cite file:line for each gap. Reuse what exists: the reconcile-notes channel (#2725, we:scripts/conveyor/reconcile-note-comment.mjs), the health-watch notify, and the existing caps.

Findings this slice clears:
- fix round-cap-hit (silent-failure)
- review round-cap-exhausted (silent-failure, uncapped-retry)
- fix fixer-blocked-infra (uncapped-retry)
- review blocked-on-infra (uncapped-retry)
- ci-heal ci-heal-session-running (unbounded-wait)

## Done when

1. **Executable** — `node we:scripts/conveyor/flows/check.mjs --json` no longer lists the findings above (their `ack` entries are removed from the flow files and the flow data is updated to the fixed code, cited file:line); `we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` stays green; a vitest for the new bound / cap / escalation goes red before the fix and green after.
2. **Live proof** — a before/after on the real daemons (or a replay of a real incident) showing the new bound / cap / escalation firing for at least one listed state.

## Built (2026-09-26)

**Three new note kinds**, all "refuse AND surface" (never kill/stop anything), pushed by `planReconcile` in
`we:scripts/conveyor/reconcile-core.mjs` and turned into durable, deduped PR comments by the existing
`we:scripts/conveyor/reconcile-note-comment.mjs`'s `noteEpisodeKey`/`planNoteComment` (no daemon change needed —
see the card's own note on this):

1. **`round-cap-exhausted`** — every `refuse('cap-exhausted', …)` EXCEPT the `ci-red` one (which already pushed
   `ci-heal-exhausted`) now also pushes `{kind:'round-cap-exhausted', prNumber, attempts, cap, capKind, text}`.
   `capKind` names the population: `review` (zero-findings review branch), `fix` (the generic REFUSAL 3, dynamic
   off `OWED[phase]`), `advisory-fix`, `conflict-fix` (an ordinary conflict-labelled bounce), `stacked-rebase`
   (a conflicted PR stacked on another lane's base — its OWN `capKind`, distinct from `conflict-fix` even though
   both share the identical cap/counter). Text is stable: `PR #N: <capKind> auto-repair rounds exhausted (a/c) —
   a person must take it over`. Episode key: `kind + capKind + attempts/cap`.
2. **`infra-retry-exhausted`** — a durable per-SESSION `blocked-on-infra` streak (`infraStreak`/
   `infraStreakSince`), persisted by the completion STORE's own write path
   (`we:scripts/operations/completion-store.mjs`'s `writeCompletion`, so every writer — the `report` CLI, any
   future caller — gets it with no per-caller logic) and read back by `we:scripts/conveyor/reconcile-core.mjs`'s
   `markSelfReportedDone`. Below `INFRA_RETRY_CAP` (4), the ordinary 15-minute `INFRA_RETRY_COOLOFF_MS` cool-off
   applies, silently, as before. AT the cap: the cool-off grows to `INFRA_RETRY_CAPPED_COOLOFF_MS` (60 minutes —
   the retry continues, slower, since infra may still recover) and `planReconcile` pushes the note for the PR
   the capped session is bound to (via the existing `bindAgents`/`assessLiveness`). Episode key: `kind +
   prNumber + since` (the streak's own first timestamp) — deliberately NOT the growing streak count, so a
   persistent outage posts once, not every tick.
3. **`session-overrun`** — in the liveness refusal branch, a `live-process` verdict (never `awaiting-permission`,
   which already notes) whose session `startedAt` is older than `LIVE_SESSION_OVERRUN_MS` (default 90 minutes,
   overridable via `planReconcile`'s own `liveSessionOverrunMs` option — no env read in the pure core) also
   pushes the note. STILL REFUSES — this never kills or reaps a session. Text states the BOUND, never the
   elapsed time (stable across ticks). Episode key: `kind + sessionId` (fallback `pid`).

**Caps/bounds and their values:**
- `INFRA_RETRY_CAP = 4` (streak count), `INFRA_RETRY_CAPPED_COOLOFF_MS = 60 * 60 * 1000` (60 min, up from the
  existing `INFRA_RETRY_COOLOFF_MS = 15 * 60 * 1000`).
- `LIVE_SESSION_OVERRUN_MS = 90 * 60 * 1000` (90 min default bound for a live ci-heal/fix/review session).
- Every existing round cap (`NEGOTIATION_ROUND_CAP=5`, `ADVISORY_FIX_ROUND_CAP=3`, `CONFLICT_FIX_ROUND_CAP=3`,
  `CI_HEAL_ROUND_CAP=3`) is unchanged — only the "cap-exhausted now also surfaces" behavior is new.

**Files changed:** `we:scripts/conveyor/reconcile-core.mjs`, `we:scripts/conveyor/reconcile-note-comment.mjs`,
`we:scripts/operations/completion-store.mjs`, `we:scripts/conveyor/flows/fix.flow.json`,
`we:scripts/conveyor/flows/review.flow.json`, `we:scripts/conveyor/flows/ci-heal.flow.json`, new test
`we:scripts/conveyor/__tests__/reconcile-core-exhaustion-notes.test.mjs`, plus pinned-capKind updates in the
existing `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` (the stacked-rebase branch's `capKind` moved
from the shared `conflict-fix` value to its own `stacked-rebase`, and the plain bounce's REFUSAL 3 now carries
`capKind:'fix'` instead of `undefined` — both pinned, deliberate changes, not regressions).

**Proof result:** `node we:scripts/conveyor/flows/check.mjs --json` → 0 open findings repo-wide (was 45+ before
this slice's clears); the 6 targeted findings (fix round-cap-hit, fix fixer-blocked-infra, review
round-cap-exhausted ×2 rules, review blocked-on-infra, ci-heal ci-heal-session-running) are gone.
`we:scripts/conveyor/flows/__tests__/real-flows.test.mjs` + `we:scripts/conveyor/flows/__tests__/flow-model.test.mjs`
green (14/14). New test: 5/19 passed against the BASE code (the other 14 red, confirmed via `git stash`), 19/19
green after implementing. Live before/after via `node we:scripts/operations/operator-queue.mjs
--with-reconcile-notes --json`: 0 reconcile notes both before and after (no real open PR currently sits at a
cap, a capped infra streak, or a >90-minute live session) — so a REPLAY was built instead:
`chalbert/web-everything#2117` (the real, live-documented 33+-round advisory-negotiation incident this file's
own `countUnresolvedStandDowns` docblock already cites), fed its REAL, unmodified 37-comment GitHub thread with
its labels restored to their at-the-time state (`review:changes`+`review:human`) into `planReconcile` at the
base code vs. the new code: BASE → `cap-exhausted` refusal, zero notes (the exact silent gap this card fixes);
NEW → the SAME refusal, PLUS `{kind:'round-cap-exhausted', attempts:37, cap:5, capKind:'fix',
text:"PR #2117: fix auto-repair rounds exhausted (37/5) — a person must take it over"}`. Nothing was posted to
the real PR (pure in-memory function calls only, no `gh` write).
