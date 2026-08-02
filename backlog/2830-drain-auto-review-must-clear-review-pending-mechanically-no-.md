---
bornAs: x2tqdk3
kind: story
size: 5
parent: "2612"
status: active
dateOpened: "2026-08-02"
dateStarted: "2026-08-02"
tags: [conveyor, orchestrator-mechanization, drain, review]
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/constellation-repos.mjs
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/disposition-judge.mjs
  - we:scripts/lib/review-escalation.mjs
---

# Drain auto-review must clear review:pending mechanically — no human wait

> **SCOPE (re-scoped during build): this item ships the SHADOW half only.** The runner is a scheduled TRIGGER that
> DISCOVERS `review:pending` PRs, runs each through the already-built convergence ledger + disposition/auto-land
> seams, and LOGS what it WOULD do — clearing NOTHING (`runnerShadowPlan` hard-codes `LAND_MODES.SHADOW`; the CLI
> refuses `--enforce`). The ENFORCE flip — actually writing `review:accepted` / routing to `review:changes` with no
> human — is a **separate, later, ratified step (#2572 part 2)** and is deliberately NOT in this slice. A mechanical
> implementation slice must not be able to auto-land anything. The mutation language further down describes that
> enforce-era goal, not what this PR does.

A PR at `review:pending` with green CI should be picked up by the drain's own independent auto-review pass and cleared to `review:accepted` (or routed to `review:changes`) with NO human. Tonight it did not fire: gate PRs #974 and #975 sat at `review:pending` + green CI and were never auto-cleared — they waited for a human, so the conveyor stalled. The drain must actually RUN the agent-reviewable auto-review on `review:pending` PRs and dispose them mechanically.

## The concrete gap — what the main session did by hand tonight

- **PRs #974 and #975 stalled at `review:pending` with green CI.** Nothing advanced them. The drain has an independent auto-review pass (the agent-reviewable contract), but on these PRs it never fired — they just sat waiting for a human to open `/review`.
- The main session was the only thing that could move them, which is exactly the manual review step the conveyor is meant to remove.

## Why this blocks a session-free conveyor

`review:pending` is supposed to mean "waiting for the drain's independent (non-author) auto-review," NOT "waiting for a human." If the auto-review does not actually run, then every gate PR parks at `review:pending` forever until a person clears it. A session-free conveyor cannot make forward progress past its own review gate — the gate becomes a hard stall on human availability. The whole point of the agent-reviewable contract is that a machine reviewer clears these; if it silently doesn't fire, the conveyor is not session-free.

## The mechanical fix

**Split into two ratified steps. THIS item ships step 1 (shadow); step 2 (enforce) is #2572 part 2.**

Step 1 — SHADOW (this slice):
- **Run the independent auto-review pass on `review:pending` PRs in OBSERVE-ONLY mode.** The scheduled runner
  (`we:scripts/review-runner.mjs` + its pure core `we:scripts/lib/review-runner-core.mjs`) discovers the
  `review:pending` PRs (fail-closed on `review:human` / label-unverifiable, INVARIANT 2 / #2439), reads each PR's
  converged jury ledger, runs it through the existing disposition→auto-land seams with the mode HARD-CODED to
  SHADOW, and emits a structured shadow-log record per PR — WOULD it clear, the panel verdict, findings — while
  mutating NOTHING (`applied:false`, `mutated:false`). This lets an operator build confidence in the mechanical
  disposition before any write is armed.
- Honor the non-author invariant (#2439): the pass is an INDEPENDENT scheduled process, never the author.

Step 2 — ENFORCE (deferred, #2572 part 2, NOT this item): flip the runner to ACT — clear to `review:accepted` on a
clean converged verdict, or route to `review:changes` (bounce to the author lane) on blocking findings, with no
human. This is the ratified arming step. **Blocked on the ledger-freshness binding** (see Cross-references) — the
enforce flip must not land before that guard exists, or a stale ledger could clear an unreviewed head.

## Still owed (not dropped by the shadow re-scope)

- **Investigate and document WHY the original auto-review did not fire on #974/#975.** The shadow runner supplies the
  scheduled trigger, but the root-cause investigation (was the pass unscheduled? gated on a missing label/state?
  crashing silently?) is still owed and must be recorded, so the enforce flip targets the actual cause, not a
  symptom. Tracked here so it is not silently closed at resolve time.

## Cross-references

- **#2820** — the merge predicate that treats `review:pending` as an unsatisfied hold. This item supplies the mechanism that SATISFIES that hold without a human.
- **#2439** — non-author clear (conflict-of-interest invariant): the auto-review must be independent of the author.
- The shared review core (`we:scripts/lib/review-core.mjs`) is the engine this pass runs.
- **Ledger-freshness binding (#2864)** — filed from this PR's review (finding M4). The jury ledger carries no reviewed-head SHA, so a stale ledger could fold clean for an unreviewed head. Fail-closed in SHADOW; it BLOCKS the enforce flip (#2572 part 2) and must land first.
- **check:standards guards (#2867)** — filed from this PR's review: the five deterministic prevention gates (trust-chain registration, numeric verdict-rank literal, repo-key literal, import hygiene, CLI↔test pairing) that close each finding's class.

## Acceptance (SHADOW slice)

- A scheduled, INDEPENDENT (non-author, #2439) runner discovers the `review:pending` PRs and, for each, records a
  structured shadow-log entry — WOULD-clear / WOULD-keep-parked, the panel verdict, and outstanding findings — with
  NO human trigger and NO write (`applied:false`, `mutated:false` on every record).
- The runner is fail-closed: a `review:human` PR or a PR whose current labels cannot be verified is never acted on;
  a PR with no persisted ledger keeps parked; a per-PR error surfaces a keep-parked record and never aborts the batch.
- The zero-mutation guarantee is structural, not incidental: `runnerShadowPlan` hard-codes SHADOW and the CLI refuses
  `--enforce`, so no config flip or flag can make this slice write a label (proven by the core + CLI test suites).
- The `#974/#975` root-cause investigation is recorded (see "Still owed") — carried forward, not closed by re-scope.

## Acceptance (ENFORCE — #2572 part 2, NOT this item)

- The runner, once ratified and armed, clears to `review:accepted` on a clean converged verdict or routes to
  `review:changes` on blocking findings — done by the non-author pass, never the author — and only AFTER the
  ledger-freshness binding lands. Regression: a `review:pending` + green-CI PR like #974/#975 is auto-disposed
  without a main session opening `/review`.
