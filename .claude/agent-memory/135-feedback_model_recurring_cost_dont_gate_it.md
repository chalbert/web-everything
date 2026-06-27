---
name: feedback_model_recurring_cost_dont_gate_it
description: "recurring/representative overhead must be MODELED (affine fit), not gated out as \"contamination\"; gating an estimator's training on the rare stop-reason starves it — the common case carries real (censored) signal"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2ddd0546-648f-4c7d-ae8c-2b79f27bc41e
---

When an adaptive estimator (budget/capacity/throughput) looks "contaminated" by overhead, do NOT exclude the contaminated samples — **model the overhead** so every sample contributes. The user drove this reframe on the batch calibrator (#1505): it trained only on rare **capacity stops** and excluded **work-bound stops** (empty-pool/fork/gate), but work-bound is the *designed-for common case* (budget = capacity×0.6 guarantees a batch usually exhausts its pool before filling the window), so the estimate starved (`mean of 1`).

**Why:** I first defended the exclusion as "the ratio is contaminated by no-points overhead (declines/diagnosis)." The user pushed: that overhead *recurs* and should average out. Correct — the real fault is the model, not the data. A single ratio-through-origin (`points / context%`) assumes zero fixed overhead, so it mis-attributes recurring overhead to marginal cost and biases low on small batches. The true cost is **affine** (`cost = overhead + marginal·N`); fit that and the overhead is *measured* (intercept), not assumed away. A work-bound sample isn't symmetric noise — it's **right-censored** ("≥N fit"), real information a censored/trajectory fit uses correctly.

**How to apply:** (1) Before excluding data as "contaminated," ask if the contaminant is *recurring/representative* — if so, add a term for it, don't gate it out. (2) Prefer a 2-parameter (affine) fit over a single ratio whenever a fixed-overhead component exists. (3) Treat a stop/truncation reason as a **censoring flag** (a feature), not an include/exclude switch. (4) Watch for the self-defeating loop: a conservative target (×fraction) makes the "clean" stop the *rare* one, so gating to it starves the learner. (5) The strongest fix often dissolves the problem (per-turn measurement → trajectory fit makes stop-reason irrelevant) — reach for it over patching the proxy. Relates to [[context-meter-ask-dont-estimate]] (the per-turn signal needs a harness hook; the agent can't self-measure context).
