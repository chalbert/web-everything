# GitHub App GraphQL spend: meter and git reads

The independent review's findings 1–3 are correct about the attribution defect: a shared
`X-Ratelimit-Used` delta is not the cost of the response that closes it. This change is a
partial reduction with explicit measurement and equivalence limits, not a verified budget win.

## Before and after

| Step | Before | Changed behavior |
| --- | --- | --- |
| 0, meter | Caller receives a capped shared-counter delta | we:scripts/lib/gh-throttle.mjs captures in-band `rateLimit.cost` and a query hash; we:scripts/lib/gh-spend.mjs uses known cost inside the observed total, including the first response. Unknown/legacy costs remain labeled delta estimates. |
| 0, bypasses | The drain, operator queue, and instrumentation call the real `gh` directly when PATH lacks the App shim | we:scripts/merge-ai-prs.mjs, we:scripts/operations/operator-queue.mjs, and we:scripts/readiness/conveyor-instrument.mjs use the throttle adapter for synchronous calls. No admission algorithm changed. |
| 1, already-done | One merged-PR GraphQL search per item | we:scripts/lib/git-already-done.mjs fetches main, reads merge history, maps JIT-number/bornAs aliases, and applies the existing exclusion filter to actual merge files and messages. Negative answers use zero GitHub calls. Potential implementation matches retain the body-disclaimer guard through fallback. Both dispatcher entry points use this path. |
| 2, PR-limit | One commit-view GraphQL call per eligible PR | we:scripts/lib/git-pr-commits.mjs checks the remote identity, fetches main and head, then reads their commit difference with git-parsed co-author trailers. Missing refs, shallow history, foreign remotes, and fetch failures fall back. we:scripts/lib/pr-limit.mjs retains the existing classifier. |

Both new fallback query shapes in we:scripts/lib/gh-metered-reads.mjs request in-band cost.
Commit pages are paginated. Native gh commands elsewhere still lack in-band cost; their query
hashes are recorded when the trace exposes a query, but their costs must not be called measured.
The async already-done throttle bypass identified in the review was already fixed in this
checkout before these edits. Direct sync imports above were still present; `command -v gh`
resolved to the Homebrew binary, not the App shim. This establishes bypass paths, not their
share of the historical unattributed total. Unattributed traffic is not proven eliminated.

## Observed total and projection

A read-only scan of the host ledger for **2026-09-30 06:03:27.579–12:03:27.579 UTC** found
**40,256 observed App GraphQL points**, summing `max(used)-min(used)` separately per reset
window: **6,709.33 points/hour** over six wall-clock hours. This is a lower bound: unobserved
window edges are excluded. It does not sum caller attribution. The observations include
6,364 response records with limit 6,100 and 35 with limit 5,000; the historical `app` label
alone does not identify individual installations. This aggregate cannot prove that a specific
5,000/hour installation is below its cap.

There were **zero existing in-band cost records**. A real GraphQL cost probe failed with
`lookup api.github.com: no such host`. Network and git metadata restrictions prevent a fresh
production measurement window or authenticated per-shape calibration in this environment.

Using the review's six-hour invocation counts, the projection is:

`after = 6,709.33 - (2,258 / 6 × searchCost × gitAnswerFraction) - (385 / 6 × commitCost × gitReadFraction)`

**Illustrative best case only:** if both shapes cost 1 point and all calls can use git,
then **6,268.83 total App GraphQL points/hour**, saving **440.50/hour (6.6%)**. This is NOT
a projection calibrated from real per-shape costs, and is NOT a claimed achieved reduction.
With only PR-limit eliminated under the same 1-point assumption, the total is **6,645.17/hour**.
Already-done body fallbacks and unavailable git refs reduce savings further. The exact requested
real-cost projection remains unavailable until the new costs are observed on the network.

## Equivalence boundary and checks

Default GitHub merge messages do not contain the PR body. The existing check rejects body-only
“does not resolve #NNN” disclaimers; silently assuming an empty body would change behavior.
This implementation deliberately falls back for possible implementation matches, rather than
claiming every already-done search can be eliminated with equivalent semantics.

A real read-only probe of the existing origin/main history (fetch explicitly omitted only in
this probe) found 2,994 first-parent merges, 56 with older nonstandard messages. Git answered
negative for items 4386 and 4586 and required fallback for 3435. Ancestry checks prevent old
custom merges from invalidating answers for items born later. These were local-history probes,
not evidence of fresh remote state.

we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs pins the real #3084 prepare-merge message,
zero-GitHub sync/async negative paths, body-disclaimer fallback, commit authorship, fetch
failure, in-band costs under concurrent spend, and metered query projection. Existing tests
cover the unchanged classifier and transport byte fidelity. Validation results are recorded
below after the final run.

The requested fetch/rebase was attempted before editing: writing we:.git/FETCH_HEAD and
rebase lock files was denied by the sandbox. The local branch matched the existing origin/main,
but a fresh remote rebase was not possible. No commit, push, or PR was performed.

## Final validation

- Focused `npx vitest related … --run`: **7 files passed; 159 tests passed, 6 existing skips**.
- Full related run over every changed implementation/test file: **262 files passed, 4 failed,
  1 skipped; 12,244 tests passed, 8 failed, 11 skipped**. The eight failures are sandbox
  denials: one loopback socket test in we:scripts/operations/__tests__/http-adapter.test.mjs;
  one home-directory lock write in we:scripts/__tests__/lane-drain-numbering.test.mjs;
  three process-table tests each in we:scripts/operations/__tests__/restart-runner-io-real.test.mjs
  and we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs. Direct socket and
  process-table probes reproduced `EPERM listen` and `ps: Operation not permitted`. No
  implementation-related failures remain in this run, but the full run is **not green**.
- `npm run check:standards`, with a temporary writable admission root, initially passed with
  zero errors. After adding this report, it reports **one error**, the untracked-report guard:
  we:reports/2026-09-30-gh-graphql-spend.md must be staged/committed for that check. The requested
  uncommitted result is preserved; protected git metadata prevents staging here.
- `git diff --check` passed. The final rebase attempt also refused the preserved unstaged
  changes. A successful fresh rebase remains outstanding; no stash or commit was created.
- A real local git-log formatting probe decoded one existing commit, including its author and
  complete subject, through the PR-limit parser. The fetch was explicitly stubbed for this
  offline probe; it does not prove live remote access.
