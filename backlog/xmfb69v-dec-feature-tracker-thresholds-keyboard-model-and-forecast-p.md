---
kind: decision
size: 2
parent: "2705"
status: open
preparedDate: "2026-07-27"
dateOpened: "2026-07-27"
tags: []
---

# DEC · Feature-tracker thresholds, keyboard model, and forecast-projection policy

Ratify the four read-model thresholds (stalledAfterDays, noisyCoVCutoff, minSampleSlices, bottleneckSharePct), the S1b/S10 keyboard-model contract, and the forecast-projection policy. Each threshold becomes one named read-model constant, webcase-asserted as a number. Blocks S1b/S3/S8.

## Why blocking
The stalled window, noisy cutoff, min-sample, and bottleneck share are undefined; a delivery agent would hardcode a guess or bounce the card. Each becomes ONE named read-model constant the webcase asserts numerically, so two slices cannot implement different cutoffs and each pass its own case. **Must ratify before S1b / S3 / S8 render threshold-dependent cases.**

**codifiedIn:** `plateau-app:src/feature-tracker/read-model.ts` constants (S1a owns the stubs; this decision re-points them in one line).

## Forks to rule (bold = the ratified bold-default)

1. **stalledAfterDays** — the zero-throughput window that flips F2/K5/M3 delivering → stalled. Options: fixed 14d · **fixed 21d (default — matches the v3 stallDays:21 baseline)** · a multiple of the feature's own cycle time · per-kind. Ruling names one integer.
2. **noisyCoVCutoff** (K7) — the throughput coefficient-of-variation above which a band is "too-noisy-to-call" vs merely wide. Options: **CoV ≥ 0.6 (default)** · 0.5 · 0.75. Names one ratio + how wide a band stays honest before degrading to no-call.
3. **minSampleSlices** — the ONE resolved-slice count separating K6 no-basis (0) / M2 insufficient (thin) / E7 thin-history from "enough". **≥ 3 resolved slices = enough (default); 0 = no-basis; 1–2 = insufficient.**
4. **bottleneckSharePct** (S7 vs S17) — the fleet-points share a single gating hub must hold to fire the single-bottleneck banner; when disjoint hubs each clear it → multi (M36/S17). Options: **≥ 25% of gated fleet pts (default)** · top-1-by-pts always · percentile. Names one %.
5. **keyboardModel** (R8) — the S1b ↔ S10 contract, decided BEFORE S1b ships, virtualization in mind. **roving-tabindex (default — matches v3; every windowed row must carry the right tabindex as it enters/leaves the window)** · aria-activedescendant. Both S1b and S10 obey the ruling; S12 asserts the window-edge case.
6. **Forecast-projection policy** (codify §0) — a velocity-projected "wk of X"/quarter IS an allowed honest forecast, rendered AS a projection; FORBIDDEN is a hand-typed commitment date and any date on blocked/gated/stalled/cycle. **Default: adopt as written.** The read-model exposes `projectionLabel` so a projection is always rendered as a projection, never a commitment.

## Bold-default ruling (prepared)
stalled after 21d · too-noisy CoV ≥ 0.6 · min-sample ≥ 3 resolved slices (0 = no-basis, 1–2 = insufficient) · bottleneck ≥ 25% of gated fleet pts · keyboard-model roving-tabindex · forecast-projection policy adopted per §0. Each threshold = one named read-model constant, webcase-asserted as a NUMBER. Blocks S1b / S3 / S8.

Deferred to spec (not blocking this build): F15 re-opened date rule, M38 at-scale truncation count, R/C family flag-vs-standalone modelling, M8 rising-ceiling, M22 milestone-overdue anchor.
