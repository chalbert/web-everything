---
bornAs: xf3gv78
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-11"
tags: [plateau-loop, delivery, operations, review, engine]
scope:
  - we:scripts/operations/review-pr.mjs
  - we:scripts/lib/judge-spawn.mjs
  - we:scripts/review-set-label.mjs
---

# Declare the review loop as an operation, with a round cap that distinguishes converged from gave-up

Every piece exists — `judgeSpawn` mints an independent actor, `review-set-label` enforces the self-clear
refusal, `review-pr` is declared. What does not exist is them being **one operation** instead of a person
hand-writing a prompt, spawning a session, reading the report and deciding. On 2026-08-11 that loop was run by
hand **nine times**.

## 2026-08-12 — FIRST SLICE LANDED: the juror can act

I was wrong about how much was missing. `review-pr` already declares the full pipeline — `read` → `judge` →
`reduce` → `confirm` → `record`, with four ordered effects including the label swap. It was never a stub.

**Exactly one thing made every review get hand-crafted instead: the juror was tool-free.** `buildJudgeArgv`
hardcoded `--tools ''`, so a juror could read a diff and nothing else. Every significant find this week came
from *acting* — firing a `gh` command at the real API, reproducing a bug on the parent commit, mutating source
to see which tests stayed green. None of those are reachable by reading.

`allowedTools` now threads through `buildJudgeArgv` → `judgeSpawn` → the CLI adapter, and `review-pr` requests
`Bash`, `Read`, `Grep`, `Glob`. **Tool-free stays the default**, so every other caller is unchanged.

**What replaces the guarantee `--tools ''` gave**, since that was its whole justification — two properties,
both enforced by hooks rather than instruction:

- the spawn's `cwd` is a lane, so `guard-lane` denies any write to a shared checkout;
- its `sessionId` is derived, so it differs from the author's and the self-clear refusal holds.

Neither depends on the juror cooperating, which is the same bar `--tools ''` met.

A flag-shaped tool name is refused at both boundaries — the same hazard as a flag-shaped `model`, one field
over, and pinned by test at each.

**Still owed on this card:** the round cap with distinguishable *converged / exhausted / stuck*, and answering
the `confirm` step unattended for `AGENT` actors. Those are what remain between this and a loop that runs
without a person.

## Why it is the highest-value slice

It is the most repeated action in the delivery loop, and the only one still entirely manual. It is also the one
whose manual execution keeps producing the same two defects:

- **A reviewer spawned the wrong way is not independent.** A subagent inherits its parent's session id, so
  every review that day shared the author's actor. The guard caught it on the PRs that carried an author stamp
  and missed the one whose stamp had been stripped — that PR merged on its own author's clearance. An operation
  cannot make that mistake, because the spawn is not a choice made per-invocation.
- **A headless reviewer that starts slow work and exits produces nothing.** Verified repeatedly: the session
  ends mid-gate, having done the analysis and set no label. State in a process is state that evaporates; state
  in a run record does not. Routing the loop through the engine is what fixes this, and is why this slice comes
  after `#3073` and `#3070` rather than before.

## The round cap is not a nicety

PR #1164 went **five review rounds**, each finding a real bypass of the previous fix, each believed to be the
last. Unbounded, a mechanised loop would still be running.

So the operation needs a cap — and, more importantly, its terminal states must be **distinguishable**:

| outcome | means |
| --- | --- |
| converged | the reviewer accepted |
| exhausted | the cap was hit with findings outstanding |
| stuck | rounds are producing findings that do not shrink |

"Converged" and "gave up" must never look alike downstream. A loop that reports success on exhaustion is worse
than one that never terminates, because the second is visible.

## What it must NOT automate

Deciding whether a finding is **correct**. Several reviews that day refuted the author's *reasoning* rather
than a fact — one showed a fix's justification was unsound while the fix itself was fine. That judgement stays
with a human or a distinct agent well past the point where the mechanics are automatic.

## Watch for

- The independence check reads an actor id; the operation must derive one per juror rather than inheriting, and
  a test must assert the derived id differs from the caller's.
- Findings must carry forward between rounds, or round N+1 re-finds what round N fixed.
- Per-round cost belongs in the run record — nine reviews in one day cost roughly 1.1M tokens, and that was
  only knowable anecdotally.

## Done when

- [ ] One invocation runs spawn → gates → verdict → label without a person composing a prompt.
- [ ] The reviewer's actor id is derived, never inherited, and that is asserted.
- [ ] The loop terminates, and converged / exhausted / stuck are distinguishable in the run record.
- [ ] A session dying mid-round loses no state.
