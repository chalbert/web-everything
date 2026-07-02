# Deferred merge queue & landing substrate — prior-art survey (prep for #2138)

**Date:** 2026-07-02 · **Decision:** [#2138](../backlog/2138-should-lane-landing-move-to-a-deferred-merge-queue-drained-b.md) ·
**Related report:** [we:reports/2026-06-30-pr-flow-rollout-mechanism.md](2026-06-30-pr-flow-rollout-mechanism.md) (the #1996 substrate this extends)

Focused survey for moving lane landing out of the producing run into a **deferred merge queue drained by
a unified command**. Ground already covered by #1996's report (clone/lane/push machinery, per-lane ports,
auto-merge-on-green) is not re-surveyed; this covers the *new* ground: the queue-drain substrate, the
cross-repo atomicity question, and the ParallelChange lock-release strategy.

## 1. GitHub native merge queue — per-repo only, self-merge supported

- [Managing a merge queue (GitHub Docs)](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) —
  Per-repository only; **no cross-repo coordination anywhere in the docs.** Groups queued PRs, creates
  temporary `gh-readonly-queue/{base}` branches, runs the base branch's required checks against the
  *merged* tree (PR changes on top of base + PRs ahead in the queue), merges FIFO.
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  + [community #15890](https://github.com/orgs/community/discussions/15890) — Required approvals can be **0**
  ("merging can be performed automatically with 0 approving reviews"); an author can land their own PR. The
  only self-service block is "an author cannot approve their own PR" — moot at 0 required.

**Takeaway:** GitHub's queue is a single-repo, FIFO, speculative-merge gate keyed on required checks +
branch protection. Author self-merge with zero reviewers is fully supported. **No cross-repository primitive.**

## 2. The speculative-merge invariant (Not-Rocket-Science-Rule) — the correctness floor

- [graydon — The Not Rocket Science Rule](https://graydon2.dreamwidth.org/1597.html) — test the *temporary
  merged revision*, advance the integration branch iff it passes. Gate on the merged result, not the tip.
- [bors-ng](https://github.com/bors-ng/bors-ng) — canonical impl: batch reviewed PRs onto `staging`, test
  there, fast-forward `main` only on pass.
- [Zuul — Project Gating](https://zuul-ci.org/docs/zuul/latest/gating.html) — tests the *speculative future
  state* (queue merged), not the tip.

**Takeaway:** All three enforce the same invariant. WE already codifies it
([`#gate-on-merged-tree-lane-fast-fail`](../docs/agent/platform-decisions.md)). A deferred queue **must
still run the full gate on the merged tree per merge** to keep it — which the drain does.

## 3. Cross-repo atomic landing — the claim is only half-right

- [Aviator ChangeSets](https://docs.aviator.co/mergequeue/concepts/changesets) — **dispositive
  counterexample:** groups PRs "within the same repository **or across multiple repositories**", merged
  all-or-nothing ("if validation fails … none of the PRs will be merged"). Cross-repo atomic landing *is*
  solved off-the-shelf. (Fixed cross-repo *order* not documented on that page.)
- [Zuul cross-project dependencies](https://zuul-ci.org/docs/zuul/latest/gating.html) — `Depends-On:` forms
  a cross-repo DAG **serialized in a fixed order**, tested + merged together.
- [Mergify batches](https://docs.mergify.com/merge-queue/batches/) / [Graphite](https://graphite.com/guides/merge-queue-tools-options) —
  multi-*project-within-one-repo* / stacked PRs; neither does cross-*repository* atomic landing.

**Takeaway:** The item's "cross-repo couples need custom sequencing" is correct **only given a GitHub-native
constraint.** Off-the-shelf cross-repo atomic (Aviator) and ordered (Zuul) landing exist — but as external
SaaS/CI, not `gh`. Since WE commits to GitHub-native primitives (`gh`, no external merge SaaS), custom
sequencing for cross-repo couples is genuinely required — reword as "GitHub-native queues don't do
cross-repo," not "nobody does." (Adopting Aviator/Zuul is a real, separately-rejectable alternative.)

## 4. ParallelChange / expand-contract — additive lands ahead of consumers

- [Martin Fowler — ParallelChange](https://martinfowler.com/bliki/ParallelChange.html) — **expand**
  (additive, backward-compatible), **migrate** (move consumers), **contract** (remove old). "New changes
  can be introduced incrementally without affecting [existing clients]"; code can release in any phase.

**Takeaway:** The expand hunk is backward-compatible, so it **can land ahead of its consumers** — a
rename/signature change (breaking) cannot. Extracting the additive part of a shared file as an early
micro-merge that lands out-of-order (releasing the lock before the bulk change finishes) is a textbook
expand-phase move; only the non-additive remainder must stay coupled. Confirms Fork 3 (c).

## 5. Deferred / batched draining (trains) — established prior art

- [GitLab merge trains](https://docs.gitlab.com/ci/pipelines/merge_trains/) — decouples "added to train"
  from "merged": each MR pretend-merges on the prior, runs CI, merges when green; a separate process drains.
- [bors-ng batches](https://github.com/bors-ng/bors-ng) — PRs accumulate while a batch runs; a separate bot
  drains, not the CI-green moment on each PR.

**Takeaway:** Decoupling "ready" from "merged" via a separately-drained queue is well-established. The
novelty here is the drain being a *manual command* (not an always-on bot) plus cross-repo ordering — a
variant, not a correctness risk. Fork 1's "the drain could later be scheduled" restores the always-on form.

## Net findings for the decision

1. **GitHub native merge queue is per-repo only** — cross-repo couples can't ride it; the custom drain
   owns cross-repo order. (Confirms the hybrid in Fork 5.)
2. **Author self-merge at 0 required reviewers is fully supported** — "self-approved PR" is real; ground
   state already verified (`gh` authed as `chalbert`, `main` unprotected — #2152).
3. **Gate-on-merged-tree is the settled correctness floor** — the drain must run the full gate per merge
   (already the integrator contract); no fork may weaken it.
4. **Cross-repo atomic landing exists off-the-shelf (Aviator/Zuul)** — so "custom sequencing required" is
   scoped to the GitHub-native constraint, not universal; adopting an external queue is a documented,
   rejected-on-lock-in alternative.
5. **ParallelChange supports out-of-order additive landing** — Fork 3 (c)'s early micro-merge is a valid
   expand-phase application; only non-additive deltas fall back to (a)/(b).
6. **Deferred/train draining is prior art** — the design is a manual-drain variant, not a novel risk.
