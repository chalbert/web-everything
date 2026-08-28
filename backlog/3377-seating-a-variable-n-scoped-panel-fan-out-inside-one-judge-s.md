---
bornAs: x79c033
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-27"
blockedBy: ["3158"]
relatedTo: ["3319", "3326", "3031"]
tags: [review, jury, operations]
---

# Seating a variable-N scoped panel — fan out inside one judge step's caller, or widen the judge request

Scoped fan-out (#3326) needs a variable number of juror seats, but STEP_KINDS is closed at four (#3031), the step list is fixed at registration, and advance's judge case refuses anything that is not one {mandate,input,shape}. Decide where the fan-out lives.

*Carved out of #3326 during its 2026-08-27 preparation, which surveyed the options and grounded them but did
not rule. Not `preparedDate`-stamped: the decision turn still owes it a skeptic pass and a two-confusion
screen.*

## The wall, in three facts from the tree

1. **The step vocabulary is closed at four by ratified statute.** `STEP_KINDS` is
   `['compute', 'judge', 'confirm', 'effect']` (`we:scripts/operations/step-kinds.mjs`), and its own header
   quotes #3031: *"An operation that appears to need a fifth kind is a signal to change the model, not to
   extend the vocabulary."* `op()` refuses a fifth kind **at registration**.
2. **The step list is fixed before any PR is read, and a step cannot decline to run.** #3319's own residual
   records it: *"The step list is fixed at REGISTRATION … the engine runs every declared step at its cursor …
   An input cannot gate it either — an input changes what a step ASKS, never whether it RUNS."*
3. **A `judge` step declares exactly one juror call.** `advance`'s `judge` case
   (`we:scripts/operations/engine.mjs`) throws unless the request is one `{ mandate, input, shape }` with a
   non-empty string mandate and a non-empty string input.

So `k` scoped seats, where `k` varies per PR, cannot be `k` declared steps.

## Fork 1 — where the fan-out lives

**The fork exists because the two branches cannot coexist**: the engine's `judge` request is either one
mandate-shaped object or a seat list, and every telemetry, ledger and write-up consumer downstream reads it as
one or the other. There is no shape that is both.

### (a) Caller-side fan-out — **the bold default**

One declared `judge` step. Its `request.input` carries the whole diff *and* the shard plan; the caller
(`we:scripts/operations/cli-adapter.mjs`) spawns `k` jurors through `judgePanel`
(`we:scripts/lib/judge-panel.mjs`, built and unwired, #3050) and resumes the run with a reduced verdict.

- **Costs nothing structural.** No engine change, no statute pressure, no new step kind.
- **The price, and it is the same price #3319 already recorded, multiplied.** `factsFromRun` in
  `we:scripts/operations/record-verdict.mjs` takes the first telemetry entry as `sessionId` and reads
  `record.input.lens` for the lens, so a transported verdict already *"names one lens where two jurors sat"*.
  Under caller-side fan-out it would name one seat where `k + 2` sat. The record under-claims coverage rather
  than inventing it — partial in the safe direction — but a review whose observability is `1/k` accurate is a
  poor foundation for the #3318 metric front, whose whole job is measuring what the panel found.

### (b) Widen the judge request to carry seats

`advance`'s `judge` case accepts `{ seats: [{ mandate, input, shape, scope }, …] }` alongside today's single
shape, and the engine records one telemetry row per seat.

- **Buys honest observability** — the ledger's `roster-picked` event already models `JurorSpec[]`
  (`we:scripts/lib/jury-core.mjs`), so N seats are representable there today; the engine is the only layer
  that flattens them.
- **Costs an engine change on the trust chain.** It is `gate-derivation` (agent-clearable) rather than
  `gate-self`, per `we:scripts/lib/review-policy.contract.json` — but it widens the one contract #3031's
  closure rests on, and the statute's *"change the model, not the vocabulary"* line is exactly the argument a
  reviewer will raise. It does not add a fifth **kind**, which is the letter of the statute; whether it
  offends its spirit is the call.

### Ruled out

- **`k` declared steps with the unused ones idling** — impossible: `advance` runs every declared step at its
  cursor and the `judge` case refuses a request that is not judgement-shaped, so a step cannot decline.
- **Subagent fan-out via the Workflow runtime** (`we:skills-src/jury/subject-jury.workflow.js`) — a subagent
  inherits its parent's `CLAUDE_CODE_SESSION_ID`, measured twice (#3006, #3048), so by the test this repo
  keys reviewer identity on it is *one actor wearing N hats*. That is the failure `judgePanel` exists to
  remove, and scoped fan-out's whole claim is independent seats.

## What the decision turn still owes

- A **skeptic** pass on branch (a) — the attack to make is that shipping fan-out with `1/k` observability
  makes the #3318 metric front unmeasurable at exactly the PRs it most needs to measure.
- A **two-confusion screen** on both branches.
- A **statute-overlap check** against `#operations-declared-once-callers-generated` before anything is
  codified.

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn` set,
   and the ruled branch is reachable: either a named test asserts `advance` still refuses a non-`{mandate,
   input, shape}` judge request (branch a), or a named test drives a multi-seat judge request end to end and
   asserts one telemetry row per seat (branch b).
2. `npm run check:standards` — 0 errors.
