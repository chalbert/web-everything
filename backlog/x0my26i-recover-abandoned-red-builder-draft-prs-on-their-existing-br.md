---
kind: story
size: 3
status: resolved
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs", "we:docs/agent/testing.md"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
tags: []
---

# Recover abandoned red builder draft PRs on their existing branch

we: PR #3033 delivering we:4502 remained a red draft after its builder exited. Detect stale red builder drafts with dead authors, resume gate-failure fixes on the same branch within the existing retry budget, and surface exhausted attempts with blocked:needs-human and check/error evidence.

## Done when

1. A builder-authored draft, with red CI on its current head, a confirmed dead author and at least 60 minutes without an update, dispatches a fix against the same PR branch. The age is configurable with `WE_BUILD_DAEMON_RED_DRAFT_MINUTES`.
2. Live or unknown authors, recent drafts, manual PRs and review-gate-only failures do not dispatch. The in-flight delivery hold cannot suppress recovery; kill switches still suppress new work.
3. The existing orphan resume cap bounds durable PR-level attempts across restarts and new heads. Exhaustion posts the failing check and first error, and applies `blocked:needs-human`.
4. `npx vitest related we:skills-src/conveyor/build-dispatch-daemon.mjs we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs --run` passes. `node we:skills-src/conveyor/build-dispatch-daemon.mjs --bogus-flag` exits 2.

## Prep

Prepared 2026-09-30. This is an implementation repair to the existing builder lifecycle, with no new standard or architectural fork. The builder's recorded PR result establishes ownership; the shared liveness probe confirms its author wrapper is dead. A current PR author stamp, when present, must also be dead. REST check runs are read at the current PR head, excluding `review-gate`.

Reuse the we: orphan adoption retry policy (`decideOrphanAction`) and we: hold-router reservation primitives. After delivery the former lane may already be reused, so repair invokes the existing we: PR CI-repair dispatcher with the exact current branch, instead of acquiring the old lane by number. This resumes the item's gate-failure work in a fresh fix session. Generic draft exclusion stays intact. Attempts are recorded before spawning; unknown spawn outcomes fail closed.

Validation covers the daemon tick, the current-head REST response shape, same-branch dispatch arguments, persistent retry accounting and real comment/label command construction. No live PR mutation is part of this change; the human reviews the uncommitted diff.
