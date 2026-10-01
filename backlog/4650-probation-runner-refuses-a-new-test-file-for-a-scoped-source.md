---
bornAs: x4tnq84
kind: story
size: 2
status: resolved
scope: ["we:scripts/operations/probation-build-run.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Probation runner refuses a new test file for a scoped source; prepare should declare test paths

Live 2026-09-30: we:scripts/operations/probation-build-run.mjs ran #4389 (bugfix, Codex; scope we:scripts/merge-ai-prs.mjs). Codex added the regression test we:scripts/__tests__/merge-ai-prs-merge-failure-isolation.test.mjs, and the runner abandoned the whole build as gate-red at its out-of-scope check (~line 442) — the work was thrown away although a new test for the scoped file is exactly what the brief asks for. Root cause is two-sided: prepare stamps a scope with no test path, and the runner has no notion of a scoped source owning its tests. Fix: (1) the prepare brief/stamp requires the test file(s) in scope (existing or new, e.g. a we:scripts/__tests__/<name>*.test.mjs pattern); (2) the runner treats a NEW test file whose name starts with a scoped source basename, under the matching __tests__ dir, as in scope, and still refuses any other path. Proof: re-run #4389 and show it builds; show an unrelated out-of-scope edit is still refused.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/probation-build-run.test.mjs` (strip the `we:` locator prefix when executing). The incident regression fails before this change and passes after; guard cases must remain green.

## Design

In we:scripts/operations/probation-build-run.mjs, extend the prepare brief with matching test paths and validate their presence before stamping. Permit only additive matching test entries in prepare scope; retain every existing entry and all other frontmatter guards. Support the narrow sibling pattern `we:scripts/__tests__/merge-ai-prs*.test.mjs` without allowing wildcards across directories. For legacy source-only build scopes, admit a newly added sibling test whose basename starts with the scoped source basename. Observe additions from Git against the pre-worker base, including staged and intent-to-add files. Apply ownership independently to the card and lease, keeping existing undeclared tests, foreign scopes, unrelated paths, statute checks and task envelopes refused.

## Progress

- Before: the #4389 regression returned `gate-red` for the new matching test; a source preparation without test scope incorrectly stamped and returned `opened-pr`. The focused run recorded those two failures alongside #4646's failure, with 120 existing/guard assertions passing.
- After: the #4389 replay reaches the gated build publication callback with both the scoped source and new regression test. Missing test scope refuses stamping; the brief names the matching pattern. Guards continue refusing existing undeclared tests, unrelated tests, wrong directories, helper modules, unrelated source files, and a lease excluding the owning source.
- Proof boundary: the checkout-card replay uses real Git/file IO in a temporary clone with the actual #4389 card and the incident's exact test filename. Worker edits and publication are simulated; this proves runner acceptance, not implementation of #4389 or a live published build. No fresh Codex build, commit, push, or PR was performed under this job's no-publication rule.

- Verification: the wider `node we:scripts/verify-lane.mjs run` selection passed 341 tests across 6 files and `npm run check:standards` reported 0 errors. The final matching-test adjustment passed all 9 targeted ownership cases, including test-fix mode. The default verifier was attempted but the sandbox denied its we:.git marker write; marker-free mode used a temporary coordination root because shared admission storage was also read-only. No gate or assertion was weakened.
- Resolution: `node we:scripts/operations/run.mjs resolve --ref=4650` completed with one effect applied.

## Follow-ups

Re-run #4389 with the deployed runner when publication is authorized. New regression filenames need real Git addition evidence; a zero-deletion numstat alone cannot distinguish a new file from an existing file with appended lines.
