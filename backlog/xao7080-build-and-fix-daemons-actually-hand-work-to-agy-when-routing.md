---
kind: story
size: 5
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/lib/probation-launcher.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Build and fix daemons actually hand work to agy when routing offers it

we:scripts/lib/provider-routing.mjs computes `alternateBackend` (agy via `node we:scripts/gemini-direct-task.mjs`) as the default capacity-relief route offered on every Claude Sonnet/Opus dispatch (confirmed live on origin/main e141d647), and separately pins model tiers agy actually exposes: `AGY_GEMINI_SIMPLE_MODEL = 'gemini-3.8-flash-high'` for simple/low-judgment work, `AGY_CLAUDE_MODEL_BY_TIER` = `claude-sonnet-4-6` / `claude-opus-4-6-thinking` for harder work routed to agy-claude, plus gemini-3.1-pro as the non-simple Gemini tier (`agy models` on agy 1.2.12). But confirmed by grep on origin/main: no dispatcher CONSUMES the offer. `we:skills-src/conveyor/build-dispatch-daemon.mjs` (builds) and `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` (fixes) never reference `we:scripts/gemini-direct-task.mjs`/`alternateBackend` at all; only `we:scripts/lib/dispatch-contracts.mjs` reads the field (to log it), and grepping `we:skills-src/conveyor`+`we:scripts/conveyor` for gemini-direct-task/alternateBackend turns up only rating/backfill/comparison scripts (`we:scripts/conveyor/run-rating.mjs`, `we:scripts/conveyor/backfill-2026-09-14-delegation-trials.mjs`, `we:scripts/conveyor/concurrent-baseline-comparison.mjs`) — never a live dispatcher. So the offer is advisory-only and every build/fix still runs on Claude, even though the existing probation mechanism (`we:scripts/lib/probation-launcher.mjs`, `we:scripts/operations/probation-build-run.mjs`/`we:scripts/operations/probation-heal-run.mjs`) already knows how to launch + rate an agy run and close a bad offer. Live scorecard check (2026-09-29, 3147 records): 0 doc-fix/ci-heal runs of ANY kind were ever dispatched to antigravity-claude/antigravity-gemini — the only agy-provider rows (623 total) are advisory-review judge seats (608) and one-off session-delegation trials (15, conflict-resolution/other), never a build or fix. MVP: `we:skills-src/conveyor/build-dispatch-daemon.mjs` and the fix dispatch path launch via `we:scripts/gemini-direct-task.mjs` when `alternateBackend` is offered, for the task types `CRITICAL_WORK_GATE.openForNonCritical` allows — routing SIMPLE, low-judgment work (card-only/resolve-only PRs, doc-fix, ci-heal reruns, prevention cards) to `AGY_GEMINI_SIMPLE_MODEL` (gemini-3.8-flash-high), harder opened work to agy-claude (sonnet/opus tier) or gemini-3.1-pro — reusing `we:scripts/lib/provider-routing.mjs`'s existing tiering, never inventing a new one — with the run rated like any other so a bad trial closes the offer (existing mechanism, no new gate).

## Design

Both daemons already compute (or can cheaply read) the same `ProviderRecommendation` `we:scripts/lib/provider-routing.mjs` builds for the underlying dispatch — `alternateBackend` and `probationWorker` are already on that object, nothing new to compute. Add one launch branch, shared by both daemons, that: (1) checks `we:scripts/lib/provider-routing.mjs`'s `CRITICAL_WORK_GATE.openForNonCritical[taskType]` is `true`; (2) if so, and `alternateBackend` is non-null, picks a worker off `PROBATION_ROSTER[taskType]`; (3) picks the model tier by task simplicity — a `simpleOnly` worker (`antigravity-gemini`, pinned to `AGY_GEMINI_SIMPLE_MODEL` = `gemini-3.8-flash-high`) for low-judgment work (card-only/resolve-only PRs, doc-fix, ci-heal reruns, prevention cards), `antigravity-claude` (agy-claude, sonnet/opus tier per `AGY_CLAUDE_MODEL_BY_TIER`) or gemini-3.1-pro for anything harder that the gate still allows; (4) launches via `we:scripts/gemini-direct-task.mjs` using the SAME launcher shape `we:scripts/lib/probation-launcher.mjs`/`we:scripts/operations/probation-build-run.mjs`/`we:scripts/operations/probation-heal-run.mjs` already use for probation dispatch — no new launcher, just a new call site; (5) records the run in the scorecard exactly like a Claude-dispatched run, so a bad trial closes the offer the same way the existing rating mechanism already does for any other probation trial. No new gate, no new tiering — this card wires two dispatchers into machinery that already exists and already works for the probation roster's own review-seat trials.

## MVP

`we:skills-src/conveyor/build-dispatch-daemon.mjs` and `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs` each gain the branch above, gated strictly by `CRITICAL_WORK_GATE.openForNonCritical` (today: `doc-fix`, `ci-heal` only — `bugfix`/`conflict-resolution` stay Claude-only until the companion decision card opens them). No UI, no new CLI flags, no change to `we:scripts/lib/provider-routing.mjs`'s own recommendation shape. Cut anything about persisting a "why this backend" audit trail beyond what `we:scripts/lib/dispatch-contracts.mjs` already logs.

## Test plan (each fails before the fix, passes after)

1. A build-dispatch-daemon unit test: given a `doc-fix`-eligible build candidate with `alternateBackend` offered, the daemon calls `we:scripts/gemini-direct-task.mjs` (mocked) instead of falling straight to Claude dispatch.
2. Same shape for the fix-dispatch path (`we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`) on a `ci-heal` candidate.
3. A model-tier test: a `simpleOnly`-eligible task (e.g. a card-only PR) resolves to `AGY_GEMINI_SIMPLE_MODEL`; a non-simple opened task resolves to the agy-claude/gemini-3.1-pro tier — never a hand-invented model string.
4. A gate test: a `bugfix`/`conflict-resolution` candidate (still closed) is NEVER routed to agy by either daemon, confirming the branch respects `CRITICAL_WORK_GATE.openForNonCritical` rather than firing on `alternateBackend` alone.
5. Rating integration: an agy-dispatched run this daemon launched gets scored through the existing `we:scripts/conveyor/run-rating.mjs` path exactly like a Claude run, so a bad trial closes the offer via the mechanism that already exists.

## Proof plan (soak break)

- **Before (RED):** add a soak break under `we:scripts/conveyor/soak/breaks/` that stands up a `doc-fix` candidate with `alternateBackend` offered and asserts the daemon dispatches it to agy — this fails today because neither daemon consumes the field.
- **After (GREEN):** same break passes once the branch lands.
- **Live proof:** the next real `doc-fix` or `ci-heal` candidate `we:skills-src/conveyor/build-dispatch-daemon.mjs` (or the fix path) picks up gets launched via `we:scripts/gemini-direct-task.mjs`, not native Claude — record the actual dispatched run's provider/model in the PR, not just the passing test/soak break.

## Follow-ups

- Once `bugfix`/`conflict-resolution` are opened (companion decision card), extend the same branch's gate check — no new wiring needed, just the roster/gate update.
- Consider surfacing "routed to agy vs Claude, and why" in the daemon's own run summary/telemetry, so the operator doesn't have to read scorecards to see the split — deliberately cut from this MVP.
