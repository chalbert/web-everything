---
bornAs: xvpx3bi
kind: decision
parent: "2705"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Reconcile forecast-primitive scope: #2687 (WE) vs #2718/#2732 (plateau-app:src/feature-tracker/forecast.ts) — already-ratified thresholds via #2719

#2687's own deliverable (forecast state machine, projection-window emitter, thresholds) is already the explicit scope of #2718 (S1a, plateau-app:src/feature-tracker/forecast.ts) and #2719 (DEC, resolved — ratified all four thresholds #2687 called open). #2727 (S3, chips) is blockedBy #2686+#2719 directly, bypassing #2687. Only #2732 (S4, burn-up) still cites #2687 as a blocker, but #2732's own scope treats plateau-app:src/feature-tracker/forecast.ts as an owned re-edit of the file #2718 creates — its blockedBy should likely cite #2718, not #2687. Rule: is #2687 superseded/duplicate (redirect #2732's blockedBy to #2718, resolve #2687 as superseded), or does it keep a narrower non-overlapping WE-side scope (mirroring #2686's explicit fleet-health/conveyor-tuning reuse justification)? Do not silently split scope without ruling this.

## Found while preparing #2687 to build-ready

Preparing [#2687](/backlog/2687-velocity-derived-forecast-primitive-a-labeled-projection-wit/) surfaced that
the same design session that spun it off (2026-07-26) was superseded the very next day (2026-07-27) by a
much more detailed slicing pass (`we:backlog/2705-*.md` epic + its S0–S12 children) that carved the
identical deliverable into other items, without anyone redirecting or resolving #2687 to match. Grounded
against the live repo state (not assumed):

- **`we:backlog/2718-s1a-read-model-forecast-bottleneckid-single-source-of-number.md`** (S1a, `status: open`)
  scopes `plateau-app:src/feature-tracker/forecast.ts` and its deliverable text is #2687's deliverable
  verbatim: *"Forecast vocabulary FC_TXT/FC_CLS + the projection-window emitter obeying §0 ... Threshold
  constants (stubbed; DEC re-points in one line). Threshold-boundary fixtures (R6) ... prove threshold
  CORRECTNESS."* It does not list #2687 in `blockedBy`.
- **`we:backlog/2719-dec-feature-tracker-thresholds-keyboard-model-and-forecast-p.md`** (DEC, `status:
  resolved`, ratified 2026-07-27) already answers #2687's own stated "open question" — the exact thresholds:
  `stalledAfterDays = 21`, `noisyCoVCutoff = 0.6`, `minSampleSlices = 3` (0 = no-basis, 1–2 = thin, ≥3 =
  enough), plus the forecast-projection policy (a velocity-projected window is an allowed honest forecast;
  forbidden on blocked/gated/stalled/cycle; a real date only on resolved/delivered). `codifiedIn:
  plateau-app:src/feature-tracker/read-model.ts`.
- **`we:backlog/2727-s3-velocity-panels-plus-band-forecast-chips-plus-insufficient.md`** (S3, the slice that
  actually renders the forecast chips) is `blockedBy: ["2725", "2686", "2719"]` — it depends on velocity
  (#2686) and the ratified thresholds (#2719) directly, **not** on #2687.
- **`we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md`** (S4, burn-up) is the
  one remaining item that lists `blockedBy: ["2727", "2687"]` — but its own `scope:` marks
  `plateau-app:src/feature-tracker/forecast.ts` as an **"owned re-edit"**, i.e. it expects the file to
  already exist (created by #2718/S1a), not to be produced by #2687. Its `blockedBy` citing #2687 instead
  of #2718 looks like a stale carry-over from the epic's original one-line summary
  (`we:backlog/2705-feature-tracking-screen-ratified.md:17`: *"velocity from #2686; forecast from #2687"*),
  written before the next day's slicing pass gave S1a the file.

No item claims a reuse case for #2687 outside the screen (unlike #2686, whose own card and file header
(`we:scripts/readiness/velocity-metrics.mjs:12`) explicitly justify a WE-side home as *"reusable BEYOND
the feature-tracking screen — the same core shells fleet-health readouts and conveyor tuning."* #2687
carries no equivalent claim). Handing #2687 to a builder as currently written would either duplicate
#2718's already-more-detailed scope, or force the builder to silently invent a non-overlapping split
between two same-named-file deliverables — exactly the buried-fork problem
`we:agent-memory-src/story-preparation-checklist.md` item 4 exists to prevent. #3071's lesson applies too:
a card can be scoped exactly right and still be pointless to build if nothing has measured that it is still
needed — here, the measurement shows it likely is not, as scoped.

## Forks to rule

1. **Is #2687 superseded/duplicate?** — **(a) Yes (default).** #2718 + #2719 already deliver everything
   #2687 asked for, more specifically (real file paths, ratified numbers, boundary-fixture tests). Resolve
   #2687 `status: resolved` with a `resolutionNote` pointing to #2718/#2719, and fix #2732's `blockedBy` to
   `["2727", "2718"]` (the item that actually produces the file it re-edits). (b) No — #2687 keeps a
   narrower, non-overlapping WE-side scope (e.g. a generic `we:scripts/readiness/forecast.mjs` primitive for
   fleet-health/progress-board/conveyor consumers outside the Plateau screen, mirroring #2686's justification)
   — but this requires **naming that reuse consumer concretely**, not asserting it exists by analogy to
   #2686.
2. **If (b): does the reuse consumer exist today?** Check `we:scripts/progress-board.mjs` and the conveyor
   tooling for an actual unmet need before scoping any WE-side build — do not repeat #3071 (build first,
   measure later).

## Recommendation

Default to fork 1(a): resolve #2687 as superseded by #2718/#2719, and correct #2732's `blockedBy`. This is
the smaller, more honest change — it removes a duplicate-scope trap instead of growing a third
implementation of the same forecast logic.
