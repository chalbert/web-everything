---
bornAs: xw2ivof
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-08-02"
tags: []
---

# Subagent-stall harness backstop — detect + auto-clear a stuck background-wait subagent (the reap/detect + regression AC #2833 deferred)

#2833 shipped only the delivery-path half of the subagent-stall fix (synchronous verify wrapper + `.lane-verify` marker + pr-land finish-guard + a PreToolUse(Bash) guard against backgrounding it). Two ACs are NOT delivered and are tracked here: (a) the harness/orchestrator DETECTING a subagent blocked on a never-advancing background wait past a threshold and REAPING (fail + reclaim its lane) or RESUMING it; (b) a regression reproducing a stalled build subagent and proving it clears automatically with its lane freed. Both lean on agent-runtime capability largely out of in-repo scope, so #2833 split them off rather than claim them.

## Current state (re-grounded, 2026-08-21) — the halves exist, the bridge does not

Since this was filed, **detection landed** and **reclamation landed**, independently. What is still missing is
the wire between them, which is the whole of (a).

- **Detection.** `assessHealth({ lanes, now, stallMs })` in `we:scripts/readiness/conveyor-state.mjs` flags a
  lane STALLED when its delivery-agent transcript's `lastActivity` is older than `DEFAULT_STALL_MS`
  (**180 s**), returning `{ lane, num, session, idleS }` per stalled lane and flipping `verdict` to `warn`. A
  lane with `lastActivity == null` is deliberately never flagged (no fabricated stalls), and an infra-blocked
  lane is routed to `degradedInfra` instead, so a stall is a *genuinely silent* lane.
- **Surfacing.** `we:scripts/conveyor/tick-core.mjs` turns each one into a `lane-stalled` note
  (`⚠ lane-N (#num) stalled Ns — the lease-reaper reclaims its lease once it passes the reaper TTL`), and
  `we:scripts/conveyor/status-board.mjs` renders `⚠ stalled: lane-N (Ns idle)`.
- **Reclamation.** `we:scripts/conveyor/lease-reaper.mjs` (`classifyReap` / `reapPlan`) frees a lane on three
  axes — `pr-merged`/`pr-closed`, `ttl-stale`, and a dormant `pid-dead` — delegating the actual release to
  `we:scripts/lane-pool.mjs` `release --force` so reserved lanes can never be nuked.

**The gap is the threshold mismatch, and it is quantified.** Detection fires at 180 s; the only axis that acts
on a silent lane is `ttl-stale`, keyed to `DEFAULT_LEASE_TTL_MINUTES` = **240 minutes**
(`we:scripts/lib/lane-lease.mjs`). So a stalled subagent is *known* stalled for up to ~4 hours before anything
reclaims it, and `we:scripts/conveyor/tick-core.mjs`'s own comment records this as deliberate ("It never auto-re-dispatches a guard on a stall (the 3-min threshold is
far below a guard's spawn-to-death TTL — the guard TTLs remain the re-dispatch backstop, un-regressed)"). That caution is right
about *re-dispatch* and wrong as a reason to leave *reclamation* four hours out.

## Design

- **Add a `stalled` reap axis to `classifyReap`,** with its own threshold (a stall-reap TTL, distinct from both
  the 180 s alarm and the 240 min lease TTL). Signals stay injected: the axis takes the lane's
  `idleS`/`lastActivity` the same way the PR axis takes `prState`, so the pure core still has no fs/clock.
  Reserved leases stay exempt on this axis like every other. **The axis must be INERT when no idle signal is
  injected** — `null`/absent means *unknown*, never *idle since epoch* — the same dormancy contract
  `pidAliveForLease` already documents for the `pid-dead` axis.
- **`classifyReap` / `reapPlan` have a SECOND consumer, and it is not the tick.** `we:scripts/lane-pool.mjs`
  imports them directly and calls `reapPlan` from `reapDeadLeasesInPool`, an acquire-time backstop that runs on
  every `lane-pool acquire`. It injects **no** idle signal and filters results to the terminal PR axes, so it is
  safe today by convention only. Either (i) prove the new axis is inert under that call site with a test in
  `we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs`, or (ii) make the filter explicit there. Reaping a
  lane mid-legitimate-build at acquire time evicts a live agent — the exact hazard that file's comments guard
  against — so this consumer cannot be left to implementation-time convention.
- **Size the stall-reap TTL against evidence, not intuition.** The card does not pick a number on purpose: the
  build must measure real delivery-agent quiet periods first (the same `lastActivity` transcript signal
  `assessHealth` already reads, sampled over a window of real lanes) and state the observed distribution
  alongside the chosen threshold. An unmeasured threshold is how a legitimately slow build gets reaped.
- **Feed it from the tick.** `we:scripts/conveyor/tick-core.mjs` already holds `health.stalled` when it builds the `lane-stalled`
  note; pass that set into the per-tick reaper invocation as the axis signal, rather than giving the reaper its
  own transcript walk (a second walk is a second definition of "stalled").
- **Reap, do not resume.** "Resume" needs a harness capability this repo does not have (delivering a signal
  into a live agent); reap-and-reclaim is fully in-repo and is what the conveyor needs to keep dispatching.
  State that explicitly rather than leaving both options open — the item's own header says the resume half
  "leans on agent-runtime capability largely out of in-repo scope".
- **Escalate, do not silently retry.** A reaped stall must leave an artefact (a note the board renders, on the
  `we:scripts/conveyor/status-board.mjs` path already carrying `⚠ stalled`), so a recurring stall is visible
  rather than absorbed — the stop-the-line rule at
  [#orchestrator-stops-line-never-absorbs](docs/agent/platform-decisions.md#orchestrator-stops-line-never-absorbs).

## Done when

- `npx vitest run lease-reaper` fails before and passes after on new cases for the `stalled` axis in
  `we:scripts/conveyor/__tests__/lease-reaper.test.mjs`: a non-reserved lease whose injected idle time exceeds
  the stall-reap threshold classifies `stalled`; one below it does not; a **reserved** lease never does; and an
  infra-blocked lane never does (its cause is known and it is auto-retrying).
- `npx vitest run tick-core` proves the bridge, not just the axis: a tick whose `assessHealth` reports a lane
  stalled past the threshold produces a reap plan naming that lane, and one whose lane is stalled only past the
  180 s *alarm* threshold produces the `lane-stalled` note but **no** reap — the two thresholds stay distinct.
- The end-to-end regression #2833 deferred: a fixture reproducing a stalled build subagent (a lease plus a
  transcript with a stale `lastActivity`) runs through the reaper and ends with the lane acquirable — asserted
  via `isLaneAcquirable` / `chooseFreeLane` from `we:scripts/lib/lane-lease.mjs`, so "its lane is freed" is a
  checked postcondition rather than a claim.
- No lane is reaped by a code path that reads the transcript twice: `we:scripts/conveyor/lease-reaper.mjs` gains
  **no** transcript walk of its own — the stall signal is injected. Cheap check: the reaper's imports still name
  no transcript/activity module.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — Re-verified against the live repo: we:scripts/readiness/conveyor-state.mjs's DEFAULT_STALL_MS is 180000 (180s), we:scripts/lib/lane-lease.mjs's DEFAULT_LEASE_TTL_MINUTES is 240, we:scripts/conveyor/tick-core.mjs's stall/re-dispatch comment exists near line 101, the we:docs/agent/platform-decisions.md#orchestrator-stops-line-never-absorbs anchor exists, and no `stalled` axis currently exists in we:scripts/conveyor/lease-reaper.mjs's classifyReap — all as the card claims.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/lane-pool.mjs also imports and calls classifyReap/reapPlan (its acquire-native reapDeadLeasesInPool, ~we:scripts/lane-pool.mjs:835-891) — a second, non-obvious caller the card's design section never names or checks against. The current code happens to be safe by convention (that file's signalsFor injects no idle signal, and it already filters reap results to only act on pr-merged/pr-closed reasons), but the card did not do the two-way consumer search 3103 calls for, so this safety is accidental rather than verified.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card specifies a we:scripts/conveyor/__tests__/tick-core.test.mjs round-trip test proving the health.stalled -> reap-plan bridge specifically (stalled-past-threshold produces a reap plan; stalled-only-past-the-180s-alarm does not), which is exactly the seam test 3103's interface strategy calls for.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — The new stall-reap TTL's actual value is left completely unmeasured ('long enough that a legitimately slow build is not reaped, far short of 240 min') with no cited data on real/observed build durations (e.g. via DEFAULT_BUILD_TTL_TICKS or historical build timing) to size it — an implementer could pick an arbitrary number with no evidence backing it.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when requires red-before/green-after tests for each new classifyReap case plus a structural check ('the reaper's imports still name no transcript/activity module'), directly guarding against a no-op axis or a reintroduced second transcript walk.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Design explicitly requires a reaped stall to leave an artefact via the existing we:scripts/conveyor/status-board.mjs `⚠ stalled` note path rather than silently clearing, so a recurring stall stays visible instead of being absorbed.

**Corrections applied by this review:**

- The card quotes we:scripts/conveyor/tick-core.mjs's stall/re-dispatch comment as 'the 3-min threshold is far shorter than a guard's spawn-to-death TTL' but the actual text reads 'far below a guard's spawn-to-death TTL' — a paraphrase presented in quotation marks rather than a verbatim quote (trivial, no substantive effect).

The card's re-grounding is factually accurate against the live repo (thresholds, comments, doc anchor, and the absence of a `stalled` axis all check out), and its design correctly reuses the pure-core/IO-shell and signal-injection patterns already established, but it omits a real second consumer of `classifyReap`/`reapPlan` and leaves the new threshold's actual value unmeasured.

**Findings applied after this review** (both accepted): the design now names `we:scripts/lane-pool.mjs`'s `reapDeadLeasesInPool` as the second consumer of `classifyReap`/`reapPlan` and requires the new axis to be provably inert there; and the stall-reap TTL is now explicitly left unpicked, with a measurement step, rather than hand-waved as "far short of 240 min". The quote from `we:scripts/conveyor/tick-core.mjs` was also corrected to its verbatim wording.

_Recorded through the declared `review-prep` operation._
