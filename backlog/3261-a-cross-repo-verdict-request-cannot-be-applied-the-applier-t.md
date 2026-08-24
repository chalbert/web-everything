---
bornAs: xko2emh
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# a cross-repo verdict request cannot be applied — the applier token is repo-scoped

`we:.github/workflows/apply-review-request.yml` runs with a GH_TOKEN scoped to web-everything, so a request naming another repo fails: GraphQL: Could not resolve to a Repository with the name chalbert/plateau-app. Observed live — run 49 of that workflow is the only failure in fifty, and it is the one cross-repo request. The review itself was performed correctly and its verdict is real, but it cannot be recorded through the transport, so plateau-app#144 stays parked with review:pending and no way to clear it from a credential-less host. This is the third facet of the cross-repo review gap, after #3137 (the CLI cannot express a cross-repo subject read) and #3257 (the request filename is not repo-injective) — and the only one that blocks outright rather than degrading.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## The evidence

`we:.github/workflows/apply-review-request.yml`, run 49 — the only failure in fifty runs, and the only cross-repo request among them:

```
ops/review-requests/144-accepted.json
GraphQL: Could not resolve to a Repository with the name 'chalbert/plateau-app'. (repository)
```

Every WE-targeted request in the same workflow succeeded before and after it. The token is the difference, not the request.

## Why it is worth its own card rather than a note on #3137

The three facets fail at different layers and want different fixes:

| facet | layer | severity |
| --- | --- | --- |
| #3137 — the CLI cannot express a cross-repo subject read | argv surface | worked around (`createReviewPrReader({ cwd })` is a documented seam) |
| #3257 — the request filename is not repo-injective | transport naming | silent verdict loss when two repos share a PR number |
| **this** — the applier's token is repo-scoped | transport authority | **blocks outright**; nothing is applied and the run fails loudly |

This one is the only one that fails LOUDLY, which is the good news: the review is not silently discarded, it visibly does not land.

## What it costs today

`plateau-app#144` was reviewed correctly — `accept`, zero findings, net basis resolved against plateau-app's own main — and the verdict cannot be recorded. The PR stays `review:pending` with no route to clear it from a credential-less host. The review effort was real and is stranded.

## Directions (not ruled)

- **Widen the token** the WE applier runs with, so it can reach the constellation's repos. Smallest change; concentrates authority in one workflow, which is the reason to think before doing it.
- **Give each repo its own applier**, reading the same shared transport branch. Keeps each token scoped to its own repo; costs a workflow per repo and a shared-branch read from each.
- **Route the request to the target repo's own transport branch** rather than WE's. Most symmetric, and it interacts directly with #3257's naming question — worth deciding the two together.

## Done when

1. **Executable** — a verdict request naming a repo other than the applier's own is applied successfully, or refused with a reason that names the token scope rather than a raw GraphQL error.
2. `plateau-app#144`'s accepted verdict is recorded by whichever route is chosen.
3. The choice is reconciled with #3257 — request naming and request routing are the same decision seen twice.

## THE CALL (operator, 2026-08-24): each repo owns its own notes

Ruled on a **scaling test**: *"if we had 100 repos, I cannot imagine all would be in one repo — seems better to have each repo own the notes."*

The verdict request goes to the **target repo's own `ops/review-requests` branch**, applied by that repo's own workflow with its own repo-scoped token. Not a wider key on one central applier, and not per-repo appliers reading a foreign repo's branch.

### Why the scaling test is decisive

A central board does not merely get large at N repos — it gets **structurally wrong**. Repo #57's approvals would live in `web-everything` for no reason other than that it was first, and every one of the 100 appliers would need cross-repo READ on a branch it does not own. The per-repo form needs no cross-repo authority anywhere: each side touches only itself.

### It dissolves #3257 rather than deferring it

`#3257` (the request filename is keyed by PR number alone, so two repos collide) exists **only because one board holds several repos' notes**. Give each repo its own board and PR numbers are unique within it: a request named for PR 144 is unambiguous, no rename is needed, and the transition problem that card describes — a collector that must read both names until the branch drains — never arises. Two defects, one decision.

### Feasibility, checked rather than assumed

- **The writer can reach a sibling repo.** `git push --dry-run origin HEAD:refs/heads/ops/review-requests` against `plateau-app` succeeds from this credential-less host. `git push` is credentialed here even though `gh` is not — which is the whole reason the file transport exists.
- **A multi-repo consumer is the existing shape.** `we:scripts/merge-ai-prs.mjs` already *"sweeps ALL 3 constellation repos BY DEFAULT"* in one blockedBy cascade, so a drain reading N boards is not a new burden.

### The cost, stated

N repos means N workflow files. A reusable/called workflow keeps that to one definition and N one-line callers, which is the same shape the per-repo applier would have needed anyway. This is a real cost and it is the one the ruling accepts.

### One interaction to settle with #3255, NOT silently

`#3214` ruled the verdict **ledger** onto *"the `ops/review-requests` branch"* — phrased when there was only one such branch. If notes are per-repo, the ledger's home has to be decided explicitly: per-repo boards too (consistent with this ruling, and the drain already reads N repos), or one designated board (consistent with a single merge authority). `#3255` is the build that answers it, and it must not pick one by accident.

## Done when

1. **Executable** — a verdict request for a PR in repo X is staged onto **X's own** `ops/review-requests` branch and applied by X's own workflow. Red today (it goes to web-everything's branch and 403s), green after.
2. **Executable** — the request filename needs no repo component, because per-board PR numbers are unique. `#3257` is closed as dissolved rather than fixed.
3. The applier workflow is defined once and called per repo, not copied N times.
4. `#3255` states which home the ledger takes, with this ruling cited either way.
