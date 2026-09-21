---
bornAs: xj0174p
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:.github/workflows/ci.yml", "we:.github/workflows/review-gate.yml"]
dateOpened: "2026-09-13"
dateResolved: "2026-09-21"
graduatedTo: none
tags: [ci, poc-branch]
---

# Allow GitHub Actions CI to be enabled for POC branches, not just main

we:.github/workflows/ci.yml and we:.github/workflows/review-gate.yml both trigger only on
`pull_request.branches: [main]`, so any PR based on a registered POC branch (e.g.
`lane/mechanical-dispatcher`) structurally never gets real GitHub Actions CI — verification for
such a PR today relies entirely on local runs (we:scripts/verify-lane.mjs, manual
`npm run test:unit` / `check:standards`), never an actual CI gate. Confirmed live while resolving
PR #2156.

Extend or parameterize the CI workflow triggers so a registered POC branch — per the registry in
we:scripts/lib/poc-branches.mjs, the existing POC-branch delivery-mode mechanism ratified earlier
this epic — can opt into having its own PRs trigger real CI, not just PRs targeting `main`.

This connects to the already-ratified POC-branch doctrine
(we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode): POC branches deliberately
skip full human review, but that is a distinct concern from CI verification — they still deserve a
real, automated CI gate on their own PRs.

## Finding (2026-09-21): whether to do this at all is now a decision card

Whether the prototype gets CI on its pull requests, or the drain's required check changes instead, or neither (no pull requests against the prototype), is decision card 3805, `relatedTo` this card and #3674. Both workflow files still trigger on `main` only, and no pull request has been opened against the prototype since 2026-09-15; hold this card until that ruling.

## Resolved as superseded (2026-09-21, #3805)

#3805 ruled Fork 1 (c): the prototype branch gets no CI of its own. Pull requests are not its delivery path (direct push and `poc-land`, gated by the item's own tests); CI runs at each graduation pull request to `main`. Nothing here is built. The silent-stall side is #3674, rescoped to a drain hold.

## Done when

1. **Executable** — a PR opened against a registered POC branch (per
   we:scripts/lib/poc-branches.mjs) triggers we:.github/workflows/ci.yml (or an equivalent CI job)
   and the run shows up as a required/visible check on that PR, not just on PRs targeting `main`.
