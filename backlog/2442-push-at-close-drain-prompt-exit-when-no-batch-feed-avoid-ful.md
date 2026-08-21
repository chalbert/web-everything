---
bornAs: xiojrm2
kind: story
size: 3
parent: "2387"
status: open
priority: low
dateOpened: "2026-07-11"
tags: []
scope:
  - we:scripts/drain-push-at-close.mjs
  - we:scripts/__tests__/drain-push-at-close.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:skills-src/drain/SKILL.md
  - we:skills-src/batch-backlog-items/SKILL.md
---

# Push-at-close drain: prompt exit when no batch feed (avoid full max-runtime idle poll)

> **Priority note (2026-07-11, Plateau Loop triage).** Efficiency polish of session-choreography a
> resident coordinator replaces wholesale ([#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/)
> — a long-lived drain owner has no detached push-at-close watch to time-box). Correctness is
> unaffected today (bounded by `--max-runtime-min`), so settled-but-low-value-now: pickable, out
> of auto-select.

A serial /batch usually has NO dev active-progress-watch running, so the push-at-close drain's `--until-batches-idle` is INERT (#2330) and it idle-polls until the `--max-runtime-min` cap (default 60m), holding the lease the whole time. Correct + bounded, but wasteful. Make the no-feed case exit promptly after landing the queued chain WITHOUT reintroducing the mid-batch-exit bug that --until-batches-idle fixes: either the launcher writes a durable batch-feed marking THIS batch closed (so the watch's batch-idle exit fires immediately), or the drain detects feed-absence and falls back to a bounded --max-idle only when no feed is present. Feed present (concurrent batch) must still keep collecting.

## Design

**The three moving parts, all already in place.**

1. `we:scripts/drain-push-at-close.mjs` — the launcher. Its pure `buildDrainArgs()` always emits
   `['--label=…', '--watch', '--until-batches-idle', '--hold-drain-lease', '--interval=…',
   '--max-runtime-min=…', '--batch-feed=…']`, with **no** `--max-idle`. The CLI hardcodes the feed to
   the primary checkout's `we:_site/active-progress.json`.
2. `readBatchFeed(path, …)` in `we:scripts/merge-ai-prs.mjs` — returns `{ known:false, running:[],
   reason:'feed-absent'|'feed-stale'|'feed-unreadable' }` when the signal is unsafe to trust. A `known:false`
   read deliberately leaves `batchNonRunningStreak` at 0, so it can never trigger an exit.
3. `decideBatchesIdleExit({ enabled, idlePass, considered, deferred, heldCoupleMembers,
   batchNonRunningStreak, debounce })` in the same file — the pure exit rule. With `--max-idle` unset (the
   launcher's shape), this is the **only** exit besides the `--max-runtime-min` wall-clock break, and it can
   never fire while the feed is absent. That is the inertness.

**Two candidate fixes; prefer (b).**

- **(a) launcher writes a durable "this batch is closed" marking.** Rejected as the default: the launcher runs
  at session close in the *primary* checkout, the feed is written by `we:scripts/dev/active-progress-watch.mjs`
  (only running under `npm run dev`), and a second writer to that file re-creates the two-writers-one-format
  defect. It also cannot help the case the feed is stale rather than absent.
- **(b) feed-absence ⇒ a bounded `--max-idle` fallback, decided purely.** Add an exported pure decider next to
  `decideBatchesIdleExit` — e.g. `effectiveMaxIdle({ untilBatchesIdle, maxIdle, feedKnown, fallbackMaxIdle })`
  — returning the `--max-idle` the watch should apply *this pass*. Feed **known** (a concurrent batch is
  publishing) ⇒ the caller's `--max-idle` unchanged (usually `null` ⇒ keep collecting, the #2330 behaviour that
  must not regress). Feed **not known** ⇒ a small bounded fallback (2–3 idle passes). The watch loop already
  computes `idle` and already reads the feed each pass; the change is which bound `idle >= MAX_IDLE` compares
  against, plus surfacing the degrade in the existing one-shot `batchFeedAbsentWarned` notice.

**Route the fallback exit through the SAME confirm-repoll the batch-idle exit uses.** When
`decideBatchesIdleExit` fires, the watch does not exit — it re-polls once (`sleepSync(REPOLL_SEC * 1000)` then a
second `sweepOnce()`) because the queue-empty signal rides the lagging label index (#2230), and without the
confirm the batch's final PR is dropped. The plain `idle >= MAX_IDLE` break has **no** such confirm. A bounded
fallback that reuses that bare break inherits the drop, only reachable in 60–90 s instead of 60 min. Wire the
fallback through the confirm path, or state explicitly that "rides the next drain" is accepted here the way
`we:scripts/drain-push-at-close.mjs` already accepts it for the wall-clock cap.

**Measure the fallback bound; do not guess it.** "2–3 idle passes" at the launcher's default `--interval=30`
is 60–90 s, and `we:skills-src/drain/SKILL.md` itself says batch items "take minutes". Size the bound against
real serial-batch inter-item gaps before picking a number — a bound shorter than the gap between two items is
the mid-batch-exit bug wearing a different name, feed-absent or not.

**The bug not to reintroduce.** `--until-batches-idle` exists (#2330) because a plain `--max-idle` exits
mid-batch: a lull between two items in a serial `/batch` looks idle, the drain exits, and the next item's PR is
stranded until the next drain. So the fallback must be **conditional on feed-absence only** and must re-arm the
moment a feed appears — a feed that becomes `known` mid-watch has to restore the unbounded behaviour, not stay
latched on the first absent read.

## Done when

- `npx vitest run merge-ai-prs` fails before and passes after on new cases for the pure fallback decider:
  feed-known + `maxIdle:null` ⇒ unbounded (no fallback); feed-unknown ⇒ the bounded fallback; an explicit
  caller `--max-idle` always wins over the fallback; and a feed that flips unknown→known restores unbounded.
- `npx vitest run drain-push-at-close` stays green, and `buildDrainArgs()`'s asserted argv is either unchanged
  or its change is asserted explicitly in `we:scripts/__tests__/drain-push-at-close.test.mjs` — the launcher's
  emitted flags are a contract two tests read.
- A regression pins the #2330 bug: with a **known** feed reporting a running batch, an idle pass does **not**
  exit, no matter how many consecutive idle passes accumulate. This is the mid-batch-exit defect the fallback
  must not reintroduce, and it must fail if the fallback is applied unconditionally.
- The degrade is visible, not silent: the existing feed-absent stderr notice in the watch loop names the
  bounded fallback now in force (it currently says "running unbounded until Ctrl-C"), so an operator reading
  the drain log can tell which bound applied.
- `we:skills-src/drain/SKILL.md` is in this item's `scope` and its `--until-batches-idle` paragraph currently
  asserts "an **absent/stale feed ⇒ keep watching, never a false stop**" and "the drain harmlessly runs
  unbounded". Both become **false** the moment the fallback ships. `grep -c "harmlessly runs unbounded"` over
  that file returns **0** and the paragraph describes the bounded fallback instead — otherwise the change
  satisfies every other bullet while leaving a declared-scope doc lying.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — Verified against we:scripts/merge-ai-prs.mjs (readBatchFeed ~L1639, decideBatchesIdleExit ~L1663, the watch loop ~L4130-4213) and we:scripts/drain-push-at-close.mjs (buildDrainArgs L79-85) — all match the card's citations exactly, including that no --max-idle is ever emitted by the launcher. The 'serial /batch usually has no active-progress-watch running' premise holds structurally: the feed is written only by we:scripts/dev/active-progress-watch.mjs, which the code's own comment (we:scripts/merge-ai-prs.mjs L1635-1636) says only runs under the dev watcher.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Grepped the live repo for readBatchFeed/decideBatchesIdleExit/buildDrainArgs — the only non-doc hits are we:scripts/merge-ai-prs.mjs, we:scripts/drain-push-at-close.mjs and their two declared test files. we:scripts/lane-drain.mjs has an unrelated, textually-coincidental --max-idle flag of its own (a different, legacy mechanism) and is not a consumer of the functions this card touches, so the declared 4-file scope is complete.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when's third bullet explicitly demands a regression that must FAIL if the fallback is applied unconditionally to a known/running feed — that's exactly the mutate-the-guarded-line bar, stated as a build requirement rather than left implicit.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when's fourth bullet only gates the stderr notice in we:scripts/merge-ai-prs.mjs (currently 'running unbounded until Ctrl-C', ~L4180). we:skills-src/drain/SKILL.md is in the declared scope but its own prose ('an absent/stale feed ⇒ keep watching, never a false stop' / 'the drain harmlessly runs unbounded', L126-134) is not named in Done-when, so nothing forces it to stay true once the fallback exists — see finding below.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The card never measures or justifies the '2-3 idle passes' fallback bound against real serial-batch inter-item timing, even though its own text says batch items 'take minutes' — at the default 30s interval that bound is 60-90s, well under a real item's duration. It does correctly name feed-known-vs-absent as the population boundary that decides which branch applies, and explicitly scopes the fix to the feed-absent case only, so this is a minor gap rather than a wrong boundary.

**Corrections recommended:**

- none — the preparation held up as written.

The design is well-grounded — every code citation (readBatchFeed, decideBatchesIdleExit, buildDrainArgs, the watch loop's MAX_IDLE/UNTIL_BATCHES_IDLE handling) checks out verbatim against the live repo, the chosen fix (b) is the right one given the two-writers-one-format rejection of (a), and the anti-regression bar for the #2330 mid-batch-exit bug is stated precisely; the one real gap is that the declared-scope drain skill file's stale prose isn't actually gated by the Done-when checklist.

**Findings applied after this review** (both accepted): `we:skills-src/drain/SKILL.md` — declared in this item's `scope`, and made *false* by the fallback — is now gated by its own Done-when bullet; and the design now requires the fallback exit to route through the same #2230 confirm-repoll the batch-idle exit uses, plus a measured bound rather than a guessed 2–3 passes.

_Recorded through the declared `review-prep` operation._
