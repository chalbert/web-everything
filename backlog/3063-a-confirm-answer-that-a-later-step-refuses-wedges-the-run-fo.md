---
bornAs: xzjppfr
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3035", "3032", "2895", "3072", "3073", "3036"]
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs"]
dateOpened: "2026-08-10"
tags: [operations, engine, confirm, usability, cost]
---

# A confirm answer that a later step refuses wedges the run forever — the operator loses the juror spend

Answer `accept` at `review-pr`'s `confirm` on a gate-self PR and the run can never reach any other answer. The
answer is already committed to the record, so the only step left is `record`, which throws every time. **Nothing
is written and nothing is at risk** — this is a usability and cost defect, not a safety one. The cost is one
juror spawn, thrown away.

> **PREPARED 2026-08-14. The fork is RULED — option 3 ("make the wedge cheap"), scoped up slightly.** See
> *The ruling* below. Options 1 and 2 are rejected with reasons and stay unfiled. Premise re-verified against
> `origin/main` at `087d7318`: **still true, nothing has been built, and the wedged record is still on disk.**

## Reproduction, against `main` at `2d895912`

The first live gate-self exercise of the operation (#3035) left the run on disk:
`we:.operations/runs/review-pr-e9f18407-320a-4e62-b764-b9bf6ef096bd.json` — `chalbert/web-everything#1153`,
`cursor: 4`, `pending: null`, `findings.confirm: "accept"`, `verdict.verdict: "needs-human"`,
`findings.read.labels: ["review:human"]`, `effects: []`. Replayed against a **copy** of that record
(`OPERATION_RUNS_DIR` pointed at a scratch dir, so the real record was not touched):

`--resume=<id> --answer=changes` → exit 2:

> `error: run review-pr-e9f18407-320a-4e62-b764-b9bf6ef096bd is `running`, not awaiting a decision — refusing an --answer for a question that has not been asked. Re-run without --answer to drive it to its next stop.`

`--resume=<id>` with no answer → exit 1, and identically on every repeat:

> `error: review-pr.record: refusing to record `accepted` on chalbert/web-everything#1153 — gate-self: review:human is human-ceremony-only — clear via /review in a session. The refusal is `decideSetLabel` in `we:scripts/review-set-label.mjs` (INVARIANT 2, #2470/#2644); this operation does not carry a route around it. …`

After both, the record is byte-for-byte where it was: `cursor 4`, `confirm accept`, `0` effects. `gh` confirmed
nothing reached the PR. **The guard did exactly its job.**

Two details make the wedge total rather than incidental:

- The refusal reads `findings.read.labels`, which was **frozen at the `read` step**. #1153 has since been
  cleared by a human and merged (`review:accepted`, merged `2026-08-10T20:06:36Z`) — the wedged run still
  refuses, because it is arguing with a snapshot, not with the PR.
- The throw escapes [we:scripts/operations/cli-adapter.mjs#driveRun](../scripts/operations/cli-adapter.mjs)
  uncaught and lands in the catch in [we:scripts/operations/run.mjs](../scripts/operations/run.mjs), which
  prints the message verbatim and exits 1. So there is currently **no seam that could tell the operator what to
  do next**.

## What it cost

The run's own telemetry, recorded by #3035's meter: **$0.4599** for one `correctness` juror, `sonnet`,
`effort: high`, 12.6s wall, 70,688 loaded context tokens. A fresh run re-spawns that juror, so a mis-answer on a
gate-self PR costs about **46 cents and a repeat wait** — the whole loss.

## The tension — the wedge is arguably correct

Do not read this as a bug to be steamrolled. The engine
([we:scripts/operations/engine.mjs#resolvePending](../scripts/operations/engine.mjs)) commits the confirm answer
as a finding and clears `pending` in the same `advance`, exactly as it does for a `judge` answer. Effects are
keyed and replayed from the record, and the adapter's `--answer` guard exists so a caller cannot answer a
question that was never asked. Letting a caller retarget an answered `confirm` means **mutating a suspended
run's recorded decision**, which is the one thing append-only replay safety forbids. Any fix has to buy the
operator's seconds back without buying that.

Note also that nothing here is gate-self-specific. The general shape is: **any post-`confirm` step whose fn
throws deterministically for the answer recorded** wedges its run the same way. Gate-self is simply the first
one we have hit.

## 2026-08-14 — the premise, re-verified against `origin/main` at `087d7318`

Read, not assumed. Four sessions of engine work have landed since this was filed (#3072 unattended confirm,
#3073 the in-flight park, #3082 the effect finding, #3036 the HTTP adapter) and **none of them touched the
wedge**:

- `we:scripts/operations/review-pr.mjs:492-500` still throws inside the `record` step's `effects(view)` when
  `decideSetLabel` answers `allowed: false`. Same message, verbatim, as the reproduction above.
- The throw is raised by `we:scripts/operations/engine.mjs:394` (`const declared = step.effects(view)`, the
  `effect` case of `advance`), reached from the plain `running` branch of `driveRun`
  (`we:scripts/operations/cli-adapter.mjs:349-350`). **There is still no `try` anywhere on that path.**
- The wedged record is still on disk exactly as described: `cursor 4`, `pending null`, `findings.confirm
  "accept"`, `verdict "needs-human"`, `findings.read.labels ["review:human"]`, `effects` length `0`,
  `input {pr: 1153, repo: "chalbert/web-everything", lens: "correctness", actor: "operator"}`.

Two claims on the card needed correcting, and one surface was missing:

- **"the wedge is currently pinned by nothing" is now only half true.** The ENGINE-level throw IS pinned:
  `we:scripts/operations/__tests__/review-pr.test.mjs:172-187` drives `accept` on a `review:human` PR and
  asserts `advance` throws with the `human-ceremony-only` + `decideSetLabel` text and declares zero effects.
  What is pinned nowhere is the **operator-visible outcome** — no test drives this through
  `runOperationCli`, so the exit code and the printed lines are unasserted. That is exactly the surface this
  story changes, so the acceptance criteria below are written at that level.
- **`options` is still static-only**, confirming option 1 is unbuilt: `we:scripts/operations/step-kinds.mjs:149-173`
  accepts `asks`/`of` as `string|fn` and `options` as an array only, and `confirm()` seals
  `options: options ? Object.freeze([...options]) : null`.
- **A second surface the card never mentioned: HTTP.** #3036 landed
  `we:scripts/operations/http-adapter.mjs:551-559`, whose `driveAndRespond` catches the same throw and returns
  a bare `fail(500, message)`. So today a declaration REFUSAL is reported to a network client as a server
  fault, with no run payload at all — the console cannot even see the run it just wedged.

**#3072 does not widen this.** `autoConfirm` (`we:scripts/operations/cli-adapter.mjs:287,305-307`) can answer a
confirm unattended, but `review-pr`'s `of` resolves to `human` on a gate-self PR
(`we:scripts/operations/review-pr.mjs:452`), and the agent-only policy declines a human-addressed confirm
(pinned at `we:scripts/operations/__tests__/review-pr.test.mjs:570-612`). An unattended loop therefore cannot
mint this wedge — it stays an operator typo. Worth restating because it is the reason this stayed a size-3
usability fix rather than becoming urgent.

## The ruling — option 3, scoped to both surfaces

**Take option 3: leave every refusal exactly where it is, and turn the uncaught throw into a rendered stop.**
The one adjustment to the card's own framing is that "one line in the CLI" is the wrong shape now that #3036
exists — a `try` in `we:scripts/operations/run.mjs`'s entry point would fix the terminal and leave the HTTP
500. So the catch goes in `driveRun`, which both adapters share, and comes back as a new `stopped` state the
way `effect-halted` and `effect-in-flight` already do. That is the whole change: **no engine edit, no
vocabulary change, no new persisted field, no recorded decision mutated.**

**Why not option 1 (conditional `options`).** It is buildable — the per-run snapshot the closed-set check
would need already exists on the record (`we:scripts/operations/engine.mjs:388` writes
`pending.options`; the check at `:269` just reads the DECLARATION's copy instead). It is rejected anyway for
two reasons. First, it fixes gate-self and nothing else: the general shape this card itself names — *any*
post-`confirm` step whose fn throws deterministically — still wedges, and still with no rendered outcome. It
buys one case at the price of opening a closed vocabulary. Second, it cannot even fully close gate-self,
because the option set would be computed from the same frozen `read` snapshot the refusal argues with; a PR
whose labels changed after `read` gets a stale option list rather than a stale refusal. Same defect, moved
earlier and made harder to see.

**Why not option 2 (re-answer while `run.effects` is empty).** Rejected on merit, not just on caution. It
gives up "a decision, once recorded, is recorded" — the property replay safety is built on — and in this
exact case it buys nothing: the recorded run is arguing with a snapshot of a PR that has since been merged,
so a re-answer of `changes` would record a bounce against a state that no longer exists. The operator wants a
FRESH run against the live PR, which is what option 3 hands them.

**What is deliberately NOT claimed.** The new stop does not assert the run is "spent" — `driveRun` cannot tell
a deterministic refusal from a transient one. It states only what is true on every path: the answer recorded
at the `confirm` step is committed, a `--resume` replays this same step with it, and here is the command to
start over. That distinction is why the acceptance criteria below include a non-`confirm` throw.

## Scope and consumers

Found by reading the call graph, not by trusting the card's original `scope` — which listed
`we:scripts/operations/step-kinds.mjs` and `we:scripts/operations/review-pr.mjs`, **both now out of scope**
because the ruling changes neither.

- `we:scripts/operations/cli-adapter.mjs` — the only production file edited. `driveRun` (`:287`) gains the
  catch; `renderOutcome` (`:475`) gains a branch before its fallthrough at `:544`; one new pure helper.
- **Consumer 1 — `we:scripts/operations/run.mjs:151-155`.** Its `.catch` prints `error: <message>` and exits 1.
  After the change that catch is no longer reached for a step refusal; the refusal arrives as
  `{ code, lines }` from `runOperationCli` instead. The catch STAYS — it still covers a throw from
  `resolveOperation`, `buildCliSpec` or the store.
- **Consumer 2 — `we:scripts/operations/http-adapter.mjs:551-560`.** Its own `try` around `driveRun` stops
  firing for this class; the outcome falls to the `settled` check at `:560`, which does not list the new
  state, so the route returns **500 with the full `outcomePayload`** instead of a bare `fail(500, …)`. The
  status code is deliberately unchanged — a refused step IS a failure — but the client now gets `runId`,
  `findings`, `pending`, `telemetry` and `error`. **No edit to this file is required**; the improvement is a
  consequence, and it gets a test rather than a code change.
- **Not a consumer:** `we:scripts/operations/effect-executor.mjs`. A sink failure is RETURNED
  (`outcome.error` → `effect-halted`, `we:scripts/operations/cli-adapter.mjs:337`), never thrown, so nothing
  about the executor's paths changes.

## Size

**3.** Basis: one production file, ~35 lines across three edits (a `try` in the `driveRun` loop, a
`renderOutcome` branch, one pure restart-command helper), plus four tests in two existing files. Raised
from the filed **2** for a stated reason: 2 assumed the card's "a `try`/`catch` and nothing else", which
counted neither the render branch, nor the helper, nor the second adapter that did not exist when the card
was written. Not 5 — nothing in `we:scripts/operations/engine.mjs` changes, the step vocabulary stays closed
at four, and no run-record field is added, so there is no replay or migration surface.

## Interfaces and protocol

**The new stop, alongside the existing three.** `driveRun`'s current signature and return
(`we:scripts/operations/cli-adapter.mjs:287`) are unchanged:

```js
export async function driveRun({ run, registry, store, sinks, judge, resume = null,
                                 maxTurns = 64, autoConfirm = null, attemptedBy = 'unknown' } = {})
// → Promise<{run, stopped, error, applied, inFlight?}>
```

`stopped` gains **`'step-refused'`** — carrying the thrown error in `error`, joining `'complete'`,
`'confirm'`, `'stuck'`, `'effect-halted'` and `'effect-in-flight'`. The `try` wraps the `advance` calls inside
the loop, so a throw from ANY step kind's fn is covered (a `compute` `fn`, a `judge` `request`, a `confirm`
`asks`/`of`, an `effect` `effects`), not only `record`'s. The `maxTurns` runaway throw at the end of
`driveRun` stays a throw — it is a driver bug, not a declaration refusal, and it has no run state to render
against.

**The new pure helper**, exported from the same module so a test asserts on it directly:

```js
/** The command line that starts this run again from its own recorded input. PURE. */
export function restartCommand(run)  // → string
```

It renders the `we:scripts/operations/run.mjs` invocation for `run.op`, plus `--<key>=<value>` for each entry
of `run.input`. Field names map 1:1 to flags — `buildCliSpec` (`we:scripts/operations/cli-adapter.mjs:55-58`)
derives every flag straight from `declaration.input`'s keys, and `:59-65` refuses a field that collides with a
control flag, so this cannot render an ambiguous line. For the record on disk it yields
`node we:scripts/operations/run.mjs review-pr --pr=1153 --repo=chalbert/web-everything --lens=correctness --actor=operator`.

**The rendered stop** (non-`--json`), exit code **1**:

```
run <id> — REFUSED at `record`: <the declaration's message, verbatim>
the answer recorded at `confirm` is `accept`; it is committed, and a --resume replays this same step with it.
if this refusal is deterministic the run cannot reach another answer — start a fresh one:
  node we:scripts/operations/run.mjs review-pr --pr=1153 --repo=… --lens=… --actor=…
<judge spend lines>
```

The middle two lines are emitted **only when the run holds a finding for an earlier `confirm`-kind step**;
otherwise just the `REFUSED` line, the restart line, and the spend. That predicate is `run.findings` keyed by
a step whose kind is `confirm` at a `stepIndex` below the refusing one — checkable from the record and the
declaration, no new state. The spend lines are `renderSpendLines(run)` (`:418`), which is the point of the
whole card: the operator is told what the thrown-away juror cost.

**`--json`** returns `outcomePayload(outcome)` (`:456`) with `stopped: 'step-refused'` and `error` set, at
exit code 1 — `renderOutcome`'s json branch at `:477-484` already handles this with no edit, because
`step-refused` is simply not in its exit-0 list.

## Tasks

1. In `we:scripts/operations/cli-adapter.mjs`, wrap the `advance` calls inside `driveRun`'s loop in a `try`
   and return `{ run: current, stopped: 'step-refused', error: e, applied }` on a throw. Leave the `maxTurns`
   throw after the loop uncaught.
2. Add and export `restartCommand(run)` — pure, rendered from `run.input`.
3. Add the `stopped === 'step-refused'` branch to `renderOutcome`, before the `:544` fallthrough, with the
   conditional prior-`confirm` lines and `renderSpendLines`.
4. Update the module header's list of stops and the `driveRun` return-type JSDoc.
5. Test in `we:scripts/operations/__tests__/review-pr.test.mjs`: drive a gate-self PR through
   `runOperationCli` to `accept` and assert `code === 1`, `stopped === 'step-refused'`, the refusal text
   verbatim in `lines`, the restart command line, and that the record still holds `effects: []`.
6. Test the same run with `--json`: exit 1 and an `outcomePayload` carrying `stopped`, `error`, `findings.confirm`.
7. Test the no-prior-`confirm` case — a declaration whose FIRST step throws — and assert the two
   confirm-specific lines are absent while the restart line is present.
8. Test in `we:scripts/operations/__tests__/http-adapter.test.mjs`: the same drive returns 500 with a body
   containing `runId` and `stopped: 'step-refused'`, not a bare error string.

## Done when

- [ ] Driving a `review:human` PR to a `confirm` answer of `accept` through `runOperationCli` returns exit
      code `1` and `stopped: 'step-refused'` — it does not throw out of `driveRun`.
- [ ] The printed lines contain the declaration's refusal message verbatim (the `human-ceremony-only` and
      `decideSetLabel` text), unparaphrased.
- [ ] The printed lines contain a runnable restart command derived from `run.input`, equal to
      `restartCommand(run)`.
- [ ] The printed lines contain the juror spend for the run — a wedged run states what it cost.
- [ ] The run record after the refusal is unchanged: `cursor` unchanged, `findings.confirm` still `accept`,
      `effects` still `[]`. Nothing is recorded, nothing is retried, no recorded decision is mutated.
- [ ] A re-run of the same `--resume` produces byte-identical output and the same exit code — the stop is
      idempotent.
- [ ] `--json` on the same run exits 1 and emits `outcomePayload` with `stopped: 'step-refused'` and `error`.
- [ ] A run whose FIRST step throws (no prior `confirm` finding) renders the refusal and the restart line and
      **omits** the two "answer recorded at `confirm`" lines — the stop never claims a decision that was not made.
- [ ] The HTTP drive route returns 500 with the full run payload (`runId`, `findings`, `error`), not
      `fail(500, <string>)`.
- [ ] `we:scripts/operations/engine.mjs` and `we:scripts/operations/step-kinds.mjs` are untouched by the diff.
- [ ] `npm run check:standards` at 0 errors and `npm run test:unit` green.

## Delivery shape

**One piece.** The three production edits are one mechanism — a state that is returned but never rendered is
worse than the throw it replaces, and a render branch for a state nothing produces is dead code. The tests
are the only thing that could be split off, and splitting tests from the behaviour they pin is the shape this
repo keeps refusing. No slice is independently deliverable, and the whole thing is ~35 lines.

## Watch for

- **Do not catch the `maxTurns` runaway.** It is thrown from OUTSIDE the loop deliberately; folding it into
  `step-refused` would report a driver bug as a declaration refusal and hand the operator a restart command
  for a run that would loop again.
- **Do not touch the refusal itself.** `decideSetLabel` and INVARIANT 2 are the point; this story only gives
  the refusal a place to land. A diff that edits `we:scripts/review-set-label.mjs` has misread the card.
- **`error` must survive `outcomePayload`.** It already stringifies `error` (`:460`), but only when truthy —
  a branch that returns `stopped: 'step-refused'` with `error: null` would render an empty refusal.
- The two rejected options stay **unfiled**, per the card's original instruction. If something else later
  wants a per-run `options` set, it should be filed on its own merit, not resurrected from here.
