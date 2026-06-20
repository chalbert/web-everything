---
kind: task
status: open
dateOpened: "2026-06-20"
tags: []
---

# Reconcile claim-no-git-guard test with the claim CLI's two git calls

The #952 reconciliation of the claim-no-git-guard regression test (scripts/backlog claim-no-git-guard test) asserts exactly ONE execFileSync('git') in we:scripts/backlog.mjs, but the file now has TWO: the #510-reconciled claim-first dirty-guard probe (git status --porcelain -- <rel>) and the #952 attribution-baseline snapshot (git status --porcelain). The suite is red on committed code (2 git-call failures). Fix: update the test's count assertion to admit the claim-first guard's call (or consolidate the two reads), keeping #510's invariant that the tree is never a claim PRECONDITION. Surfaced during #487's close-out vitest run; not caused by #487.
