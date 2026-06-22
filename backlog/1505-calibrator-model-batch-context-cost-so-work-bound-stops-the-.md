---
kind: decision
status: resolved
locus: webeverything
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-calibrator-affine-cost-estimator.md
tags: [calibrator, batch, sizing, estimation, tooling]
---

# Calibrator: model batch context-cost so work-bound stops (the common case) inform the budget

## Ruling (ratified 2026-06-22)

**Adopt the pooled affine context-cost model.** Fit `context% = overhead + cost·points` by
Deming/errors-in-variables over **all** stored close-out tuples with a **single** universal-overhead
intercept and shared slope — every batch contributes to both parameters; the work-bound exclusion gate is
removed and **no per-stop-reason intercept dummy** is added (the live residuals refuted systematic
work-bound inflation: mean residual −0.5 work-bound vs +5.3 for the lone capacity-bound batch). Derive the
budget by solving `overhead + cost·P ≤ ceiling` and **keep a data-driven safety margin** (lower-CI
capacity / shrinkage toward the empirical median) in place of the arbitrary `×0.6` — *Fork 1 (b)*. Keep
windowing now, graduate to RLS-with-forgetting as the successor. The model **bootstraps immediately** from
the existing `we:.claude/skills/batch-backlog-items/capacity.json` history (raw tuples already stored), so
there is no warm-up.

Graduates to builds: **#1515** (the pooled affine estimator) → **#1516** (RLS forgetting-factor). The
**per-turn-context% trajectory** path and its harness enabler are **deferred** — not needed for "every
batch contributes" (the pooled fit delivers it) and the data shows no systematic per-event waste to
correct; file only if such a confound later appears. The **one-sided ratchet** interim is **not filed** —
superseded by #1515, which bootstraps from history and removes the bridge it would have provided.

---

**Grounding digest.** The batch calibrator (`we:scripts/backlog.mjs` `calibrate`, estimator in
`we:scripts/backlog/capacity.mjs`) sizes the next batch's points budget from one human-supplied
context-% reading at close-out. It trains a single-ratio capacity estimate
(`implied = points / context-fraction` — a line *through the origin*) and averages it **only over
capacity-bound stops** (`budget`/`context`), excluding **work-bound stops**
(`empty-pool`/`fork`/`gate`/`manual`/`outgrew`). But work-bound is the *designed-for common case* — the
budget is `capacity × 0.6`, so a batch almost always exhausts its pool or hits a seam before saturating
the window. **Live proof:** `we:.claude/skills/batch-backlog-items/capacity.json` holds 12 samples, 11
work-bound (`excluded`) and exactly **one** training (`stopReason: context`) — so `capacityPoints` (93)
rests on a single sample, a literal "mean of 1." Prior art + the fit on the live data are in
[the research topic](/research/batch-calibrator-affine-cost-estimator/) and
`we:reports/2026-06-22-calibrator-affine-cost-estimator.md`.

**Axis-framing.** The estimator parameterizes by *latent capacity* (max points per window) and treats
each batch as a noisy estimate `capacity ≈ points / fraction`
([`we:scripts/backlog.mjs:343`](../scripts/backlog.mjs#L343)). The fix is to parameterize by the
**affine cost curve** `context% = overhead + cost·points` instead, where the **intercept is the fixed
per-batch overhead** (pack, plan, gate, declines, diagnosis) — real work present in *every* batch, not
waste peculiar to any stop reason. Because every batch pays it, every batch is one measurement of it, and
it **averages out in the single intercept** — which is the whole point: the affine model *counts* the
overhead instead of the origin-model pretending it is zero. Fitting on the 12 live tuples gives a real,
*strongly significant* fixed overhead — **overhead ≈ 23.5 %** (t = 3.79, F = 14.4), **cost ≈ 0.55 %/pt**,
R² = 0.64. With the overhead measured rather than misattributed to `cost·points`, the stop-reason
exclusion gate is no longer needed — **every batch contributes to both the slope and the intercept**.
That collapses the original estimator-model fork to a forced invariant (below); the one genuine remaining
call is whether to keep a safety margin (Fork 1).

## Recommended path at a glance

**Ratified invariant — pooled affine fit, every batch contributes** (see below). One genuine fork remains:

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| Fork 1 — the safety margin | **(b) keep a data-driven margin (lower-CI capacity / shrinkage)** | (a) retire ×0.6, marginless point-estimate budget | high |

## Ratified invariant — pooled affine, every batch contributes

Fit `context% = overhead + cost·points` by (weighted) least squares over **all** batches' close-out
`(points, context%)` tuples — a **single** intercept and a shared slope — and derive the budget by
solving `overhead + cost·P ≤ ceiling` for `P`. Every batch contributes to *both* parameters, killing the
"mean of 1" starvation. This is a forced invariant (exactly one coherent branch), because the two
alternatives are flawed:

- **The current exclusion gate is broken** — work-bound is the common case (the ×0.6 margin guarantees
  it), so the gate discards ~90 % of the data and the estimate barely updates
  ([`we:scripts/backlog/capacity.mjs:17`](../scripts/backlog/capacity.mjs#L17),
  [`:39`](../scripts/backlog/capacity.mjs#L39)).
- **A separate "work-bound" intercept dummy is unsupported by the data and unidentifiable here.** An
  earlier draft (and a skeptic pass) argued work-bound stops burn *extra* context on zero-point activity
  (fork-thrash, gate-diagnosis), inflating the intercept, so they should carry their own offset. The live
  residuals **refute a systematic inflation**: mean residual is **−0.5 for work-bound vs +5.3 for the
  single capacity-bound batch** — the saturating batch sits *above* the work-bound cloud, not below it;
  the two `fork` batches split **+6.4 / −10.4** (no consistent direction); `empty-pool` (8 of 11)
  scatters ±12 as noise. The fixed overhead is *universal*, not stop-specific, and we estimate from a
  work-bound-dominated population to predict a work-bound batch — like-for-like, so no extrapolation bias.
  (A dummy is also unidentifiable today: with one capacity-bound sample the two intercepts are collinear.)

**Bootstraps from stored history — no warm-up.** `we:.claude/skills/batch-backlog-items/capacity.json`
already stores the raw `(points, contextPct)` for **all 12 batches, including the 11 work-bound ones** —
the exclusion gate dropped them only at *aggregation* (`excluded: true`), never at storage. So the affine
model **re-fits over the existing history immediately and reclaims the 11 previously-discarded samples**
(the live `overhead 23.5 / cost 0.55` fit is computed from this stored history). The old `impliedCapacity`
field is an origin-model artifact (`points/fraction`); the affine fit ignores it and uses the raw tuples,
so no value migration is needed. Keep the windowing / forgetting-factor (below) so a stale regime
(model change) ages out.

*Skeptic resolution (REFUTED → invariant simplified):* the prep skeptic's "work-bound inflates the
intercept" claim was tested against the live residuals and **refuted** — there is no detectable
systematic inflation, so the model collapses to a single pooled intercept. The only genuine residual
waste (a `fork`/`gate`/`outgrew` batch that spent real context on an unresolved item) is empirically tiny
(~2 of 12), unsystematic, and conservative-direction; a precise per-event correction is **deferred** to
the trajectory path (see *Supported by default*) and is warranted only if such data later reveals a real
confound — not needed for "every batch contributes," which the pooled fit already delivers.

## Fork 1 — keep a safety margin, or derive the budget marginless

*Fork-existence:* a real either/or — option (a) (retire the margin) is *flawed*: leave-one-out on the
live data moves the slope across 0.46–0.67 and the derived budget@85 % across **98–123 pts** — a ~25 %
swing from a single dropped sample — and a marginless budget also removes the buffer against a regime
change (a new model shifts overhead/cost). A point-estimate budget and a buffered budget cannot both be
the rule.

- **(a) Retire ×0.6; size the budget directly as `(ceiling − overhead) / cost`.** *Rejected* —
  marginless on a thin fit (24 % relative SE on the slope) and fragile to regime change; `P*` depends on
  `1/cost`, so the error is amplified hyperbolically where `cost` is least certain. (The item's original
  framing proposed this as a merit of the affine model; it is the part that does **not** survive.)
- **(b) Replace ×0.6 with a data-driven margin.** Derive the budget from *conservative bounds* — a lower
  confidence bound on derived capacity (upper-CI overhead & cost), or shrinkage toward the empirical
  median capacity (≈ 90 pts) — so the buffer is sized to *fit uncertainty* and absorbs regime change,
  rather than an arbitrary constant. The affine model's win is the *measured overhead*, not the removal
  of the margin. **Recommended default.** Confidence high; residual = the exact margin form
  (lower-CI vs shrinkage) is an implementation tuning, not a separate fork.

*Skeptic: SURVIVES — beat the "retire the margin" attack by keeping it.* The skeptic argued the marginless
budget is the most fragile part of the affine proposal; the default already keeps a (now data-driven)
margin, so the attack confirms (b) rather than overturning it.

---

## Context

### Supported by default (not decisions)

- **Errors-in-variables (Deming) fit over plain OLS, + a heteroskedasticity check as `n` grows.** Both
  axes carry error (points is a coarse aggregate; context% is a single human eyeball reading), so OLS
  attenuates the slope and inflates the intercept. A Deming fit on the live data moves overhead
  23.5 → 20.0 and cost 0.55 → 0.63 (budget@85 % 112 → 103) — materially different, confirming
  attenuation. `corr(|resid|, points) = 0.20` hints at heteroskedasticity but is inconclusive at n = 12.
  This is a *more-correct* refinement, not a coherent either/or — adopt it; revisit WLS if the
  heteroskedasticity signal firms up.
- **Online form: recursive least squares with a forgetting factor** (typical λ ∈ [0.98, 0.995]) is the
  principled successor to the fixed 12-sample window once the affine model is in — it discounts an old
  regime (e.g. a model change) continuously rather than by a hard cutoff. Adopt as the estimator matures;
  not a fork.
- **Deferred — within-batch per-turn trajectory fit + its enabler.** Logging `(cumulative_points,
  context%)` at every seam would let a *per-event* waste correction separate productive cost from the
  occasional fork/gate tail *inside* a batch. It is **not** needed for "every batch contributes" (the
  pooled fit already delivers that) and the data shows no systematic waste to correct — so it is demoted
  from "the structural fix" to a contingency, warranted only if a real per-event confound is later
  observed. It is gated on a harness enabler ("expose per-turn/per-seam context% programmatically"),
  whose feasibility is uncertain (an editor meter, not an API; the human often cannot read it either).
  File the enabler as a child only if/when the confound appears.

### Interim (separately-prioritized build, not a fork — file once decided)

**One-sided ratchet** in the existing `calibrate`: let a work-bound sample raise capacity if its implied
number *exceeds* the current estimate, never lower it. It cannot reintroduce the downward bias the gate
guarded against, and it stops the estimate starving at "mean of 1." ~70 % — under-uses the data (only
fires when a batch beats the estimate) but is a strict same-day improvement over discard and an immediate
bridge until the pooled affine fit lands.

### Classification (per-fork pass)

This is **internal batch tooling**, not a shipped WE standard — not a protocol, intent, block, or
adapter, with no project-facing surface; it lives in the pure module `we:scripts/backlog/capacity.mjs`.
The standard classification questions (which layer / protocol-vs-intent / DI-injectable /
most-permissive default / seam-between-intents) resolve to **N/A — dev-workflow tooling**. Binding
constraints are repo conventions: keep the estimator a pure, unit-testable module (it already is;
`we:scripts/__tests__/` covers it), and keep the human-supplied `--context-pct` contract. No ruling taken
here — `/next decision` makes the call.
