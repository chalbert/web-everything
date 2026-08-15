---
bornAs: xvpx3bi
kind: decision
parent: "2705"
status: resolved
dateOpened: "2026-08-15"
preparedDate: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: none
codifiedIn: one-off
tags: []
---

# Reconcile forecast-primitive scope: #2687 (WE) vs #2718/#2732 (plateau-app:src/feature-tracker/forecast.ts) — already-ratified thresholds via #2719

## ⚠ Ratification gap — needs operator attention

Flagged retroactively (2026-08-15): this item was resolved by an autonomous prep agent the same day it was
opened and prepared (`dateOpened == preparedDate == dateResolved == 2026-08-15`), with **no `ratifiedBy:`
frontmatter field and no `## Ruling` block** naming a human, and no PR comment recording an explicit human
ratify utterance. Per `we:docs/agent/backlog-workflow.md:313-314`, every `decision` item requires explicit
human ratification before `resolved` — the *only* sanctioned auto-ratify is the fork-existence test
collapsing to exactly one coherent branch (`:314`). This item does not qualify for that exception: its own
**Skeptic (pass 4)** rated axis 2 `SURVIVES-WITH-AMENDMENT` (a red-team that amended a branch), which per
`we:docs/agent/backlog-workflow.md:314` and `we:backlog/2821-*.md` gate 1b is explicitly named as a "live
fork" tell that "is never an auto-close" — validation-gate archetype exempts this item from needing `## Fork
N` shape (see *Why this is a validation gate*, above), but does **not** exempt it from needing a human's
actual sign-off.

**This note does not reopen or reverse the ruling** — the underlying technical verdict (no named WE-side
reuse consumer for a standalone forecast primitive; #2718/#2719 already cover #2687's ask) was independently
re-checked and stands on its merits. What's missing is only the provenance record. Next step for whoever
reviews this next: either (a) add a retroactive `ratifiedBy:` field + a `## Ruling` block naming the human
who reviewed and affirms the verdict, dated when that review happens — or (b) if the operator disagrees with
the ruling on review, reopen this item (`status: active` or `open`) and re-run ratification properly. Do not
resolve this gap by fabricating a ratification.

## Digest — resolved: #2687 superseded

**Verdict: NO — a separate WE-side generic forecast primitive is not worth keeping as its own build item.**
#2718 (S1a) + #2719 (DEC, ratified 2026-07-27) already deliver #2687's entire ask, more specifically (real
file paths, ratified thresholds, boundary-fixture tests), and no backlog item or script names a concrete
WE-side reuse consumer for a generic version. #2687 is resolved `status: resolved` as superseded by
#2718/#2719; #2732's `blockedBy` is corrected from `#2687` to `#2718` (the item that actually produces the
file it re-edits); and #2718's Acceptance criteria gains one line carrying forward a clause of #2687's ask
that wasn't yet explicit there (see Amendment below).

## Why this is a validation gate, not a merit fork

This is the **third archetype** (a go/no-go on a candidate), not a `## Fork N` merit choice. #2687 asks
"should WE build a standalone, reusable forecast primitive?" — that has no rival branch to weigh against
supersession; it is a candidate to validate against demonstrated demand. The two coherent-looking options
in the original framing ((a) supersede vs (b) keep a narrower WE-side scope) are not both live: (b) requires
**naming a concrete reuse consumer**, and none exists — so (b) is not an available branch, it's an
unfulfilled precondition. That collapses this to a one-sided gate, not an either/or.

**Authorizing precedent — `we:docs/agent/platform-decisions.md#thin-container-graduation-trigger`:**
"Artifact reuse is demand-gated" — a shared primitive without a proven 2nd consumer doesn't graduate to its
own artifact; it waits. #2686 (`we:scripts/readiness/velocity-metrics.mjs`) is the alive precedent for the
opposite case: its file header *explicitly* names its 2nd/3rd consumers ("reusable BEYOND the
feature-tracking screen — the same core shells fleet-health readouts and conveyor tuning"). #2687 carries no
equivalent claim, and a targeted search confirms none exists today (see Context).

## Skeptic (pass 4 — refute the default)

A throwaway skeptic sub-agent attacked five axes:

1. **Classification (merit smuggled as demand-gate?)** — SURVIVES. The demand-gate citation is the correct
   existing rule, not an invented dodge; it directly cites `thin-container-graduation-trigger`.
2. **Does #2718 cover #2687's whole ask?** — SURVIVES-WITH-AMENDMENT. Three of #2687's four clauses map
   cleanly (labeled-FORECAST vocabulary → `FC_TXT`/`FC_CLS`; the honest state machine → §0/DEC thresholds;
   refuse a date when blocked → #2719's "FORBIDDEN: any date on blocked/gated/stalled/cycle"). The fourth —
   *"never divide total open points by a velocity that excludes blocked epics and present it as a
   whole-feature date"* — is a specific denominator-honesty guard not yet stated as an explicit acceptance
   case or fixture in #2718. It's plausibly implied by "forecast only the unblocked remainder" but isn't
   tested. **Fix applied:** added as an explicit acceptance line to #2718 (see Amendment).
3. **Is the "no consumer" search adequate?** — SURVIVES. Independently re-grepped `scripts/`,
   `docs/agent/`, `agent-memory-src/`, and all of `backlog/*.md` for "forecast"/"projection"/"ETA" — zero
   hits outside the #2705 feature-tracking cluster itself.
4. **Is #2732's blockedBy fix correct?** — SURVIVES. #2732's own `scope:` marks the forecast file an
   "owned re-edit" (expects it to already exist), and #2727 already bypasses #2687 cleanly with no ill
   effect. #2732 needs only `2718 → 2732` in sequence, not both #2687 and #2718.
5. **Statute-overlap** — SURVIVES. No collision: this ruling applies the existing demand-gated-reuse rule
   rather than minting new policy (`codifiedIn: one-off` is correct — it cites, not creates).

**Overall: ruling stands, with one amendment folded in** (item 2 above).

## Screen (pass 5 — fresh-context two-confusion check)

`Screen: clear`. A fresh-context agent with no prior exposure to this authoring answered both required
questions:

- **Implementation-detail vs standard layer:** clear. #2687 was never standards-layer content — it's a
  WE-homed *story* (build work), not an intent/protocol/adapter definition. The actual standards-layer
  content (the honest-forecast policy) already lives in ratified #2719 and is untouched by this ruling;
  resolving #2687 only changes which build ticket tracks identical implementation work. No boundary
  content is being relocated.
- **Merit vs prioritization:** under the zero-cost hypothetical (both branches free to build, instantly
  maintained), no independent merit difference survives — #2718 computes the same numbers off the same
  ratified constants #2687 would. The ruling doesn't pretend otherwise: it explicitly frames the call via
  the demand-gate rule and #3071's build-before-measuring lesson, not a hidden merit claim. That's the
  honest classification for a validation-gate verdict (which is allowed to weigh redundancy/demand — see
  *Why this is a validation gate*), not a disqualifying "prioritization dressed as merit" fork.

## Context — grounding (already surfaced while preparing #2687, PR #1338)

- **`we:backlog/2718-s1a-read-model-forecast-bottleneckid-single-source-of-number.md`** (S1a, `status:
  open`) scopes `plateau-app:src/feature-tracker/forecast.ts` and its deliverable text is #2687's
  deliverable verbatim: *"Forecast vocabulary FC_TXT/FC_CLS + the projection-window emitter obeying §0 ...
  Threshold constants (stubbed; DEC re-points in one line). Threshold-boundary fixtures (R6) ... prove
  threshold CORRECTNESS."* It never listed #2687 in `blockedBy`.
- **`we:backlog/2719-dec-feature-tracker-thresholds-keyboard-model-and-forecast-p.md`** (DEC, resolved
  2026-07-27) already answers #2687's own "open question" — the exact thresholds: `stalledAfterDays = 21`,
  `noisyCoVCutoff = 0.6`, `minSampleSlices = 3` (0 = no-basis, 1–2 = thin, ≥3 = enough), plus the
  forecast-projection policy (a velocity-projected window is an allowed honest forecast; forbidden on
  blocked/gated/stalled/cycle; a real date only on resolved/delivered). `codifiedIn:
  plateau-app:src/feature-tracker/read-model.ts`.
- **`we:backlog/2727-s3-velocity-panels-band-forecast-chips-insufficient-stalled-.md`** (S3, the chip-
  rendering slice) is `blockedBy: ["2725", "2686", "2719"]` — it depends on velocity (#2686) and the
  ratified thresholds (#2719) directly, **not** on #2687.
- **`we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md`** (S4, burn-up) is
  the one item that still listed `blockedBy: ["2727", "2687"]` — but its own `scope:` marks
  `plateau-app:src/feature-tracker/forecast.ts` as an **"owned re-edit,"** i.e. it expects the file to
  already exist (created by #2718/S1a), not to be produced by #2687. Its stale `blockedBy` traces to the
  epic's original one-line summary (`we:backlog/2705-feature-tracking-screen-ratified.md:17`: *"velocity
  from #2686; forecast from #2687"*), written the day before the slicing pass gave S1a the file.
- No item claims a reuse case for #2687 outside the feature-tracking screen (unlike #2686, whose card and
  file header explicitly justify a WE-side home via named fleet-health/conveyor consumers). A repo-wide
  grep for "forecast" outside the #2705 cluster returns nothing.
- #3071's lesson applies here too: a card can be scoped exactly right and still be pointless to build if
  nothing has measured that it is still needed — here the measurement (the consumer search) shows it is
  not, as scoped.

## Mechanical changes made by this resolution

1. **`we:backlog/2687-velocity-derived-forecast-primitive-a-labeled-projection-wit.md`** → `status:
   resolved`, `resolutionNote` pointing to #2718/#2719 (this decision is the ruling).
2. **`we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md`** → `blockedBy`
   corrected from `["2727", "2687"]` to `["2727", "2718"]`.
3. **`we:backlog/2718-s1a-read-model-forecast-bottleneckid-single-source-of-number.md`** → Acceptance
   criteria gains one explicit line carrying forward #2687's denominator-honesty clause: a whole-feature
   date must never be computed by dividing total open points by a velocity that already excludes blocked
   epics — only the unblocked remainder may be projected.
