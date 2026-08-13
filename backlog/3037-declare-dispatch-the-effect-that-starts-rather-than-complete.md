---
bornAs: xynt0jj
kind: story
size: 5
parent: "3029"
status: resolved
blockedBy: ["3032", "3030"]
dateOpened: "2026-08-08"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
scope:
  - we:scripts/operations/
  - we:scripts/conveyor/
scopeRationale: "Adds one declaration file and reads the existing conveyor tick core; the declaration filename does not exist yet."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Declare dispatch — the effect that starts rather than completes

The real test of the four-kind vocabulary. Dispatching a lane reads the queue, the leases and the free slots —
all `compute`, all already scripted — and then its effect **launches an agent that outlives the run by an hour**.

Nothing in `compute` / `judge` / `confirm` / `effect` describes an effect that *begins* rather than *finishes*.
Every other declared operation's effects are applied and done; this one hands off.

## Gated on the spike

`blockedBy` [#3030] deliberately. That two-point spike establishes whether the command-line background-agent
lifecycle already owns start / observe / stop, and its answer changes what gets built here:

- **Lifecycle covers it** → the effect is "start a background agent, record the handle", the run completes
  normally, and the engine never models a long-running child. No new kind.
- **Covers start only** → a thin adapter supplies observation and stop. Still no new kind.
- **Does not fit** → the vocabulary has a genuine hole, and per
  [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
  that is a signal the *model* is wrong. Extending to a fifth kind would then be its own decision, argued in the
  open, not a quiet addition inside this slice.

**Do not start this slice before the spike reports.** Building it blind is how a fifth kind gets added by
accident.

## What it must not disturb

Dispatch is the conveyor's own machinery, and the mechanical tick core already exists and is tested. This slice
declares the operation **over** that core; it does not re-derive dispatch policy, and it puts no model in the
per-lane loop — [#conveyor-orchestration-mechanics-not-per-lane-agent](../docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent)
is untouched. The singleton runner lock stays exactly where it is.

## Progress

**Delivered — answer 2, and no fifth kind.** The spike (#3030) reported before this started, and its answer held:
`compute` / `judge` / `confirm` / `effect` already describe an effect that begins rather than finishes, because
three kinds suspend and `advance` is idempotent with no resume. Nothing here extends the vocabulary. The two
mechanisms the spike said were missing had already shipped (`dispatch: true` + `inFlight` in #3073, the observer
contract + waker in #3084), so this slice is three ordinary steps over machinery that existed.

- **we:scripts/operations/dispatch-lane.mjs** — the declaration. `read` (shape one tick read + FILL the delivery
  brief) → `plan` (the verdict: dispatching, or the hold reason) → `dispatch` (ONE `dispatch: true`,
  `idempotent: false` effect, or ZERO when the core said no). No `confirm` and no `judge`: a human or a model in
  the per-lane loop is what `#conveyor-orchestration-mechanics-not-per-lane-agent` forbids. Its whole static
  import graph has zero `node:` specifiers, asserted.
- **we:scripts/operations/dispatch-lane-io.mjs** — the io shell. ONE call to `we:scripts/conveyor/tick-core.mjs`
  with the caller's bookkeeping on STDIN (the same CLI the runner drives, not a re-composition of it), item
  identity through the tick's own `normNum`, item scope from the canonical backlog loader, the brief read as
  text. Plus the SINK that starts the agent and the OBSERVER that polls it.
- **The holds are structural, not promised.** `lane` is not an input field — a caller dispatches the lane the
  core assigned or nothing. A `num` the core SUPPRESSED comes back as a non-dispatch carrying the guard's own
  reason. No guard rule, TTL or lease check is re-derived here.
- **The handle is MINTED, not discovered.** `claude --session-id <uuid>` lets the dispatcher choose the id
  before the agent exists, so there is no before/after diff of `claude agents --json` and no race with any other
  session starting in the same instant. The spike had not found this flag; it is the one place its account was
  narrower than the CLI.
- **Registered** in `we:scripts/operations/run.mjs`'s `OPERATIONS` (the derived `--help` and the HTTP route come
  free), and its observer registered in `we:scripts/operations/wake.mjs`, which had been holding an empty table
  for the first thing that dispatched.
- **Verified against a real queue**: the reader run against live `tick-core` output resolved this item's real
  spec path, scope and status line, and the whole operation ran end to end through the derived CLI (correctly
  answering "not cleared for build" — #3037 was claimed, so it is not in the cleared queue). The DISPATCHING
  branch was then run against the real 36KB brief and this item's real frontmatter, producing a fully-filled
  prompt and the exact `claude --bg --session-id …` argv — everything up to, and not including, starting the
  process.
- **Proven across a process boundary** — `we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs`:
  a second `node` handed only a run id reads the handle, the lane and the brief off disk and observes with the
  real observer.

**Fixed in the pre-PR review round**, recorded because two of them were the whole feature:

- **The brief fill refused every real dispatch.** The first cut threw on any leftover `{{TOKEN}}`, and the real
  brief's own prose carries two (`{{PLACEHOLDERS}}`, `{{LIKE_THIS}}`, both documentation about the fill
  convention). Forty green tests missed it because every one used a synthetic template. Unknown tokens are now
  REPORTED, never fatal, and a test fills the brief off disk — the check was also mis-weighted, since a stray
  token costs one confusing line and a false refusal costs the whole dispatch.
- **The bookkeeping file could dial the holds it was supposed to inherit.** `tick-core`'s shell reads `config`
  (the TTLs, the retry caps) and `signals.returnedBuildNums` (which retires live build guards) off the same
  STDIN, so piping the caller's file through verbatim let it set `buildTtlTicks: 0` and clear a lane that
  already had an agent on it. Only `bookkeeping` is forwarded now; the drops are reported.
- **`nextState` over-claimed.** `planTick` records a guard per PLANNED spawn; this operation starts ONE. Carried
  forward, it would have held a sibling's lane for a whole TTL against a dispatch that never happened. Split
  into `dispatchedGuard` (what this earned) and `tickNextState` (named for what it is).
- Also: a value allowlist on the fill (`SCOPE` is pasted UNQUOTED into a shell command the agent runs), a
  refusal to dispatch from inside a lane clone, timeouts on both subprocess calls, one `claude agents` read per
  waker pass rather than one per entry, and `WE_DISPATCH_AGENT_ARGS` so the permission/model knob is reachable
  by an operator rather than only by a test.

**Fixed after the independent review of PR #1211** — two blockers and four more, each with a named test that
reddens when the fixed line is broken (every mutation re-run and recorded):

- **BLOCKER (F1): a completed dispatch permanently locked its item out of ever dispatching again.** Three
  shipped decisions composed into it — the observer can never answer `succeeded`, `unresolved` writes nothing so
  the entry stays `in-flight` forever, and the double-dispatch guard refused any item with ANY in-flight record,
  while run records are never pruned. The operation was single-use per item, so the conveyor's normal loop
  (dispatch → PR → review bounces → re-dispatch) could not run through it at all. Two fixes, because the review
  found both halves: the guard now AGES OUT (`dispatchStillHolds` — a record past its own `expectedBy` plus a
  30-minute margin is by construction outside the spawn→claim window the guard exists for), and there is now a
  CLI way out — the waker's own `--resolve=<runId> --key=<effectKey> --status=applied|failed`
  (`we:scripts/operations/wake.mjs`), the operator surface `resolveInFlight` never had. Aged-out records are
  reported on the verdict, never silently skipped.
- **BLOCKER (F2): the waker's observer registration was executed by no test.** The `IS_CLI` block in
  `we:scripts/operations/wake.mjs` is the only place the observer is wired in production, and replacing
  `createDispatchObservers()` with `{}` left all 163 test files green — the same defect class as a declaration
  nothing can resolve. `we:scripts/operations/__tests__/wake-cli.test.mjs` now drives the real CLI in a child
  process with only `claude` stubbed (a two-line `sh` script on a `PATH` that holds no real `claude`), and
  asserts what it observed with.
- **(F3/F7) the brief-fill fix was over-broad.** Its scan matched only `{{EXACT_UPPER}}`, so a near-miss
  spelling — `{{ SESSION_SLUG }}`, `{{item_num}}`, `{{ITEM-NUM}}` — was neither substituted NOR reported, and
  reached the dispatched agent verbatim (a lane leased under a literal `{{ SESSION_SLUG }}` is a lease
  `pr-watch --release-session` never releases). Detection is now wider than substitution: a token that names one
  of the five in any spelling is REFUSED and the refusal names which one; a token that names none of them is
  still only reported, so the real brief's own prose still dispatches. Tested as the PROPERTY over a table of
  variants and over the real file on disk, not as the one input that failed.
- **(F4) a claim wider than the code.** `inFlightDispatchesFor`'s docblock said the count of unreadable run
  records "rides the result so a caller can see the guard was partial"; it was read and dropped. It now reaches
  the verdict as `unreadableRunRecords`, on every exit.
- **(F5/F6) three unguarded timeouts and the `--all` refusal.** All four claims lived inside default parameters
  every test overrode, so all four could be deleted with the suite green. The defaults are named exports now
  (`defaultRunNode`, `defaultSpawnAgent`, `defaultListAgents`) with the options asserted — and, because mutating
  that fix showed the same hole one level up, the production callers are asserted to go THROUGH them too.
- **(F9) prose.** The lane-clone refusal matches the checkout's BASENAME against `lane-<digits>`; it does not
  fire "exactly when invoked from a lane clone", and the docblock now says what it checks. Its retry behaviour
  (a permanent condition re-attempted with no cap) is recorded rather than left to look considered.

**Deliberately not delivered**, each filed rather than half-done:

- The observer answers `running` or `unresolved` and never `succeeded`. `claude agents --json` reports LIVENESS,
  not outcome, and `--all` showed no terminal record for a completed background session, so "gone" collapses
  *finished cleanly* and *died*. A real completion signal is #x9ylkp7. The standing cost is real and now
  bounded: every completed dispatch still needs a person to close its entry out, but it no longer wedges the
  item (see F1 above).
- The conveyor still dispatches through the main-session bridge's `Agent` spawn; this operation is a second,
  declared path rather than the only one. Routing the bridge through it is #xaibmeu.
- **Stop is still unprovided** (the spike's follow-up 3) and retry is still unowned (#3083). Neither is touched.

## Acceptance

**Rewritten after the independent review of PR #1211, which ruled the original first clause DEFERRED rather
than satisfied.** The old wording read as one clause and was scored as met; two of its four sub-clauses had
never executed. It is split here so the board cannot say met about a half nothing ran, and the unmet half is
REASSIGNED by name rather than footnoted.

**This slice (#3037) — met:**

1. The operation is DECLARED over the tick core, and the holds are structural: `lane` is not an input field, so
   a caller dispatches the lane `planTick` assigned or nothing, and a `num` the core suppressed comes back as a
   non-dispatch carrying the guard's own reason. Verified independently at the engine boundary (an unknown
   input field is refused), so it covers the CLI, the HTTP adapter and a hand-written input alike.
2. The launched agent's handle is recorded on the run so the conveyor can find it after a restart — proven
   across a real process boundary by `we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs`.
3. Its whole dispatch path was run against a real queue read and this item's real frontmatter, up to and
   including the exact `claude --bg --session-id …` argv, and stopped there.
4. The spike did not return answer 3, so no written case for a missing kind is owed: `compute` / `judge` /
   `confirm` / `effect` describe an effect that begins, and nothing here extends the vocabulary.

**REASSIGNED to #xaibmeu — a lane IS dispatched, and the scope-lease arbitration is exercised:**

> *"a lane IS dispatched through the declared operation … the same scope-lease arbitration … verified against a
> real queue."*

No `claude` process was ever started. `planTick` computes an *assignment*; the LEASE is taken later by the
dispatched agent running `lane-pool acquire` from the brief, and that code path has not executed. Nor has
`dispatchedGuard` been carried forward by any caller — it has no consumer in the repo yet. **#xaibmeu completes
this clause**: it routes the conveyor's build dispatch through this operation, which is the first live dispatch,
and is also where a background session's permission mode gets settled. #3037 is resolved on the declaration and
the handle; it is not a claim that a lane has been dispatched.

## Lessons

- **It should have been sliced at the sink/observer seam** (review F10). 1,948 lines in one review unit, with a
  clean seam: the declaration + `readTick` + `fillBrief` + registration on one side (every mutation against it
  reddened), the sink + observer + `buildAgentArgv` + the waker registration on the other (every surviving
  mutant and every unproven-live claim). Slicing there would have made "run it once" a plausible acceptance for
  the small half — which is exactly the thing that ended up deferred. Not re-sliced now: the PR is already in
  review and churning it costs more than it buys. Recorded for the next operation of this shape.
- **A test written to the input that failed is not a test of the property** (review F3/F7). Two round-1 fixes
  shipped with regression tests shaped to the specific failing input; both could be deleted with the suite
  green. The fix tests now assert the property (no placeholder of ours reaches an agent in ANY spelling, and
  the refusal names which one) over a table of variants and over the real file on disk.
- **A default reached only through a default parameter is executed by no test.** Every timeout, and the
  observer's deliberate absence of `--all`, lived inside default parameters that every test overrode. Mutating
  the FIX found the same defect one level up — a tested `defaultRunNode` that the reader had stopped calling
  would also have gone unnoticed — so the production wiring is asserted too, not just the default's body.
