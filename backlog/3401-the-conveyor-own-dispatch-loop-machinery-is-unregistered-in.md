---
bornAs: xq3j6xn
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-08-30"
tags: []
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-invariants.test.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
---

# The conveyor's own dispatch-loop machinery is unregistered in TRUST_CHAIN — a dispatched agent can weaken it via ordinary agent-clearable review

we:scripts/lib/gate-config.mjs's TRUST_CHAIN registers the sibling resident processes at engine tier — the drain daemon, the converge daemon, we:review-runner.mjs — but names nothing under we:scripts/conveyor/, we:scripts/operations/, or we:scripts/readiness/; we:skills-src/conveyor/runner.mjs and we:skills-src/conveyor/supervisor.mjs get only the generic skills-src blast-radius pattern (#2909), agent-clearable, not policy/human tier. Once this loop dispatches real PRs unattended, a delivery agent whose own PR touches that same code gets no more scrutiny than an ordinary bug fix. #2937 asks this for the agent-behaviour prose rules and is still open; this is the same hole on the dispatch-loop code, uncovered by #2937.

## Done when

1. Executable — `isGateSelfPath` (or the relevant TRUST_CHAIN predicate in we:scripts/lib/gate-config.mjs) returns true, at engine tier or higher, for at least: we:skills-src/conveyor/runner.mjs, we:skills-src/conveyor/supervisor.mjs, we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs, we:scripts/conveyor/tick-core.mjs. Today none of them are named in TRUST_CHAIN's `file:` list.
2. we:scripts/lib/__tests__/gate-invariants.test.mjs (or the equivalent trust-chain conformance test) gains a case pinning each of the paths above to its tier, so a future edit that silently drops one is caught.
3. Whether this should resolve independently or fold into #2937's own ruling (same self-approval hazard, adjacent surface) is decided rather than assumed — cite #2937 either way.
