# Batch Calibrator: an Affine Context-Cost Estimator so Work-Bound Batches Inform the Budget

**Point:** The batch calibrator starves because it trains its single-ratio capacity estimate only on the *rare* capacity-bound stop (11 of 12 live samples are work-bound and excluded → "mean of 1"); the fix is to model context cost as **affine** (`context% = overhead + cost·points`), where the intercept is the **universal fixed overhead** (pack/plan/gate/declines) that is real work in *every* batch and therefore averages out in a **single pooled intercept** — so every batch contributes to both parameters. A skeptic pass first argued work-bound stops *inflate* the intercept with non-productive context, but the live residuals **refute systematic inflation** (work-bound mean residual −0.5 vs the single capacity-bound batch at +5.3 — the saturating batch sits *above*, not below), so the model collapses to a pooled affine fit. The one genuine remaining call is keeping a **data-driven safety margin**; fit with **errors-in-variables**.

**Decision item:** [backlog #1505](/backlog/1505-calibrator-model-batch-context-cost-so-work-bound-stops-the-/)
**Research page:** `/research/batch-calibrator-affine-cost-estimator/`

---

## Question

`we:scripts/backlog.mjs calibrate` sizes the next batch's points budget from one human-supplied
context-% reading at close-out. It trains the capacity estimate **only on capacity-bound stops**
(`budget`/`context`) and excludes **work-bound stops** (`empty-pool`/`fork`/`gate`/`manual`/`outgrew`).
But work-bound is the *designed-for common case* — the budget is `capacity × 0.6`, so a batch almost
always exhausts its pool or hits a seam before saturating the window. Result: the estimator trains on
the rare case and starves. What estimator model lets **every** batch inform the budget without
reintroducing the downward bias the exclusion gate was guarding against?

## Live evidence (the data that motivated this)

`we:.claude/skills/batch-backlog-items/capacity.json` holds 12 samples. **11 are work-bound
(`excluded`); exactly 1 (`stopReason: context`) trains.** `capacityPoints` (93) therefore rests on a
single sample — the live "mean of 1" the item reports.

The 12 `(points, context%)` close-out tuples:

```
(13,37) (57,49) (67,67) (50,47) (37,41) (23,33) (18,23) (34,44) (52,55) (72,51) (55,59) (48,65)
```

## Recommendation (to ratify in #1505)

1. **Ratified invariant — pooled affine fit, every batch contributes.** Replace the single ratio
   `implied = points / fraction` (a line *through the origin* — assumes zero fixed overhead) with the
   affine `context% = overhead + cost·points`, fit over **all** batches' close-out tuples with a
   **single** intercept and shared slope; derive the budget by solving `overhead + cost·P ≤ ceiling`.
   The current model is *broken* on two counts: it misattributes a large, now-measured fixed overhead,
   and its stop-reason on/off training gate discards ~90 % of the data. The intercept is the **universal
   fixed overhead** (real work in every batch), so it legitimately averages out in one pooled intercept —
   no per-stop-reason carve-out.
2. **Do *not* add a work-bound intercept dummy.** An earlier draft (and the skeptic) argued work-bound
   stops inflate the intercept with non-productive context and should carry their own offset. The live
   residuals refute systematic inflation (see *Skeptic pass* below), and a dummy is unidentifiable with
   one capacity-bound sample. Stop-reason is not a systematic confound; the pooled intercept holds.
3. **Fork 1 — keep a data-driven safety margin; don't go marginless.** Replace the arbitrary `×0.6`
   with a margin *sized to fit uncertainty* (a lower confidence bound on derived capacity, or shrinkage
   toward the empirical median), not the bare point estimate `(ceiling − overhead) / cost`.
4. **Fit with errors-in-variables (Deming), not plain OLS**, and run a heteroskedasticity check as `n`
   grows — both axes are noisy (points is a coarse aggregate; context% is a single human eyeball
   reading), so OLS attenuates the slope and inflates the intercept.
5. **Per-turn context% (trajectory data) is deferred, not the structural fix.** It would enable a
   *per-event* waste correction (fork/gate tails) but is not needed for "every batch contributes" — the
   pooled fit already delivers that, and the data shows no systematic waste to correct. File the enabler
   ("expose per-turn/per-seam context%") only if a real per-event confound is later observed; bridge with
   the **one-sided ratchet** interim build until the pooled fit lands.

## Key findings — the affine fit on the real data

A plain OLS fit of `context% = overhead + cost·points` over all 12 tuples:

| Quantity | Estimate | SE | t | Note |
|---|---|---|---|---|
| overhead (intercept) | **23.5 %** | 6.2 | **3.79** | F(drop intercept) = 14.4 — overhead is *real*, not zero |
| cost (slope) | **0.549 %/pt** | 0.131 | 4.2 | 24 % relative SE |
| R² | 0.638 | | | on n = 12, 2 params |

So the single-ratio-through-origin model is decisively wrong: there is a **~24 % fixed overhead** the
old model spread into `cost·points`, systematically *under*-estimating implied capacity on small
(work-bound) batches — exactly why excluding them looked necessary.

## Key findings — the skeptic pass (and where it was itself refuted)

A throwaway skeptic was tasked to refute the prepared default. It raised four objections; the first was
then tested against the data and **refuted**, the rest stand:

1. **"Work-bound context inflates the intercept" — RAISED, then REFUTED by the residuals.** The skeptic
   argued a work-bound stop burns context on zero-point activity (fork-thrash, gate-diagnosis) that
   loads onto the intercept, so stop-reason must be kept as a separate offset. But the fixed overhead it
   names (pack/plan/gate) is **universal** — real work in *every* batch — not a work-bound-only waste; it
   is exactly the affine intercept, and it averages out across all batches. The live residuals show **no
   systematic inflation**: mean residual is **−0.5 for work-bound vs +5.3 for the single capacity-bound
   batch** (the saturating batch sits *above* the work-bound cloud, not below), and the two `fork`
   batches split **+6.4 / −10.4**. We also estimate from a work-bound-dominated population to predict a
   work-bound batch — like-for-like, no extrapolation bias. So the model collapses to a **single pooled
   intercept**, and stop-reason is dropped. (The intercept *is* strongly significant — t = 3.79,
   F = 14.4 — confirming overhead is real; it just is not stop-specific.)
2. **The fit is too thin to retire a margin — STANDS.** Leave-one-out moves the slope across
   **0.46 – 0.67** and the derived budget@85 % across **98 – 123 pts** — a ~25 % swing from a *single*
   dropped sample. A marginless `(ceiling − overhead)/cost` removes the very buffer that absorbs this and
   a regime change (new model) → keep a data-driven margin (Fork 1).
3. **Errors-in-variables matters — STANDS.** A Deming fit (equal error-variance ratio) moves overhead
   23.5 → **20.0** and cost 0.549 → **0.629** (budget@85 % 112 → 103) — a materially different model,
   confirming OLS attenuation. `corr(|resid|, points) = 0.20` hints at heteroskedasticity but is
   inconclusive at n = 12.
4. **Trajectory data — deferred, not the structural fix.** The within-batch *trajectory* could separate
   productive cost from the occasional fork/gate waste tail *inside* a batch — but with the inflation
   claim refuted, this is a *per-event* correction for a confound the data does not currently show, not
   the thing that makes "every batch contribute" (the pooled fit already does). Demoted from prerequisite
   to a contingency.

Net: the affine cost curve is the right estimator; the genuine surviving amendments are **keep a
data-driven margin** and **fit with EIV** — the stop-reason carve-out the skeptic wanted is *not* needed,
refuted by the residuals.

## Prior art (the methods are textbook; the contribution is the framing)

- **Censored / Tobit regression** (Tobit 1958; [Tobit model](https://en.wikipedia.org/wiki/Tobit_model)).
  OLS on a censored response is biased and inconsistent; Tobit recovers it via an ML likelihood
  (Olsen's 1978 `δ = β/σ`, `γ² = σ⁻²` reparameterization makes the log-likelihood concave). The item's
  original "Option 2" reached for Tobit because it modeled *latent capacity* directly (work-bound =
  right-censored on capacity). The affine reparameterization **dissolves the censoring**: a close-out
  tuple is an exact point on the cost curve regardless of *why* the batch stopped, and the fixed overhead
  is a single universal intercept — so no Tobit and no per-stop-reason offset are needed.
- **Recursive least squares with a forgetting factor / sliding window** (typical λ ∈ [0.98, 0.995];
  [RLS overview](https://www.emergentmind.com/topics/recursive-least-squares-rls-with-forgetting-factor),
  [MATLAB recursiveLS](https://www.mathworks.com/help/ident/ref/recursivels-system-object.html)). This
  is the online form of the affine fit and the principled successor to the existing 12-sample window: it
  discounts old regimes (e.g. a model change) continuously rather than by a hard window cutoff — the
  natural home for the "adapt to a new model" requirement once the affine model is in place.
- **Deming / errors-in-variables regression** — the correct fit when both axes carry error, which
  they do here (coarse human context% reading; aggregated points).

## Classification (per-fork pass)

This is **internal batch tooling**, not a shipped Web Everything standard — it is not a protocol, intent,
block, or adapter, and exposes no project-facing surface. It lives in the pure module
`we:scripts/backlog/capacity.mjs` (consumed by `we:scripts/backlog.mjs calibrate`). So the standard
classification questions (which layer / protocol-vs-intent / DI-injectable / most-permissive default /
seam-between-intents) resolve to **N/A — dev-workflow tooling**. The only architectural constraints that
bind are repo conventions: keep the estimator a pure, unit-testable module (it already is), and keep the
human-supplied `--context-pct` contract until a harness enabler changes it.

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-06-22-calibrator-affine-cost-estimator.md` | created (this report) |
| `we:src/_data/researchTopics/batch-calibrator-affine-cost-estimator.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/batch-calibrator-affine-cost-estimator.njk` | created (write-up) |
| `we:backlog/1505-…md` | rewritten to the prepared-fork shape; `preparedDate` set |
