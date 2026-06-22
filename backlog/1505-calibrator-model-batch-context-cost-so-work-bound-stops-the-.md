---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-22"
tags: [calibrator, batch, sizing, estimation, tooling]
---

# Calibrator: model batch context-cost so work-bound stops (the common case) inform the budget

The batch calibrator (`we:scripts/backlog.mjs` `calibrate`) sizes the next batch's points budget from a context-% reading at close-out. It only trains the estimate on **capacity stops** (budget/context-reached) and excludes **work-bound stops** (empty-pool/fork/gate, #553). But work-bound is the **designed-for common case** — the budget is `capacity × 0.6`, so a batch almost always exhausts its pool / hits a seam before filling the window — so the estimator trains on the rare case and starves (observed live: `mean of 1` after a full history; capacity rested on a single sample). Decide the estimator model so every batch informs the budget. Surfaced in batch-2026-06-21-1501-1356 (a 65%/48-pt empty-pool close that contributed nothing).

## Problem (why the current design starves)

The estimate is a single ratio through the origin — `implied_capacity = points / context_fraction` (e.g. `48 / 0.65 = 74`) — averaged over capacity-stop batches only. Two compounding shortcuts:
1. **No fixed-overhead term.** True cost is **affine**: `context% = overhead + cost·points`. The single ratio assumes `overhead = 0`, which only holds when `points` is large; on a small (work-bound) batch the fixed overhead (pack/plan/gate/declines/diagnosis) is a large fraction misattributed to `cost·points`, so the implied capacity comes out systematically low.
2. **Stop-reason as an on/off gate.** Excluding work-bound stops was the workaround for (1) — but since work-bound is the common case (the `×0.6` margin guarantees it), the gate discards most of the data and the estimate barely updates.

The recurring overhead does NOT average out under a single ratio, because work-bound samples are a *selection-biased* population (they stopped before saturating, by definition), not symmetric noise. The fix is a model that measures overhead explicitly, after which every batch contributes.

## Decision — the estimator model (fork gated on one capability)

The pivotal question is whether the **harness can expose context-% programmatically per turn/seam** (today it cannot — the agent can't self-measure context; the number is human-supplied once at close-out).

- **Option 1 — within-batch trajectory fit (the merit pick, *if* per-turn context% is available).** Log `(cumulative_points, context%)` at every seam; fit `context% = overhead + cost·points` from the per-batch trajectory. Stop-reason becomes **irrelevant** (a 5-item work-bound batch still gives 5 points on the line), overhead is **measured** (the intercept), and the common case becomes the *richest* data. Then size the budget by solving `overhead + cost·P ≤ target_ceiling` for P — which also **retires the arbitrary `×0.6`** in favour of a direct context-% ceiling. **Bold default.** Confidence ~85%; residual = the harness-context% dependency + possible non-linearity of the curve late in a window. *(Depends on a harness capability — file the "expose per-turn context%" enabler as its own prerequisite.)*
- **Option 2 — censored regression over the close-out log (the fallback if context% stays one-number-at-close-out).** Keep one `(points, context%)` tuple per batch but treat **work-bound = right-censored on points** ("≥N fit by C%") and capacity stops as exact; fit `overhead + cost` with a Tobit-style likelihood. Uses every batch, no downward bias, coarser than the trajectory. Confidence ~80%; residual = identifiability if almost every sample is censored.

Both fit the same affine model; the choice is purely whether per-turn context% exists. Not a permanent either/or — Option 2 is the degenerate-data version of Option 1.

## Interim (separately-prioritized build, not the merit fork — file once decided)

**One-sided ratchet** in the existing `calibrate`: let a work-bound sample raise capacity if its implied number *exceeds* the current estimate, never lower it. It cannot reintroduce the downward bias the gate guarded against, and it stops the estimate starving at `mean of 1`. ~70% — under-uses the data (only fires when a batch beats the estimate) but is a strict same-day improvement over discard, independent of which model wins above.

## Not prepared yet

Forks articulated but `preparedDate` unset — a /prepare pass should survey prior art (censored-regression / Tobit, online affine estimators), confirm whether the harness can emit per-turn context%, and bring Option 1 vs 2 to DoR before ratification. No ruling taken here.
