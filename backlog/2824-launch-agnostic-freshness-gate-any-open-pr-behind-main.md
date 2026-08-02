---
bornAs: xe2wryr
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [drain, conveyor, review, merge, rebase, freshness, gate]
---

# Launch-agnostic freshness gate — any open PR too far behind main is auto-rebased or blocked from merge, regardless of how it was launched

Staleness prevention exists (#2666) but only for **conveyor-launched** PRs. A PR that stales any other way — a human-opened PR, or a review-parked draft that sits while `main` advances — is uncovered. Make the freshness check a property of the PR, not of how it was launched.

## The finding

**Symptom.** WE PR #957 was a review-parked **draft** that sat across several `main` advances. Each replay onto newer `main` re-staled its rebase-sensitive claims (an inventory count, a "not yet filed" line), and nothing auto-refreshed it — because it was never conveyor-launched, so #2666's heal path never watched it.

**Root cause — the freshness heal is keyed on launch origin, not on the PR.** #2666 auto-heals a **conveyor-launched** PR gone BEHIND / red-CI by reconstituting its delivery agent and rebasing onto current `main`. Its triggers (`isCiHealTarget` / `isBehind`, `we:scripts/conveyor/tick-core.mjs`) only fire for PRs the conveyor itself launched and is still watching. A human-opened PR, or a review-parked draft whose delivery agent has long exited, is outside that watch entirely. So "how far behind `main` is this PR" — a property of the PR — is enforced only for one launch channel.

**Why it matters.** Being N-behind `main` is exactly when rebase-fragile content drifts: counts move, cited items land, `we:path:line` loci shift. A PR that is allowed to sit far behind accumulates stale claims and merges a diff that was never re-validated against the `main` it lands on. #2666 proved the heal mechanism works; the gap is only its scope.

## The fix

A **launch-agnostic freshness gate**: the check is a property of the open PR (how far behind `origin/main` it is), applied to **every** open AI PR the same way — conveyor-launched, human-opened, or review-parked — never keyed on launch origin.

### 1. The freshness predicate (single source of truth)

For every open PR, compute its distance behind `origin/main`. When it exceeds a threshold **N** (commits or main-advances behind), the PR is **not fresh** and cannot merge until refreshed. The predicate reads only the PR's own ref vs `origin/main` — it does not consult who launched it or whether a delivery agent is still watching.

### 2. Auto-refresh where safe

A not-fresh PR is **auto-rebased onto current `origin/main`** (reset + cherry-pick of its own commits, the established lane-refresh transport — not a merge commit), then its checks re-run. This is the same reconstitute-and-rebase mechanism #2666 already ships, lifted out of the conveyor-only watch so it can run against any open PR. The review gate is **never** touched by the refresh (mirrors #2666 and #2820): only the base is advanced; a `review:human` / `review:changes` / `review:pending` hold stays owed.

### 3. Block merge until refreshed

If auto-refresh cannot run or has not yet completed, the PR is **blocked from merge** until it is refreshed — the merge predicate refuses a not-fresh PR regardless of `ready-to-merge`, the same AND-not-OR shape #2820 establishes for review holds. Freshness joins review-satisfied and green-CI as a merge precondition, so a stale PR can never land.

## Cross-references

- **#2666** (resolved) — conveyor auto-heals a **launched** PR gone BEHIND / red-CI. This item generalizes its reconstitute-and-rebase heal from *conveyor-launched* to *any open PR*, so a human-opened or review-parked-draft PR is covered too. Reuse its mechanism; do not duplicate it.
- **#2820** — review-hold labels must block merge regardless of `ready-to-merge`. Freshness is a sibling merge precondition: this item makes *stale* another AND-clause on the same merge predicate, using the same "the merger reads the condition directly, no label-timing race" shape.
- **#2822** — conveyor-native self-improvement (the introspect→prevent→gate loop). A freshness gate that runs at PR-open against the current diff is one such standing self-monitor; register it there so the loop owns keeping open PRs fresh.

## Acceptance

- An open PR more than **N** behind `origin/main` is detected as not-fresh **regardless of how it was launched** (conveyor, human, or review-parked draft) — the predicate reads the PR's ref vs `origin/main`, never the launch origin.
- A not-fresh PR is **auto-rebased onto current `origin/main`** (reset + cherry-pick, not a merge commit) and re-checked, **without touching any review-gate label**.
- A not-fresh PR that has not been refreshed **cannot be merged**, even if `ready-to-merge` is present.
- **Reproduce the #957 scenario as the regression case**: a review-parked draft that has fallen N-behind `main` is refreshed (or blocked) by the gate, where #2666's conveyor-only heal would not have fired.
