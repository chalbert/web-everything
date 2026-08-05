---
bornAs: xe850rq
kind: task
status: open
dateOpened: "2026-08-05"
tags: [statute, review-policy, agent-memory]
---

# Codify the no-regression land bar in platform-decisions, reconciled with #2851

The operator ruled on 2026-08-05 that the bar for landing is **no regression + no new impact** (now + **no
weakened gate**), not "no findings". That ruling re-specifies **when a finding blocks** — a statute-layer
concern — but it was recorded only as an agent-memory leaf
(`we:agent-memory-src/land-on-no-regression-not-perfection.md`). Nothing in
`we:docs/agent/platform-decisions.md` records it and there is no `codifiedIn` anchor.

Meanwhile the ratified `#fix-review-convergence-independent-root-cause` (#2851, operator, 2026-08-02) still
specifies the unamended loop: the fix↔review cycle iterates until the diff is clean, with invariant 2 requiring
every round to address root cause and escalation only on non-convergence. So the effective bar depends on which
surface an agent happened to load — statute reader bounces on a confirmed incompleteness finding, memory reader
lands it.

**Work:** write the ruling into `we:docs/agent/platform-decisions.md` with an anchor, state explicitly how it
amends or bounds #2851 (it narrows what counts as "clean" for the convergence loop's exit condition — confirm
that reading with the operator), and point the memory leaf at the anchor.

**Judgment needed:** the #2851 reconciliation is a real ruling, not a transcription. Do not codify a reading the
operator has not confirmed.

**Prevention for:** review finding on PR #1040 (correctness lens). Related durable guard worth considering: a
write-time gate requiring an operator-ruling memory leaf to link a statute anchor, so "memory holds the pointer,
statute holds the rule" is enforced rather than recalled.
