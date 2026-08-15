---
bornAs: x08qg0p
kind: story
size: 5
parent: "2505"
status: resolved
blockedBy: ["3125"]
dateOpened: "2026-07-26"
dateResolved: "2026-08-15"
resolutionNote: "Superseded by #2718 (S1a, plateau-app:src/feature-tracker/forecast.ts) + #2719 (DEC, ratified thresholds) per #3125's ruling (2026-08-15, validation-gate NO — no named WE-side reuse consumer for a standalone primitive). #2718 covers this item's whole ask (FORECAST/FORECAST·CAVEAT/NO FORECAST/TOO NOISY vocabulary, projection-window emitter, honest-forecast policy); its Acceptance gained an explicit denominator-honesty line carrying forward this item's fourth clause. #2732's blockedBy corrected from #2687 to #2718 in the same resolution."
tags: []
---

# Velocity-derived forecast primitive — a labeled projection with an honest no-forecast fallback

A projected finish computed from measured throughput, explicitly labeled a FORECAST (never a hand-typed target). Honest state machine — FORECAST / FORECAST·CAVEAT (gated pts) / NO FORECAST (stalled) / TOO NOISY (high variance).

Operator ruling from the design session — forecast ONLY the unblocked remainder; REFUSE a whole-feature date when the critical path is blocked (show "gated on <blocker>" with blocked points called out separately); never divide total open points by a velocity that excludes blocked epics and present it as a whole-feature date. Open question: the exact thresholds — the too-noisy variance cutoff, the stalled-days cutoff, and whether blocked epics are excluded from the throughput used. Depends on the velocity metrics primitive (#2686, resolved).

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Preparation finding (2026-08-15) — NOT build-ready; scope now overlaps #2718

Prepared per `we:agent-memory-src/story-preparation-checklist.md` and found **not viable to hand to a
builder as currently scoped.** This item's own "open question" (the exact thresholds) is no longer open —
**`we:backlog/2719-dec-feature-tracker-thresholds-keyboard-model-and-forecast-p.md`** (a decision ratified
2026-07-27, one day after this item was spun off) already names all four: `stalledAfterDays = 21`,
`noisyCoVCutoff = 0.6`, `minSampleSlices = 3` (0 = no-basis, 1–2 = thin, ≥3 = enough), plus the exact
forecast-projection policy this item asks for. Worse, this item's whole deliverable (the FORECAST /
FORECAST·CAVEAT / NO FORECAST / TOO NOISY vocabulary, the projection-window emitter, threshold-boundary
tests) is **already the explicit scope** of **`we:backlog/2718-s1a-read-model-forecast-bottleneckid-single-source-of-number.md`**
(S1a, `plateau-app:src/feature-tracker/forecast.ts`) — a more detailed sibling item from the next day's
slicing pass, which does not itself list this item (#2687) as a blocker. Building this item as written
would duplicate #2718's file, or force a silent, un-ratified scope split between two same-named
deliverables. Full grounding, citations, and the fork to rule are carved into the new decision item this
is now `blockedBy` (see the bold default there: supersede #2687, redirect
`we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md`'s `blockedBy` from #2687
to #2718). Do not start a build against this card until that decision resolves.
