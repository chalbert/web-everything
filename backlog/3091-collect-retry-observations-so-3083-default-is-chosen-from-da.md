---
bornAs: xou38cr
kind: story
size: 2
parent: "3029"
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, retry, observability]
scope:
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/wake.mjs
  - we:scripts/operations/cli-adapter.mjs
  - we:scripts/operations/http-adapter.mjs
---

# Collect retry observations so #3083's default is chosen from data

[#3083] has to say how many times a failed effect may be re-attempted automatically. **There is no basis for
that number.** Nothing dispatches yet, so the corpus holds zero retry observations, and the existing ad-hoc
choices elsewhere in the repo record what someone picked rather than what worked.

Ruled by the operator: collect data, choose later. This is the collecting.

## Why it has to land before dispatches start

The data is unrecoverable in arrears. Every retry that happens before the counter exists is an observation
that never existed. That is the entire argument for building it now rather than alongside #3083.

## The trap it is built around

Two retries look identical in a naive count and mean opposite things:

| who re-entered | a success on attempt 2 means | what a budget would have done |
| --- | --- | --- |
| a timer | the failure was flaky | caught it — this is the population a default is FOR |
| a human | someone fixed the cause | nothing; no budget helps |

Pooling them yields a default that is too high, and too high is the expensive direction — the measured failure
mode was eleven dispatches over ten ticks at exit 0. One field, `attemptedBy`, separates them, and it is
unrecoverable if omitted.

## What it must refuse to do

> **This section describes the READER, which is now [#3083]'s, not this item's.** Kept because it is the
> requirement the split hands over — nothing in this repo refuses anything about retry today, because
> nothing reads the counters at all.

Answer before it can. A thousand human observations and no automatic ones is not evidence, and must not read
as any. Same discipline as `we:scripts/lib/gate-health.mjs`, which refuses to conclude on a separated band it
cannot see.

## Watch for

- The run record is described as transient and session-local; **nothing deletes it**, so the store is already
  a durable corpus and no second log is needed. That prose is wider than the code — a claim to correct rather
  than to design around.
- `.operations/` is gitignored. The corpus is per-machine, which is fine for choosing a default and is not a
  shared dataset.
- An IN-FLIGHT entry has not settled. Counting it as a failure at attempt N reads a slow success as a
  permanent one — the same mistake the waker made three times over `overdue`.

## Done when

- [x] Every attempt is counted, with who made it, on a record that survives the process.
- [x] Each entry point states its own population, and one that cannot identify its caller says so.
- [~] ~~A reader answers "which attempt did eventual successes land on", per population.~~
- [~] ~~It refuses to suggest a budget when the automatic population is too small.~~

**The last two boxes moved to [#3083] and are not owed here.** This item is the collector only.

## How it resolved — the collector, after the round-5 split

The item shipped in two halves and only one of them landed here. PR #1195's fifth review recommended
splitting it and that was accepted: **the collector lands, the reader is re-filed against [#3083].**

**Why the split.** Every blocking finding from round 2 onward lived in the reader
(`we:scripts/operations/retry-health.mjs`), and all four were one class — a statistic or a statement about
one population applied to another population's decision. The reader is a pure function with no production
caller that cannot even be run, and it serves a decision nobody has ruled; it is fully recoverable and can
be written once, correctly, against a real corpus on the day the number is actually chosen. The collector is
the opposite: an attempt not recorded at the moment it happens is gone for good. Bouncing the whole PR to
fix a module with no caller held the irreversible half hostage to the reversible one.

### What landed

`attempts`, `autoAttempts`, `humanAttempts`, `unknownAttempts`, `lastAttemptAt` and `lastAttemptBy` are
stamped on the effect entry at the same moment the attempt is marked — the one write a crash cannot skip.

**Each population is counted separately, rather than one count plus a last-writer label.** A cumulative
count with an overwritten label filed a mixed entry wholly into whichever population went last and carried
the other's attempts with it. Both directions corrupt the corpus, so a mixed entry now contributes honestly
to both.

**There is no safe default for who attempted.** An earlier cut defaulted to `human`, justified by "every
caller that existed before the waker was one" — a sentence that was false when written, because `driveRun`
is also reached from the HTTP adapter, where the caller is a network client the adapter cannot identify.
`unknown` is the honest third value: excluded from BOTH populations rather than padding either. A thin
dataset is recoverable; a mislabelled one is not. The waker passes `auto`, the CLI passes `human`, the HTTP
adapter passes `unknown`, and anything that states nothing is `unknown`.

### The two closures this landing added

Both were reported in earlier rounds, both live in the half that cannot be rebuilt, and neither was in the
reader:

- **`createEffectExecutor.apply` was discarding `attemptedBy`.** Its options destructure omitted the field,
  so a caller's stated population was accepted and silently recorded as `unknown`. It now forwards, and a
  named test drives the closure with each value. **Correction (round 6):** an earlier version of this
  paragraph called that closure *"the one path production actually takes — adapters hold the bound closure,
  not the raw function"*. That is **false**. `createEffectExecutor` has no production caller at all: the
  CLI, the HTTP adapter and the waker each call `applyPendingEffects` directly. No population was ever
  eaten in production, because production never reaches the closure. The fix is still right — it guards a
  façade the module offers to adapters — but the severity claim was this item's own recurring defect,
  a statement about one population (test callers) used to describe another (production callers).
- **`driveRun`'s `unknown` default had no test.** Flipping it back to `human` left all 387 operations tests
  green: the nearby HTTP test pins that adapter's explicit argument, not the parameter default beneath it.
  A test now drives the real `driveRun` over an effect-only declaration with no `attemptedBy` at all.

### And the closure the two above missed

- **The CLI's `attemptedBy: 'human'` was the undefended one** (round 6, blocking). Changing that one literal
  to `'auto'` left the FULL suite green — 7478 tests — with every attempt a person makes at a terminal
  filed into the automatic population. That is the direction that matters: a human retry succeeding usually
  means someone fixed the cause, so folding those in makes automatic retry look like it works and drives
  [#3083]'s eventual budget up. The waker's identical argument had a test and the HTTP adapter's had a test;
  the only source of `human` data had none. The test that looked like it covered this hand-passed `'human'`
  to `applyPendingEffects` and never imported the CLI — the recurring defect appearing in a test name. It is
  renamed for what it drives, and a new test runs the real `runOperationCli` end to end.

### The invariant the reader will need

`attempts === autoAttempts + humanAttempts + unknownAttempts` for any entry created at or after this
change, now stated in the code and pinned by a test. It can only be violated by a record from an
intermediate build of this branch, which wrote a cumulative `attempts` and a last-writer `attemptedBy` with
no per-population fields; `.operations/` is gitignored, so those survive locally across a rebase. That
superseded `attemptedBy` key is now cleared on write, so no entry answers "who attempted this" twice.

### Still true, and stated at the write site

Nothing reads any of these to decide anything. They are instrumentation, and [#3083] is unruled — the
separation is deliberate, so the next reader does not mistake a counter for a policy.

No second store was needed. The run record is described as transient and session-local, but nothing deletes
it, so the store is already the corpus. That prose was wider than its code; corrected rather than designed
around. `.operations/` is gitignored, so the corpus is per-machine — fine for choosing a default, not a
shared dataset.
