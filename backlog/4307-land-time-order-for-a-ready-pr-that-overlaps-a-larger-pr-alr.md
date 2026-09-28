---
bornAs: xgos7st
kind: decision
status: resolved
dateOpened: "2026-09-27"
dateResolved: "2026-09-27"
codifiedIn: "docs/agent/platform-decisions.md#drain-overlap-yield-landing-order"
preparedDate: "2026-09-27"
preparedAgainstSha: "f1c0fee1dd6dc21b3eb8bbe23e4f7eb06f25e74d"
tags: []
---

# Land-time order for a ready PR that overlaps a larger PR already in review: yield, or land first and make the rebase cheap

Large daemon PRs keep drifting into conflict with main because smaller overlapping PRs land ahead of them while they sit in review (PR 2821, 20 files, conflicted twice on 2026-09-27; each conflict cost a fixer round, CI and a re-review). The drain (we:scripts/merge-ai-prs.mjs) lands whatever is ready, in item order, with no notion of an open overlapping PR still in review. Forks: should the drain briefly hold a ready PR that overlaps a larger PR in review (bounded yield), and, separately, may a PR keep its review after a clean mechanical rebase?

**Status: RATIFIED (Fork 1 + Fork 3), Fork 2 split out.** See the ruling block at the end. The forks below carry options, tradeoffs and a bold default that already survived an independent Codex review of the build card (recorded on #4308): it added the status-quo and eligible-only options, split review carry-over into its own fork, and showed an overlap-only size order can cycle — all folded in below. Fork 2 (review carry-over after a mechanical rebase) is **not** ruled here; it is carved out to its own decision, [4310](/backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or/), per the repo convention that one decision card carries one ruling — status quo is its default meanwhile.

## Context

- **The cost, measured on one PR.** #2821 (`lane/fix-procedure`, 20 files, +1807/−118) opened 18:26Z. #2826 merged at 20:30Z, touching `we:scripts/conveyor/review-status-tag.mjs`, which #2821 also changes. The conflict watch labelled #2821 `merge-status:conflicting` at 20:32Z. The conflict was cleared at 21:16Z. That is 44 minutes, two fixer sessions (one a duplicate, see #4306), a full CI run and a fresh review round. Earlier the same day #2819 conflicted with it in `we:scripts/operations/ci-heal-pr-dispatch.mjs`.
- **What the drain does today.** `we:scripts/merge-ai-prs.mjs#planLabelDrain` (near line 1901) orders ready PRs by `blockedBy`/`stackParents` edges, then by item number, then by PR number (near line 2013). It knows nothing about an open PR that is NOT ready. Its only conflict help is at land time for the PR being landed (the manifest rebase-drop and the non-overlapping-hunk auto-resolve, #2198 and #2371).
- **Existing overlap machinery.** `we:scripts/readiness/overlap-chain.mjs` stacks overlapping items at AUTHORING time, inside one serial batch. #4295 (4295) will serialize overlapping BUILD dispatches. Neither sees work that was dispatched outside the build daemon, or two PRs that are both already open. #2821 and #2826 were both orchestrator-dispatched fixes.

## Fork 1 — land-time ORDER when a ready PR overlaps an open PR in review

- **Status quo.** Keep landing ready work in today's order. The PR that lands second pays the conflict through the existing conflict watch and fixer. Nothing new to trust or tune. This is the baseline every other option must beat on measured cost.
- **A. Bounded yield (proposed default).** Hold the ready PR X (a `deferred` entry, `waitOn: ['overlap-yield:#Y']`) while a larger overlapping PR Y is in final review, inside a per-X budget counted from X's own `ready-to-merge` label. Larger means one global order (total changed lines, then PR number), so yields cannot cycle. Tradeoff: X waits up to its budget, and the conflict is not removed, only moved to the smaller PR, whose re-land has less to re-review and re-test. That benefit is a hypothesis to measure, not a given.
- **A′. Order only among PRs that are all eligible to merge.** Only when X and Y are BOTH ready in the same pass, land the larger first. Never hold X for a PR still in review. Tradeoff: it never delays anything, but it would not have helped #2821, which was in review, not ready, when #2826 landed.
- **C. Stack X on Y at land time.** Rebase X onto Y's head so X can only land after Y. Tradeoff: it couples X to Y's fate. If Y bounces or stalls, X is stuck behind unreviewed code, and the proof-of-land gate for stacks (#2393) is built for authoring-time stacks, not ones the drain would create itself.
- **D. GitHub merge queue.** Rejected: #2138 and #2153 ruled the deferred drain as the landing transport, and a merge queue orders by enqueue time, not by overlap.
- **E. Smaller slices only.** Not a land-time option. Authoring guidance already says to split anything over size 8, and #2821 still happened. It stays upstream advice.

**Ratified default: A.** It is the only option that would have protected #2821 without coupling two PRs' fates. The per-X budget keeps its worst case bounded. **Operator framing (2026-09-27):** this is a conflict-**COST** strategy — deciding who pays for the reconciliation, and stopping repeated knock-backs of a big PR — not a conflict-**reduction** strategy. Dispatch-time overlap avoidance (#4295 / 4295) is the reduction layer; the two compose (4295 prevents some overlaps from being dispatched at all, A decides land order for whatever overlaps still occur).

**Skeptic:** attacked on merit (does A actually help vs. status quo / A′ / stacking?) and on statute-overlap (does this collide with #2138/#2153's deferred-drain-as-transport ruling, or with the #4295 dispatch-time coordination?). Survives: A is strictly narrower than #4295 (land-time, actual-files, every open PR vs. dispatch-time, declared-scope, daemon-claimed work only) and doesn't touch the sole-writer-drain transport ([#pr-flow-rollout-mechanism](docs/agent/platform-decisions.md#pr-flow-rollout-mechanism)) — it only reorders what that one writer lands next. A′ is rejected on the record (#2821 was in review, not ready, when #2826 landed, so A′ would not have helped); stacking (C) is rejected for coupling X to Y's unreviewed fate. No collision found.
**Screen:** clear — this rules an observable drain-ordering *policy*, not an implementation detail (any drain impl could realize "yield" differently), and a real merit difference survives even with both branches "free to build": A protects #2821-shaped incidents, status quo does not.

## Fork 2 — may a rebased PR keep its review? (independent of Fork 1)

This is a separate axis, not an alternative to A: it changes what a conflict COSTS, whatever the order.

**NOT ruled here.** Split out to its own decision, [4310](/backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or/) (operator ruling, 2026-09-27) — this repo's convention is one ruling per decision card, and Fork 2's trust/red-team question is a materially separate research task from Fork 1's ordering question. **Default meanwhile: status quo** (any conflict resolution, however it arose, sends the PR through a fresh review round) — unchanged by this ruling.

## Fork 3 — making A mechanical

- "Larger": total changed lines of the PR (sum of per-file counts), then lower PR number. **Ratified default.** It is a total order, so it cannot cycle. An overlap-only measure is more precise but can cycle across three PRs.
- "Final review": Y is open, not a draft, on the same base as X, not `review:changes`, and carries `review:pending` or `review:accepted`; and Y does not depend on X. **Ratified default.**
- Budget: 45 minutes per X from its own ready label, **non-renewable** (X yields at most once per ready-label epoch; once its budget elapses it never yields again until its head changes and it is re-labelled). **Ratified as a trial starting value**, not a settled constant. It rests on one incident (the #2821 conflict took 44 minutes end to end), so it ships as a **setting** (below), is logged on every yield, and is revisited after the first week of live yield data.

**Skeptic:** attacked on cycle-safety (does the global order + non-renewable budget actually bound every PR's wait?) — survives: rule 3's total order (never a per-pair overlap measure) plus rule 6's per-X budget counted from X's own ready label (never from Y's review round) together rule out both a cycle and an unbounded wait, per #4308's own build-time proof plan (tests 1 and the "chain of blockers" case).
**Screen:** clear — "which fields define larger/final-review/budget" is a mechanical parameterization of the Fork 1 policy, not a second merit fork in disguise, and a real difference in outcome (cyclable vs. not) separates the ratified default from an overlap-only measure.

## Ruling — RATIFIED (operator, 2026-09-27, ~18:00 ET, given in chat)

1. **Fork 1 → A (bounded yield), as designed on #4308.** A small ready PR yields to a larger overlapping PR in final review, for one non-renewable 45-minute budget counted from the small PR's own `ready-to-merge` label, ranked by the global size order in Fork 3, with exemptions for blockers/dependencies/an unknown file list (#4308 rules 4–5).
2. **Must be configurable by settings — not just a CLI flag.** Both the window length and an on/off switch live in the repo's normal settings/config mechanism (a **tracked, committed**, defaults-in-code JSON config file beside the affected script — never only a `--overlap-yield-window` CLI flag or an env var read at process start). It borrows the sanctioned-CLI-verb and write-guard *shape* of `we:scripts/build-queue-config.json`, but **not** its git-ignored status: this switch steers the **resident** drain daemon, which self-updates from `main` and never sees a local uncommitted file, so a git-ignored copy would strand an operator's edit (corrected during #4308's second Codex pass; see #4308's Window section). Concretely: `we:scripts/drain-overlap-yield-config.json` (committed, landed via lane→PR like any repo change; absent or malformed ⇒ the defaults below), `{ "enabled": boolean, "windowMinutes": number }`, read by the drain at plan time, edited only through a sanctioned CLI verb (mirroring `we:scripts/backlog.mjs weights`), never hand-edited. The existing CLI flags/env var (#4308's Interfaces section) may remain as a one-off override *on top of* the settings file, but the settings file is the durable, discoverable knob — a flag nobody remembers to pass is not "configurable."
3. **Activated (on) by default, for now, as a trial.** `enabled: true`, `windowMinutes: 45` are the shipped defaults. Log every yield (which PR yielded, to which, the computed rank, the release time/reason) so the trial has real data. Revisit the window value after a week of live yields — this is a starting value anchored to one incident, not a measured optimum (Fork 3).
4. **Framing, for anyone re-deriving this later:** this ruling is a conflict-**cost** strategy (who pays for reconciling an unavoidable overlap, and ending the repeated knock-backs of one large PR), never a conflict-**reduction** strategy. Dispatch-time overlap avoidance (#4295 / 4295) is the reduction layer and composes with this rather than duplicating it.
5. **Fork 2 (review carry-over after a mechanical rebase) is NOT ruled.** Split to [4310](/backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or/); status quo (always re-review) stands as its default until that item is prepared and ratified separately.

Codified in [drain-overlap-yield-landing-order](docs/agent/platform-decisions.md#drain-overlap-yield-landing-order). Build card: #4308 (re-checked against this exact ruling before it is stamped prepared).
