---
bornAs: x85oow9
kind: story
size: 5
status: open
scope: ["we:scripts/readiness/queue-report.mjs", "we:scripts/readiness/__tests__/queue-report.test.mjs", "we:.claude/skills/wip"]
dateOpened: "2026-09-07"
tags: []
---

# queue-report: classify dispatch-plan holds into queued-waiting-turn / not-ready / stale-noise

Tonight's hand-produced /wip reports misclassified scope-overlap holds ('overlaps lane-<n>') as not-queued when they are genuine queue members waiting their turn. Add we:scripts/readiness/queue-report.mjs (pure-core/IO-shell, mirroring we:scripts/readiness/dispatch-plan.mjs and we:scripts/readiness/conveyor-state.mjs — NOT the we:scripts/operations op() DSL, which is for judgment/confirm steps this has none of). It shells we:scripts/readiness/dispatch-plan.mjs --json (whose exported HELD_REASONS is the single source of the held vocabulary) against the live runner's checkout (reuse we:scripts/conveyor/resolve-runner-checkout.mjs's resolveRunnerCheckout(), fall back to local cwd logging why when not resolved) and classifies every held reason into exactly one bucket via a new pure classifier that throws on an unrecognized token (mirrors we:scripts/operations/gap-sweep-status.mjs's shapeRunFinding refusal pattern): queued-waiting-turn = 'overlaps lane-<n>' + 'no free lane' (real queue members just waiting their turn, no action needed); not-ready = 'blocked' + 'unshaped-no-scope' + 'needs-slice' + 'needs-decision' + 'branch-drift-blocked' + 'cleared-but-not-ready' (needs an action first); stale-noise = 'already-done' (not a real held member — verify/clear it). Resolve titles via the same require(we:src/_data/backlog.js) byNum idiom we:scripts/readiness/dispatch-plan.mjs and we:scripts/readiness/conveyor-state.mjs already each use (no separate bulk-title helper exists; follow the established idiom, do not invent a third mechanism). Emit a full 'active' building/preparing section from we:scripts/readiness/dispatch-plan.mjs's launch list plus we:scripts/readiness/conveyor-state.mjs's lanes/unshaped/needsSlice/decisions (with lane+title); report fixing/healing as explicit null/'unavailable' (never a fabricated 0) since that live guard bookkeeping lives only in the running we:skills-src/conveyor/runner.mjs process and is never persisted for an external reader to see cold — a real fixing/healing count needs separate runner instrumentation, out of scope here. CLI defaults to a human summary on stderr; --json for machine consumers; --full expands notReady/staleNoise from counts into full item listings. Unit-test the classifier (every HELD_REASONS token covered, unrecognized token throws) and the composer, fixture-driven, no fs/network, in we:scripts/readiness/__tests__/queue-report.test.mjs. Then point /wip's own instructions (wherever we:.claude/skills/wip currently hand-classifies output from we:scripts/readiness/dispatch-plan.mjs and we:scripts/conveyor/queue.mjs in prose) at this script instead. This is the shared DATA operation #3560 (queue-status Artifact, blocked on #3277) and 3569/#3569 (capacity monitor) would both eventually consume via --json — those are presentation layers on top; this item stands alone and does not block on either.

## Done when

1. **Executable** — `node --test we:scripts/readiness/__tests__/queue-report.test.mjs` passes, and
   `node we:scripts/readiness/queue-report.mjs --json` runs and emits a payload whose `held` reasons are each
   classified into exactly one of `queuedWaitingTurn` / `notReady` / `staleNoise` (fails before this item
   lands — the file does not exist yet).
