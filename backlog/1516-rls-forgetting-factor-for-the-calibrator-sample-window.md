---
kind: story
size: 3
status: resolved
blockedBy: ["1515"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:scripts/backlog/capacity.mjs"
tags: []
---

# RLS forgetting-factor for the calibrator sample window

Replace the hard 12-sample window in we:scripts/backlog/capacity.mjs with recursive least squares + a forgetting factor (lambda approx 0.98-0.995) so a regime change (model swap, shifted context economics) ages out smoothly rather than by a hard cutoff. The online successor to hard windowing, adopted once the pooled affine estimator (#1515) lands. Ratified in #1505 (Supported by default).

## Progress (batch-2026-06-22-1510-1483)

Replaced the hard sample window with the RLS forgetting factor (the online successor ratified in #1505, now that the pooled affine estimator #1515 has landed):

- **`we:scripts/backlog/capacity.mjs` `fitAffineCost`** — added a `forgetting` option (default `0.99`, the ratified ≈0.98–0.995 band). Samples are chronological (newest last); the newest weighs 1 and each older decays by `forgetting^age`, so the Deming moments become recency-weighted. A regime change (model swap, shifted context economics) ages out **smoothly** instead of by a cutoff. `forgetting = 1` reproduces the unweighted pooled fit (#1505/#1515) **exactly** (verified). The fit now also returns `nEff = (Σw)²/Σw²` (the forgetting-discounted effective sample size) and a recency-weighted `residualStd` (Bessel-corrected by `nEff − 2`).
- **`we:scripts/backlog.mjs` `calibrate`** — dropped the hard `.slice(-12)` window (the actual "hard 12-sample window" the item named); now keeps all history under a generous `.slice(-200)` **storage** bound (not a statistical window — at `forgetting 0.99` a 200-old sample weighs `0.99^199 ≈ 0.13`). Reads `forgetting` from the calibrator config (tunable, default 0.99), persists it + `nEff` into the stored fit, and surfaces both in the calibrate note.
- **Tests** (`we:scripts/backlog/__tests__/capacity.test.mjs`): added a forgetting suite — `forgetting=1` reproduces the pooled fit (back-compat + `nEff=n`); a synthetic regime change proves the fit leans toward the recent samples (`cost` pulled above the pooled average, `nEff < n`); a single noise-free regime is recovered exactly at any forgetting (collinear → weight-invariant).

`vitest` 16/16 green; `check:standards` 0 errors; the `we:scripts/backlog.mjs` CLI parses. Pure-function change behind the existing calibrate CLI — no behavioural break for callers (the default is the ratified active forgetting; the only stored-schema additions are `forgetting` + `fit.nEff`).
