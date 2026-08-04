---
kind: decision
size: 2
status: open
dateOpened: "2026-08-04"
preparedDate: "2026-08-04"
tags: [review, conveyor, converge-loop, orchestrator-mechanization]
relatedTo: ["2639", "2572", "2830", "2418"]
relatedReport: reports/2026-08-04-review-pipeline-unblock-plan.md
scope:
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/jury-core.mjs
---

# Converge loop: editor-enablement default by care band

No design exists for *when* the parked-PR convergence loop may push fixes rather than only report them — the
editor runs at every care band today, unexamined. **One fork** below, grounded in the loop's first real run
(PR #1018, 2026-08-04) and in published evidence on autonomous-fix quality, carrying a recommended default in
**bold**. Two candidates that looked like forks were **dissolved** during prep — one by a fresh-context screen,
one by a factual refutation of its own premise — and are recorded under *Supported by default* rather than
padding the call.

## The axis

The loop ([`we:scripts/workflows/review-parked-prs.mjs`](scripts/workflows/review-parked-prs.mjs)) is one
mechanism with a risk-posture setting, not three architectures. A fresh multi-lens panel judges the diff; on a
`changes` verdict an **editor subagent** rewrites the code and pushes to the PR branch; the panel re-reviews.
The panel's rigor already scales — `panelRigorForCareLevel` in
[`we:scripts/lib/jury-core.mjs`](scripts/lib/jury-core.mjs) dials jurors and rounds by band (`low` 1 juror /
1 round · `elevated` 1 / 2 · `high` 2 / 3). **The editor's enablement scales with nothing.** That is the axis:
the panel's care dial and the editor's blast radius are decoupled, and the evidence says they should move
together — in opposite directions.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(c) editor ON below a care threshold, review-only at and above it** | (a) editor always on | med-high |

## Fork 1 — At which care bands may the editor push fixes?

*Why this is a fork:* the branches cannot coexist — a given pass either mutates the author's branch or it does
not, and the mutation is not reversible from the author's side. Not a cost question: strip effort entirely and a
machine-authored patch substituting for the author's own fix is still a correctness, trust and accountability
difference.

**The crux, from the only run we have.** PR #1018, `care: elevated` (1 juror/lens, 2 rounds): round 1 requested
changes; the editor pushed a **15-file** fix (`729a9d8b`); round 2 faulted *that repair* three ways — including
introducing a **fail-open** in the very gate the fix had just written; the loop hit its round cap and escalated
**having cleared nothing**. The disposition was therefore *identical to review-only* — escalate to a human —
reached at 16 agents, 1.08M tokens and 56 minutes, and it handed the human a branch **mutated with a
self-inflicted defect the original diff did not contain**.

Published evidence points the same way: **45.1%** of autonomously generated PRs require post-review fixes, and
*"the model that wrote the code is the one that introduced the bugs, which makes it less equipped to find them
than an independent reviewer."*

- **(a) Editor always on.** The built behaviour. Maximum leverage when it converges; on the one observed run it
  converged nothing and degraded the branch. *Rejected as the default* — it is the branch the only evidence we
  have argues against, at the tier where it was tested.
- **(b) Review-only everywhere.** No editor, no pushes. Safe and cheap, but leaves the operator hand-fixing every
  finding, which is the problem the loop exists to solve. *Rejected* — discards the leverage without evidence
  that the low band is where the harm is.
- **(c) Editor ON below a care threshold, review-only at and above it.** **RECOMMENDED DEFAULT.** Bind the
  editor's enablement to the same `careLevel` that already dials the panel, inverted: cheap, local, low-risk
  findings get repaired automatically; tiers carrying blast-radius, trust-chain or size signals get a report and
  a human. Proposed threshold: **editor at `low`; review-only at `elevated` and `high`** — excluding the band
  where it was observed to fail, keeping leverage where fixes are most mechanical.

**Sub-decision (ratify with the fork):** the threshold. `low` only is the conservative read of a single data
point; `low` + `elevated` keeps more leverage and bets that PR #1018 was unrepresentative.

**Skeptic:** `REFUTED → flipped to (c)`. The prep default was **(a)**, argued as *"the panel caught the editor's
mistakes, so the loop worked."* The skeptic refused that framing: the *outcome* on #1018 was the same escalation
review-only would have produced, at 1.08M tokens, plus a mutated branch — and `elevated` is precisely where round
caps are tightest and where the 45.1% figure predicts recurrence rather than a fluke. The default was flipped
before this item was stamped.

**Screen:** `clear`. Q1 (standard-vs-impl): no boundary issue — internal delivery tooling, and whether commits
appear on the author's branch is fully observable, not a hidden impl detail. Q2 (merit-vs-prioritization): merit
survives cost-stripping — a machine-authored patch replacing the author's own is a correctness and
accountability difference even at zero cost. The screen also noted the fork is **one mechanism with a setting**,
not three architectures; the framing above was rewritten to say so.

---

## Context

### Supported by default (not decisions)

**Mechanical agents run on a cheap model.** The loop's `fetch` / `discover` / `labels` / `rigor` / `reduce` /
`record` agents each shell ONE command and return a shape the `schema` option then validates. Both the skeptic
and the screen agreed this is **not a fork**: strip cost and a stronger model yields the same validated output,
so no merit difference remains. Applied in PR #1031 as a default, not ratified as policy.

**Bootstrap governance — dissolved on a factual refutation.** This item was drafted with a second fork asking
what governs a change that enables independent review but cannot be reviewed by the mechanism it enables —
concretely PR #1031, which makes the loop launchable. **The premise was false.** `/jury` and `/review` run
through [`we:scripts/lib/jury-core.mjs`](scripts/lib/jury-core.mjs) and
[`we:scripts/review-core-cli.mjs`](scripts/review-core-cli.mjs), which do **not** go through the Workflow
harness — and PR #1031's own audit found only `we:scripts/workflows/review-parked-prs.mjs` affected. A fresh
session can therefore review #1031 today, at ordinary cost, with no circularity. **There is no bootstrap deadlock
to govern.**

The screen dissolved it independently as `flagged(prio)`: strip cost and a full read strictly dominates
alignment-only clearance, so it was a timing squeeze wearing a fork's clothes. **Default:** a bootstrap change
gets a fresh-session review like anything else; alignment-only clearance is a logged exception, never a standing
option.

### Why this is decided now

The loop ran for the first time on 2026-08-04 — it had been unlaunchable since it was written (see the
[unblock plan](reports/2026-08-04-review-pipeline-unblock-plan.md)). That run is the entire empirical basis for
this call, and the editor's enablement is the one behaviour to set before the loop is turned loose on a queue of
parked PRs. Deciding it after a batch run means discovering the answer on other people's branches.

### Lineage

#2639 built the convergence loop · #2830 the scheduled runner (shadow) · #2572 the enforce flip (blocked by
#2864) · #2418 the "decisions stay in the loop" boundary this fork operates inside.
