---
bornAs: xpdxmnm
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Wire the session reaper into a running daemon (review-daemon), with cwd + never-reap-working safety guards

we:scripts/conveyor/session-reaper.mjs's own runSessionReaperPass/session-reap-plan logic already existed and was unit-tested, but the ONLY caller that ever invoked it was we:skills-src/conveyor/runner.mjs's makeCliMechanicalPasses — a dispatcher this epic's split has since replaced and that is NOT running. Left uncalled, every review-*/review-pa-*/fix-*/fix-pa-* session the review-daemon and we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs dispatch accumulates forever once finished (observed live: ~40 finished sessions, ~200 lingering claude child processes, ~24GB). This slice: (1) extracts we:scripts/conveyor/session-reaper.mjs's IO shell into a reusable runSessionReaperPass so a daemon can call it in-process (no new node subprocess per tick); (2) adds a second structural cwd guard (classifySessionReap's allowedCwd) so reaping only ever touches sessions spawned from the SAME checkout that is running the pass, resolved by script location, never a hardcoded path; (3) adds an opt-in neverReapWorking stricter mode (a state:working session is never touched by any axis, even a merged PR or a done completion record) for callers running this against live production sessions on a schedule, while leaving the historical ground-truth-can-upgrade-working default byte-identical for every existing caller/test; (4) adds a completion-record axis (we:scripts/operations/completion-store.mjs, #3436) as a more direct done-signal than backlog/PR ground truth; (5) adds a generous, off-by-default idle-timeout backstop for a blocked session neither axis can confirm. Wires it into we:skills-src/conveyor/review-daemon.mjs's own tick (decided over we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs: session-reaper reads the WHOLE claude agents listing regardless of which daemon spawned a session, so placement is about ownership, not scope-coverage; review-daemon already owns the broader 'review session lifecycle' concern and is already cross-repo on the same 120s cadence, while reconcile-fix-dispatch-daemon's contract is deliberately narrow/action-store-fenced and safe to run twice — folding in an unrelated OS-process-cleanup concern would blur that). Every addition is additive/opt-in — the full pre-existing test suite (61 tests) passes unchanged; 91 new tests cover the new guards. Never kills a real process — all new tests use injected fakes only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
