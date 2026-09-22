---
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# assessLiveness must not treat a done session's recycled pid as still-working

Live-caught 2026-09-22 by we:skills-src/conveyor/review-daemon.mjs's first real run: PR #2461 was refused every tick with kind live-process even though its bound review-2461 session had already finished (claude agents --json reports state:done, status:idle). Root cause: we:scripts/conveyor/reconcile-core.mjs's assessLiveness only checks b.agent?.pidAlive===true, never the agent's own reported state/status -- in this environment a finished background session's OS process is recycled into a bg-spare warm pool rather than exiting, so pidAlive stays true forever after the review the pid was doing is long done. Effect: any PR whose reviewer session ever completed becomes permanently stuck at live-process, never re-dispatched, for every daemon/pass that reconciles through this shared file (review-dispatch, fix-dispatch), not just we:skills-src/conveyor/review-daemon.mjs. Fix: assessLiveness must also treat a bound session reporting state==='done' as not-live, regardless of pidAlive, since the agent's own state is authoritative over a raw OS-level pid probe once a completion state is reported.

## Progress

Fixed: `assessLiveness` now filters out any bound session reporting `state === 'done'` before all four ranks (awaiting-permission / live-process / liveness-unknown / dead), regardless of `pidAlive`. Confirmed by reintroduction: the new test fails (`[] !== ['fix']`) against the pre-fix code (only `pidAlive` consulted) and passes once the filter is added. No regression: all 47 pre-existing cases in we:scripts/conveyor/__tests__/reconcile-core.test.mjs still pass unchanged, plus the 4 we:scripts/conveyor/__tests__/reconcile-pass.test.mjs and 53 we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs cases that share this core (both daemons that reconcile through it).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/reconcile-core.test.mjs` passes (48/48): a bound session with `pidAlive:true, state:'done'` no longer blocks dispatch (confirmed by reintroduction to fail without the fix); every pre-existing liveness-ranking case (awaiting-permission outranks a live pid, a provably dead pid clears the way, liveness-unknown on an unprobed pid) is unchanged.
