---
bornAs: xxogfx8
kind: story
size: 3
parent: "3029"
status: open
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/run-record.mjs", "we:scripts/operations/run-store.mjs"]
dateOpened: "2026-08-27"
tags: [operations, telemetry, conveyor, delivery]
---

# Stamp step timings so the loop can say where its wall-clock went

Nothing records how long any step of the delivery loop takes, so every "why was that slow?" is answered by
hand from logs that are then thrown away. Each operation step already suspends into the io shell and resumes
— the one seam where a clock is legal — so stamping a start and a finish there yields agent, test, gate and
dispatch timings from a single change. The run record is already the durable, per-run store; this adds a
`stepTimings` row per step and nothing else.

## What is true today, read not recalled

- **Run records carry a `telemetry` array, and it is empty on every run.** Across the 83 records in
  `.operations/runs/` on 2026-08-27, `telemetry` is `[]` for all 83.
- **That array is NOT a general timing slot, and must not be repurposed.** `withTelemetry`
  (`we:scripts/operations/engine.mjs`) *throws* on a non-`judge` resume that carries telemetry — *"a
  `<kind>` resume carries no juror telemetry (only a `judge` step spawns one). Refusing the resume … rather
  than recording a cost nothing incurred."* Its whitelist (`TELEMETRY_NUMBERS`,
  `we:scripts/operations/run-record.mjs:108`) is juror cost: `costUsd`, `durationMs`, `wallMs`, `numTurns`,
  `loadedContextTokens`. Widening it would erase the distinction between *what a juror spawn cost* and *how
  long a step took*, which are different questions with different consumers.
- **The engine cannot stamp a time itself.** `we:scripts/operations/engine.mjs:45` — *"PURE. No fs, no
  clock, no process, no randomness, no network."* Any clock read belongs in the io shell / `cli-adapter`,
  which is where the impure work already happens (`driveRun`'s `awaiting-effect` branch calls
  `applyPendingEffects`, `we:scripts/operations/cli-adapter.mjs:597`).
- **Effects record a start and never a finish.** `we:scripts/operations/run-record.mjs:219` validates
  `startedAt` on an in-flight effect; nothing writes a corresponding finish, so even a dispatch has no
  duration.
- **The one existing measurement is narrow and purpose-built.** `we:scripts/measure-judge-spawn.mjs` measures
  judge spawns only. It is not a channel anything else can use.

## What this is for

A day of running the loop on 2026-08-26/27 produced these questions, none answerable from stored data:

- Five `verify-lane` runs dominated the whole afternoon — roughly an hour each, against maybe 15 minutes of
  agent time for the 25 items they were gating. The ratio was discovered by watching a terminal.
- A lost review verdict stranded PRs until a retry was added; the retry waits **30 minutes** before firing.
  Whether 30 is the right number is unknowable without a distribution of how long a review actually takes.
- Agents were over-dispatched to 11 concurrent, load 6.4, six timeouts. Nothing recorded the timeouts.

## Done when

1. **Executable** — a test asserts that a completed run record carries, for each step that executed, a row
   with the step name, its index, and a non-negative elapsed duration; and that a run which halted mid-step
   records the started step with **no** finish rather than a fabricated one. It must fail against `main`.
2. **`stepTimings` is its own field**, distinct from `telemetry`, with its own normalizer in
   `we:scripts/operations/run-record.mjs` — same whitelisting discipline, so a caller cannot stamp arbitrary
   keys onto a record.
3. **The clock is injected, never read inside the engine.** The engine's purity contract at
   `we:scripts/operations/engine.mjs:45` is unchanged by this item; a test pins that a run advanced with a
   stubbed clock produces deterministic timings.
4. **An in-flight effect gets a finish stamp when it resolves.** `we:scripts/operations/wake.mjs`'s resolve
   path is where a dispatch's end becomes known; a dispatch that ran for 40 minutes must read as 40 minutes,
   not as absent.
5. **One reader exists** — a script that prints, across stored runs, total wall-clock grouped by step name,
   so the data has a consumer on the day it lands. Per `#19` (verify a mechanism has a consumer), a timing
   store nothing reads is not done.

## Deliberately NOT in scope

- **No sampling, aggregation or dashboard.** Raw per-step rows only; anything that summarises can be built
  once there is data to summarise.
- **Not `verify-lane`'s own internals.** This item measures how long the step took, not which test inside it
  was slow. If the answer turns out to be "the lane-pool suites", that is a separate card.
- **Not cost.** `telemetry` already owns juror cost and keeps it.

## Lineage

Filed 2026-08-27 after a session where every bottleneck — the verify gate, the retry interval, the dispatch
timeouts — was diagnosed by hand and left no record. Sits under `#3029` (the operations engine) because the
step seam it instruments is that epic's, not the conveyor's.
