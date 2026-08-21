---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# the verdict request filename is keyed by PR number alone, so two repos collide

`we:scripts/operations/record-verdict.mjs` stages to `ops/review-requests/<pr>-<to>.json` — no repo in the name. The constellation runs three repos and PR numbers restart per repo, so `chalbert/plateau-app#144` and `chalbert/web-everything#144` resolve to one file and the second request silently overwrites the first: a verdict lost with no error. The request body carries `repo`, so whichever survives is applied to the right PR — the loss is the *other* one, and nothing reports it. This is #1466 recurring one file over: `prViewFileName` was made injective over the repo slug precisely because a flattened name was not and two repos collided onto one view. Dormant while only WE PRs used the transport; live as of the first cross-repo review (plateau-app#144, this session).

## What makes it silent

Both halves of the failure are quiet by construction:

- **The write.** Staging is a git add + commit + push of one path. A second request for the same number is an ordinary content change to an existing file, not a conflict — git has no reason to complain.
- **The apply.** `we:.github/workflows/apply-review-request.yml` collects the paths that changed between two refs and applies each. A request that was overwritten before the collector ran was never a changed path in any window, so it is not skipped-with-a-reason; it simply never existed as far as the applier is concerned.

So the operator sees one verdict applied and no error, with nothing anywhere saying a second was lost.

## Why it is live now and was not before

Until this session the transport only ever carried `chalbert/web-everything` PRs, so the PR number was in fact unique across everything using it. The first cross-repo review (`plateau-app#144`) put a second repo's numbering into the same namespace. The collision needs two open verdicts with the same number in different repos — not exotic in a constellation whose repos are all actively numbered.

## The fix is a shape that already exists

`prViewFileName` in `we:scripts/operations/review-pr-io.mjs` solves exactly this, and its own comment says why it is injective over the repo slug rather than `-`-flattened. Reuse that discipline rather than inventing a second naming rule — a second answer to "where does this request live" is how the reader finds the wrong repo's verdict under the right number.

**Transition matters more than the rename.** A request staged under the old name may be in flight when the new name ships, so the collector must read BOTH until the branch is drained, and the changeover must not orphan a pending verdict. That is the part worth designing; the rename itself is one line.

## Done when

1. **Executable** — two requests for the same PR number in different repos both survive staging and both apply. Red today (the second overwrites the first), green after.
2. **Executable** — a request written under the OLD name is still collected and applied after the change, so nothing in flight is orphaned.
3. The name is derived from the same helper as the PR view's, not a second copy of the rule.
