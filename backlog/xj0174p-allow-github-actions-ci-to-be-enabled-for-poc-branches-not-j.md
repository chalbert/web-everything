---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:.github/workflows/ci.yml", "we:.github/workflows/review-gate.yml"]
dateOpened: "2026-09-13"
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

## Done when

1. **Executable** — a PR opened against a registered POC branch (per
   we:scripts/lib/poc-branches.mjs) triggers we:.github/workflows/ci.yml (or an equivalent CI job)
   and the run shows up as a required/visible check on that PR, not just on PRs targeting `main`.
