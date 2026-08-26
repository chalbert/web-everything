---
bornAs: xpqf41v
kind: decision
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
codifiedIn: "docs/agent/platform-decisions.md#size-adds-reviewers-never-refuses"
preparedDate: "2026-08-26"
tags: []
---

# Should diff size refuse a PR, not just escalate it

**Ruled 2026-08-26: no — size never refuses, and the response to a large diff is scoped fan-out.** Convened as
a refuse-vs-escalate fork, this dissolves as **contract-derived**: [#2563](/backlog/2563/) clause 1 already
forbids a scored signal becoming a hard block with no reviewer, and a size refusal is exactly that. No branch
remained to weigh. Codified as `#size-adds-reviewers-never-refuses` in `we:docs/agent/platform-decisions.md`.

## What was proposed

`thresholds.diffLines: 400` in `we:scripts/lib/review-policy.contract.json` is a care-level signal and
explicitly **not** a hard block (#2563). Human defect detection collapses past ~400 LOC and our AI PRs run 408
at p75, so a refusal looked like the largest deterministic lever available — at the cost of reversing a
ratified decision.

## Why it was refused

1. **The 400-line figure is an *attention* ceiling, and attention is the one property an agent panel does not
   share with a human.** The result measures how much a single reader holds at one altitude. It is a proxy for
   "the reviewer cannot hold this", and the proxy stops measuring anything once the reviewer stops being one
   context. A refusal is not a stricter version of that finding — it applies the finding outside its domain.

2. **The only escape from a line ceiling is the sanctioned workflow.** Past a cap, the author slices one
   change into two PRs — which we already ask for. The cap never prevents a large change; it taxes relabelling
   it, and each half is then reviewed without sight of the other. A gate whose sole effect is splitting the
   evidence is not a safety mechanism. This compounds the open evasion #3317 addresses rather than closing it.

3. **It is not even a config dimension.** The prepared framing had escalate-at-400 and refuse-at-900 coexisting
   as two values on one axis, with the refuse value left unset for later measurement. That framing is wrong:
   a supported-but-unset refuse threshold invites a future reader to switch it on for the wrong reason. There
   is no value of it that is correct, so the knob is not built.

## What replaces it

Size dials review **capacity** — reviewers, rounds, rigor — never review **permission**. Concretely, scoped
fan-out: every reviewer gets the whole diff and full repo context, each accountable for a disjoint named
subset; a seam reviewer scoped to the boundaries; an omission reviewer scoped to the whole diff asking only
what is missing; reduction that treats an inter-shard contradiction as signal. Disjoint **accountability**,
shared **context** — truncating a reviewer's diff reintroduces the blindness the fan-out exists to remove.

Grounding for the omission seat: on PR #1569 two rounds of the claim-accuracy lens found nine wrong figures
and missed both defects that actually bounced it — a test that could not fail under any mutation, and the main
new feature having no test at all. Neither is visible to a per-shard reviewer, because absence has no shard.

Built by **#xytw33u** (scoped fan-out review). Dependency-graph-based shard cutting is deliberately **not**
taken up there: shared context removes most of its value, and it is revisitable if scoped reviewers still miss
cross-file defects.

## What this does not settle

- **#3317 is still owed, independently.** Cumulative basis from merge-base makes the size *measurement* honest
  under stacked lanes. That matters for dialling capacity even though nothing refuses on it. This ruling
  removes the sequencing constraint (a refusal must not precede #3317) by removing the refusal, not the need.
- **Risk-weighted size** — 400 lines of generated fixtures is not 400 lines of policy logic — is a live
  refinement of the care dial, not ruled here.

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn`
   pointing at `#size-adds-reviewers-never-refuses`, and no refuse threshold exists in
   `we:scripts/lib/review-policy.contract.json` (`grep -c refuse` stays `0`).
