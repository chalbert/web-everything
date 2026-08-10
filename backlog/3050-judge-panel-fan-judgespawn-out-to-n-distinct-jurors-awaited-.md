---
bornAs: xnc8wyd
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-09"
dateStarted: "2026-08-09"
dateResolved: "2026-08-09"
graduatedTo: scripts/lib/judge-panel.mjs
scope:
  - we:scripts/lib/
scopeRationale: "One new fan-out module beside the shipped judge-spawn helper, plus its tests in scripts/lib/__tests__/; no sibling slice writes there."
tags: [plateau-loop, delivery, operations, jury, judge, panel]
---

# Judge panel — fan judgeSpawn out to N distinct jurors, awaited and budgeted as one

One operation that spawns N jurors in parallel over judgeSpawn, each a structurally distinct actor with its own session id, awaits all of them, and returns their verdicts together under one aggregate budget and a fail-closed depth cap.

## What exists, and what this adds

**The single spawn already shipped.** #3028 landed
[we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) (PR #1131, merged 2026-08-09,
`e33bf88cc194032a3b25ec4ace12d31a3638c845`): `judgeSpawn` plus the pure seam it rests on — `buildJudgeArgv`,
`parseJudgeOutcome`, `deriveSessionId`, `loadedContextTokens`, `assertNoForbiddenArgv`. It has **no callers
yet**; the only files that import it are its own tests and
[we:scripts/measure-judge-spawn.mjs](../scripts/measure-judge-spawn.mjs).

**The panel lens vocabulary already exists too, and is pure.**
[we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs) declares `PANEL_LENSES`, `panelRigorForCareLevel`
(which returns `lenses` + `jurorsPerLens`) and the diversity-selection reduction — but it spawns nothing. It
names the fan-out set; it does not perform the fan-out.

**The fan-out that does exist today is subagent-based, and that is the problem.**
[we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js) (#2658, resolved
2026-07-25) fans out one juror per rostered seat through the Workflow runtime's `agent()` primitive. A subagent
**inherits its parent's `CLAUDE_CODE_SESSION_ID`** — recorded in the header of
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs), measured on 2026-08-08 in
#3006 (parent `01f39b97…`, child `f4386de9…`), and re-measured on 2026-08-09 in #3048 (a subagent reported its
parent's id byte-for-byte). By this repo's own independence test, a subagent panel is **one actor wearing N
hats**.

This slice is the layer between: **`judgePanel` — take a roster, spawn one `judgeSpawn` per seat in parallel,
await every one, and return the per-juror results together.** It reimplements nothing in `judgeSpawn` and rules
nothing that `jury-core` already rules.

## Why it is worth a distinct operation, not caller discipline

Because `judgeSpawn` derives its session id from `runId` + `lens` and **returns** it, a panel is *recordable*:
which juror, which lens, which verdict, all nameable after the fact, as a machine fact rather than a sentence in
a prompt. That property only pays out if something owns the fan-out.

The empirical case for independent jurors is on the record from 2026-08-09, on one PR:

- **PR #1128** was reviewed three times. The third pass — a clearing session that re-derived the numbers with
  its own from-scratch classifier — corrected three figures the two prior rounds had wrong: **230 not 226**
  reclassified files tree-wide, **17 not 18** of 36 trees carrying the FUI-arrow sentence, and **95 not 94**
  distinct `#NNNN` in added lines. All three corrections are recorded in that PR's own review comments.

Those catches came from a **different starting point**, not greater skill. A panel makes that structural instead
of something a caller remembers to ask for.

## Four constraints — the substance of this slice

### 1. Depth cap, fail-closed

A declared maximum nesting depth, refused past it — and **refused when depth is unknown**, applying the
fail-closed principle ratified in **#3013 Fork 2** on 2026-08-09 (*"absent diff ⇒ not routine"*; commit
`d84f7cb9`, PR #1127).

State the risk accurately, because the obvious version of it is already foreclosed: `buildJudgeArgv` always
emits `--tools ''`, so **a juror cannot spawn anything at all** — no subagent, no second headless process. A
juror-spawns-juror recursion is structurally impossible at the judge step and this cap is not what prevents it.
What the cap governs is the **operation** nesting one level up: a `judgePanel` invoked from a context that is
itself a panel child, or re-entered through a `compute`/`effect` step. There the floor is not natural and the
bill compounds, so depth must be an explicit parameter that fails closed rather than an assumption.

### 2. Aggregate budget, not just per-juror

`judgeSpawn` takes `budget` (`--max-budget-usd`, default `0.5`) **per spawn**. Five jurors at that cap is five
times the bill with nothing watching the total. The panel needs its own ceiling, checked **before** any child is
started, and it must be required rather than defaulted — an unset aggregate ceiling is the same fail-open the
depth cap rejects.

### 3. Synchronous by construction

The operation must await its children. This is **not caller discipline** — it must be impossible to get wrong.
The precedent is recorded: **#2833** (resolved 2026-08-02) exists because a build subagent *"launched a check in
the background and then blocked, waiting for a completion signal that never advanced it"*, holding a lane
producing nothing until a person nudged it. Its own remedy names this shape — *"or subagents must run their
checks synchronously"*. `judgePanel` must expose no detach/background path at all: one promise, resolved only
after every child has settled.

### 4. Sibling independence is the actual product, and must be tested

Each juror is distinct from the parent **and from its siblings**, because every headless spawn mints its own
session id and `judgeSpawn` makes that id *deterministic* by deriving it from `runId` + `lens`. #3028 records
three headless spawns whose environment carried the parent's id each reporting a **different** `session_id`;
#3048 records the subagent contrast on the same day. This is the one property the existing subagent fan-out
cannot have, so it is the one property the tests must pin.

Read the limit honestly, per **#2895**: a distinct session id is still not an *unforgeable* actor signal. What
it removes is the failure a subagent juror has **by construction** and cannot argue its way out of.

## Acceptance

- [x] `judgePanel({ jurors, runId, maxTotalBudgetUsd, depth, maxDepth, … })` spawns one `judgeSpawn` per entry in
      `jurors` concurrently and resolves to one result per juror, each carrying at minimum its `lens`,
      `sessionId`, `value`, `costUsd`, `wallMs` and `loadedContextTokens`.
- [x] **Pairwise-distinct sibling ids.** A test asserts that for a roster of N ≥ 3 seats the returned
      `sessionId` values are pairwise distinct, and a second test asserts the same over `deriveSessionId` alone
      (pure, no spawning) for N distinct `runId`+`lens` seeds — including two seats on the *same* lens, which is
      the `jurorsPerLens: 2` case `panelRigorForCareLevel` produces at care `high`.
- [x] **Depth fails closed.** Refused when `depth >= maxDepth`, and refused when `depth` or `maxDepth` is
      `undefined`/`null`/non-numeric. A test covers the unknown-depth refusal explicitly, not just the
      over-cap one.
- [x] **Aggregate budget is enforced before the first spawn.** With `sum(perJurorBudget) > maxTotalBudgetUsd`
      the call throws and **no** spawn function is invoked — asserted with an injected `spawnFn` counter, the
      pure-seam style [we:scripts/lib/__tests__/judge-spawn.test.mjs](../scripts/lib/__tests__/judge-spawn.test.mjs)
      already uses. An absent `maxTotalBudgetUsd` is likewise a refusal.
- [x] **No background escape.** The exported surface has no detach/`unref`/fire-and-forget path; a test asserts
      the returned promise settles only after every injected child has settled, and that one rejecting juror
      neither orphans its siblings nor resolves the panel early — the panel reports that seat as failed and
      still returns the rest.
- [x] `assertNoForbiddenArgv` still fires per child (a `--bare` juror is refused inside a panel exactly as it is
      alone).
- [x] Unit tests spawn no process (injected `spawnFn`). Any live test is **opt-in** behind an environment flag, as
      [we:scripts/lib/__tests__/judge-spawn.integration.test.mjs](../scripts/lib/__tests__/judge-spawn.integration.test.mjs)
      is — a panel bills N metered calls, not one.

### What shipped

- [we:scripts/lib/judge-panel.mjs](../scripts/lib/judge-panel.mjs) — `judgePanel` plus the pure seam it rests on:
  `panelSeats` (roster → named seats with pairwise-distinct derived session ids, spawns nothing),
  `assertPanelDepth` and `assertPanelBudget` (the two fail-closed admission guards, provable on their own). It
  imports `judgeSpawn`, `buildJudgeArgv`, `assertNoForbiddenArgv` and `deriveSessionId` from
  [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) — **no second argv recipe, no second denylist,
  no second session-id derivation, and no reducer** (that stays in
  [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs), per "Not in scope").
- [we:scripts/lib/__tests__/judge-panel.test.mjs](../scripts/lib/__tests__/judge-panel.test.mjs) — 61 unit tests,
  **no process spawned**. Every refusal is asserted with an injected `spawnFn` counter proving zero invocations,
  not merely with `rejects.toThrow`; the unknown-depth refusal has its own twelve-case table separate from the
  over-cap one; sibling distinctness is pinned three independently-failing ways (the returned `sessionId`s, the
  `--session-id` tokens that actually reached each child's argv, and the pure `panelSeats`/`deriveSessionId`
  seam), including the two-seats-on-one-lens case and the whole 8-seat roster `panelRigorForCareLevel('high')`
  really produces.
- [we:scripts/lib/__tests__/judge-panel.integration.test.mjs](../scripts/lib/__tests__/judge-panel.integration.test.mjs)
  — the live two-juror canary, **opt-in behind its own flag** (`WE_JUDGE_PANEL_LIVE=1`) rather than riding
  `WE_JUDGE_SPAWN_LIVE`, because turning the single-spawn canary on must not silently multiply the bill. **Not
  run for this slice** — no live panel was billed.

**Two decisions worth naming.** (1) Seats are seeded on `lens#slot`, the same identity string `materializeRoster`
already mints in [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs), so a panel's seats line up with a
`roster-picked` ledger event without a translation table — and so the two seats a `jurorsPerLens: 2` lens earns
are two actors rather than one derived twice. (2) The argv denylist runs **pre-flight over every seat**, so a
`--bare` juror throws the whole call with zero spawns instead of failing one seat while its siblings bill; that
is strictly stronger than the single-spawn behaviour, and it means `judgeSpawn`'s own per-child guard is now
belt-and-braces from this caller. The module header says so rather than implying the inner call is tested here.

**#3056 is not widened.** Every option this module forwards (`mandate`, `shape`, `model`, `effort`, `budget`) was
already a `judgeSpawn` argv input. Its own new inputs reach argv through exactly one funnel or not at all:
`runId`/`lens`/`slot`/`id` go only into `deriveSessionId`, which SHA-256s them into a canonical UUID, and
`depth`/`maxDepth`/`maxTotalBudgetUsd` never touch argv in any form. A test pins that with flag-shaped lens and
run ids.

## Not in scope

- **Reducing the verdicts.** `derivePanelVerdict` / `buildPanelFindings` / diversity-selection already live in
  [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs). This slice returns the jurors' results; it does
  not re-derive the reduction, and adding a second reducer here would be the defect the `AGGREGATION` constant
  exists to prevent.
- **Retiring the subagent fan-out** in
  [we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js). Migrating that
  harness onto this one is a separate change with its own review; naming the gap is not fixing it.
- **Declaring this as an engine operation.** The engine and its four step kinds are #3032, and `review-pr` is the
  first operation onto it (#3035). *Corrected while building this slice: both had already landed by the time it
  started — #3032 resolved 2026-08-09 to [we:scripts/operations/](../scripts/operations/), and #3035 resolved the
  same day via PR #1141. The scope is unchanged: this is still the fan-out layer a `judge` step will call, and
  nothing here registers an operation or touches `scripts/operations/`.* Which is why it is **blocked on
  nothing** — #3028 has landed and `jury-core` is already pure.
- The hosted-tier backend, per #3028 and statute clause 4.

## Neighbours

- **#3028** (resolved) — the single spawn this fans out. Does not fan out.
- **#3032** (resolved 2026-08-09, → [we:scripts/operations/](../scripts/operations/)) — the registry + run
  engine. The consumer, not the producer; its `judge` step declares a request and never performs one
  ([we:scripts/operations/step-kinds.mjs](../scripts/operations/step-kinds.mjs)), which is exactly the seam this
  module sits behind. Nothing here is wired into it — that is a separate change with its own review.
- **#3035** (resolved 2026-08-09, PR #1141) — `review-pr`, the first operation onto that engine.
- **#2649** (resolved) / **#2658** (resolved) — the subject-agnostic jury engine and the thin `/jury` shell. They
  own the roster, the dial and the reduction; #2658's fan-out is the subagent one whose *mechanism* this
  replaces, not its *method*.
- **#2948** (open epic) — cheap review. Orthogonal and complementary: it cuts how many seats a change earns; this
  cuts nothing and only decides how the earned seats are spawned. Its aggregate-cost concern is constraint 2's.
- **#3048** (open decision) — names #3028 as the likely mechanism for the review-seam independence half. This
  slice is what makes that mechanism usable for a whole panel; it does **not** rule #3048's fork.
