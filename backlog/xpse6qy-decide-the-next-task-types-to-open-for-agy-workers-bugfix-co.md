---
kind: decision
status: open
scope: ["we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Decide the next task types to open for agy workers (bugfix, conflict-resolution)

`CRITICAL_WORK_GATE.openForNonCritical` in `we:scripts/lib/provider-routing.mjs` opens only `doc-fix` and `ci-heal` for the `PROBATION_ROSTER` (antigravity-claude, antigravity-gemini, codex) — on probation since 2026-09-27; the file's own comment says `bugfix` is next 'once these two have data.' Live scorecard pull (2026-09-29, the operator's own local run-scorecards state, 3147 records): there is NO data yet for either opened taskType. Zero `doc-fix`/`ci-heal` runs were ever dispatched to antigravity-claude or antigravity-gemini specifically (the only `doc-fix` runs recorded anywhere, 3, all landed, ran on `codex`, model `gpt-6-astra`; `ci-heal` has zero runs of any kind). The 623 `antigravity`-provider rows that DO exist are all a different thing: 608 `advisory-review` judge-seat trials (model `gemini-3.1-pro`, all `probationStatus: probation`, scored 2026-09-25 through 2026-09-29, outcome not yet rated) plus 15 one-off `session-delegation` trials predating the gate (10 `conflict-resolution` landed on model `gemini-3.8-flash-low`, 5 `other` — 2 on `claude-sonnet-4-6`, 1 on `gemini-3.1-pro`, 2 on `gemini-3.8`, of which 3 landed / 2 rejected). None of these 623 rows are a build or fix under the newly-opened gate — they predate it or are a separate review-seat role. Root cause tracked separately (companion card, this same PR): no dispatcher actually launches `we:scripts/gemini-direct-task.mjs` when `alternateBackend`/the probation roster is offered for `doc-fix`/`ci-heal` builds — so the probation window has produced zero build/fix trials to score, not zero-because-they-failed. Fork for the ruling: (a) leave `bugfix`/`conflict-resolution` closed until the companion wiring card lands AND produces real doc-fix/ci-heal trial data — the operator's own stated precondition, now blocked on wiring, not judgment; (b) open `conflict-resolution` now anyway, reusing the 10 pre-gate `session-delegation` trials (all landed) as its own probation evidence, since that taskType already has a real track record even though it predates `CRITICAL_WORK_GATE`; (c) open both `bugfix` and `conflict-resolution` now on the theory that probation-with-review-gate is itself the safety net and waiting for doc-fix/ci-heal data first adds delay without adding safety. Default recommendation: (a) — the operator's own comment already conditions `bugfix` on doc-fix/ci-heal data existing, and none does yet; ratifying now would be deciding ahead of the evidence it explicitly calls for. No code changes by this card — ruling + roster/gate update only.

## Design

This is a ruling, not a build — "design" here is the decision surface itself: which taskType(s) `CRITICAL_WORK_GATE.openForNonCritical` in `we:scripts/lib/provider-routing.mjs` opens next, and on what evidence. The three forks are laid out in the description above (a/b/c). Model detail per prior probation run, since the ruling should weigh what's actually been tried: the 608 `advisory-review` judge-seat trials all ran `gemini-3.1-pro` (agy's non-simple Gemini tier); the 15 pre-gate `session-delegation` trials ran a mix — 10 `conflict-resolution` on `gemini-3.8-flash-low` (all landed), 2 `other` on `claude-sonnet-4-6` (agy-claude, sonnet tier), 1 `other` on `gemini-3.1-pro`, 2 `other` on `gemini-3.8`. None of these are the SIMPLE tier (`AGY_GEMINI_SIMPLE_MODEL` = `gemini-3.8-flash-high`) `we:scripts/lib/provider-routing.mjs` pins for low-judgment work — so even the existing track record says nothing yet about that tier specifically.

## MVP

The ruling itself: pick one of forks (a)/(b)/(c), update `CRITICAL_WORK_GATE.openForNonCritical` and `PROBATION_ROSTER` in `we:scripts/lib/provider-routing.mjs` accordingly (or explicitly ratify "no change yet" if (a) wins), and record the reasoning + the scorecard numbers above as the codified rationale (`we:docs/agent/platform-decisions.md` if this rises to statute level, otherwise the resolved card's own text). No code beyond the gate/roster constants — the companion story card owns the actual dispatch wiring.

## Test plan (each fails before the fix, passes after)

1. If a taskType is newly opened: a `we:scripts/lib/provider-routing.mjs` unit test asserting `CRITICAL_WORK_GATE.openForNonCritical['bugfix']` (or `'conflict-resolution'`) is now `true`, with the matching `PROBATION_ROSTER` entry present.
2. A regression test confirming the STILL-closed taskType(s) remain `false` — the ruling should be scoped, not a blanket open.
3. If fork (a) is ratified instead ("wait for data"): no code test applies; the "test" is that the companion wiring card (story, this same PR) is filed and its own soak break is the gating proof before this decision is revisited.

## Proof plan (soak break)

No soak break applies to the ruling itself (no code path to break/fix) — the proof is evidentiary: this card's digest already cites the live scorecard pull (2026-09-29) showing zero doc-fix/ci-heal dispatches to antigravity-claude/antigravity-gemini exist yet. If a taskType is opened, the live proof is the FIRST real dispatch under the new gate landing a scored run (via the companion card's wiring) — cite that run's id/outcome when this decision is revisited or amended.

## Follow-ups

- Re-run this same scorecard pull once the companion wiring card (story, this PR) lands and has produced real doc-fix/ci-heal trials — that is the direct trigger to revisit fork (a) with actual data instead of zero.
- If fork (b) or (c) is chosen instead, file the `PROBATION_ROSTER`/gate update as its own small follow-up story rather than editing the constant by hand outside a lane.
