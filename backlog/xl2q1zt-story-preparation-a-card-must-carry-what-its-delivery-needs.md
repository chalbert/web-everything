---
kind: epic
status: open
dateOpened: "2026-08-13"
tags: [delivery, backlog, readiness, preparation, throughput]
---

# Story preparation: a card must carry what its delivery needs

`prepare` in this repo has only ever meant *prepare a DECISION* — survey prior art, state each fork's
options, pick a bold default, stamp `preparedDate`. Nothing prepares a **story**, and the cost of that shows
up as review rounds: four recent items each burned 2–6 rounds on defects a better-written card would have
predicted. This epic makes story preparation a thing the repo does, deterministically where it can and by
judgment only where it must.

**Governed by [#2607]** (`we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment`): every
script-decidable part is a tested script that skills SHELL, never re-implement. This epic adds to the
readiness engine in `we:scripts/readiness/`; it does not start a parallel one.

## The evidence, and it is the whole argument

Four items surveyed against what their PRs actually had to touch:

| item | declared | reality | rounds |
| --- | --- | --- | --- |
| [#3090] | `size: 1`, 2 files | touched a caller that was NOT in scope; one declared file never touched | 3 |
| [#3091] | `size: 2`, 4 files | 4 call sites each had to honour one discipline independently; reviewers found them one at a time | 6 |
| [#3071] | `size: 3`, 1 file | scope was exactly right — and the work was still pointless, because nothing had measured whether the fix would unblock anything (it would not) | 2, then stood down |
| [#3084] | `size: 2`, 3 files | ~20 files, because a new status vocabulary had to reach every hand-back in the run lifecycle | 4+ |

Ranked by how often the gap preceded a long review:

1. **A statistic or status computed over one population, applied to another population's decision** — 3 of 4.
   Partially scriptable at best; this is the judgment half.
2. **The card names the file being changed and omits its existing consumers** — 3 of 4. **Fully scriptable**,
   and checkable BEFORE work starts.
3. **Declared `scope:` drifts from what was touched** — 3 of 4. Trivially scriptable, but only *after* the
   fact, so it is a measurement rather than a gate.
4. **No feasibility number before sizing** — 1 of 4, and decisive there: [#3071] was two rounds of correct
   work on the least-binding of three constraints.

## What already exists — do not rebuild it

`we:scripts/check-readiness.mjs` and `we:scripts/readiness/` already compute Tier A/B/C, `isReady`
(blockers resolved AND `status: resolved`), `batchable`, `splittable`, and `dispatchPlan` — which resolves
each item to exactly one of `blocked` → `needs-slice` → `needs-decision` → `unshaped-no-scope` →
`overlaps lane-N` → `no free lane` → `launch`. `we:scripts/readiness/scope-lease.mjs` owns `normScope` and
`coversFile`, the granularity-aware matcher every scope comparison must reuse.

`check-standards` already warns on **lock-point files** (large + named by ≥5 queued items' `scope:`), which
is a parallelism-contention signal computed from the same frontmatter.

## What nothing computes today

- whether a scope file's **consumers** are also in scope (gap 2 above);
- whether an item's scope **spans unrelated subsystems** — `scopesOverlap` compares items to each other and
  never assesses one item's internal coherence;
- whether the declared `size` is plausible against the breadth the card implies. A `size: 3` naming ten
  files and no fixture is invisible to every existing check;
- whether the paths a card names **resolve at all** — the splitting rubric requires `file:line`-citable
  paths and no gate enforces it;
- whether the work can land **incrementally**, or needs a branch because it cannot merge as it goes.

## Slices, smallest-useful first

Deliberately ordered so each lands alone and is useful the day it lands. Only the first is specified;
the rest are named so the shape is visible, and will be sliced properly when their turn comes rather than
over-specified now.

1. **The consumers check** — first slice, filed. For each file in an item's `scope:`, find every module that
   imports it and flag any importer not covered by the scope. Highest-frequency gap, fully mechanical,
   pre-work.
2. **Scope drift, measured at land** — compare declared `scope:` against the files a PR actually touched, and
   accumulate it. Turns gap 3 into data rather than an opinion.
3. **Size plausibility** — declared `size` against implied breadth (named files, consumers, subsystems
   crossed).
4. **Declare `prepare-story` as an operation** under [#3029], with the checks above as its `compute` step.
5. **The AI step**, as a DISPATCH rather than a `judge` — the console must be able to launch a preparation
   and get an immediate response, and a `judge` step blocks the HTTP reply for the juror's whole duration.
   Depends on [#3037].
6. **Design committee**, last, because it is the most speculative.

## Watch for

- **The verification dial is not per-declaration.** How much a human checks before something lands is a
  user-level setting, injected as `driveRun`'s `autoConfirm` policy — never a stop hard-coded into an
  operation. Start with "always stop" / "never stop" and grow "stop when criteria unmet" once slice 1 gives
  the criteria something to test.
- Every check here must reuse `coversFile` / `normScope`. A second scope matcher is a drift bug waiting.
- The judgment half (gap 1) is NOT scriptable and should not be faked with a regex. It belongs in slice 5.
