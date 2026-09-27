---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# merge-ai-prs' persistent PR-commits cache is not invalidated when a PR's base changes with an unchanged head

Still-open Codex advisory finding from chalbert/web-everything#2796's FINAL review round (codex-correctness/correctness, [CONFIRMED then PLAUSIBLE across rounds — same root cause each time]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies. (A sibling finding from earlier review rounds of this same PR, that GraphQL reads get misclassified as writes by classifyGhWrite, no longer appears in the FINAL round's codex-correctness section and was not re-checked here.)

FINDING: we:scripts/merge-ai-prs.mjs's fetchPrCommits persists a successful gh pr view --json commits read to an on-disk cache keyed only by (repo, PR number, HEAD SHA) via readShaCache/writeShaCache, on the stated assumption that a PR's commit list is fixed by its head SHA alone. That assumption does not hold when a PR is retargeted or its base branch advances without the PR's own head changing (a stacked PR whose base moves) — the commit list gh reports for the SAME head SHA can differ once the base changes, but the disk cache keeps returning the OLD list across every subsequent drain process (a fresh process each pass, so the in-memory ctxReadCache/sweepReadCache start empty every time but the disk cache survives). The AI-authorship gate (isAiGeneratedPr) that decides whether a PR is eligible to auto-merge then reasons from a stale commit list.

EVIDENCE: read fetchPrCommits directly off origin/main in we:scripts/merge-ai-prs.mjs — readShaCache/writeShaCache are still keyed by { repo, num, sha: headSha, kind: 'commits' } with no base-branch or base-sha component anywhere in the cache key or in any invalidation check.

PREVENTION (from the reviewer, still owed): add a deterministic drain regression test that changes a PR's base while preserving its head SHA and asserts the authorship decision uses a refreshed commit list — either fold the resolved base state into the cache key, or invalidate the cached entry whenever the recorded base differs from the PR's current base.

Priority: not HIGH (can misclassify one PR's AI-authorship for the merge gate on a base-retarget edge case; does not itself close/resolve the wrong PR, lose data, or suppress healing forever).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
