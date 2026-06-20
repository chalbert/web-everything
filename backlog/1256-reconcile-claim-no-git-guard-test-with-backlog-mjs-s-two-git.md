---
kind: task
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: scripts/backlog/__tests__/claim-no-git-guard.test.mjs
tags: []
---

# Reconcile claim-no-git-guard test with the claim CLI's two git calls

The #952 reconciliation of the claim-no-git-guard regression test (scripts/backlog claim-no-git-guard test) asserts exactly ONE execFileSync('git') in we:scripts/backlog.mjs, but the file now has TWO: the #510-reconciled claim-first dirty-guard probe (git status --porcelain -- <rel>) and the #952 attribution-baseline snapshot (git status --porcelain). The suite is red on committed code (2 git-call failures). Fix: update the test's count assertion to admit the claim-first guard's call (or consolidate the two reads), keeping #510's invariant that the tree is never a claim PRECONDITION. Surfaced during #487's close-out vitest run; not caused by #487.

## Progress

Resolved 2026-06-20. Rewrote we:scripts/backlog/__tests__/claim-no-git-guard.test.mjs to pin the
reconciled TWO-read invariant rather than the old one-call proxy: (1) the path-scoped claim-first
guard (`git status --porcelain -- <rel>`, refuses only on the item's OWN file, `--force`-overridable),
and (2) the opt-in `--session` attribution snapshot (`git status --porcelain`, after the status write,
in a try/catch). New assertions: no whole-tree refusal (≤1 unscoped porcelain read), exactly two
`execFileSync('git')` reads, both wrapped in try/catch (best-effort), and the whole-tree snapshot is
the LAST read and comes after `applyTransition` (attribution, not a pre-claim gate). #510's invariant —
the broad tree is never a claim PRECONDITION — is preserved; the only refusal is path-scoped to the
claimed file. Suite green (4/4).
