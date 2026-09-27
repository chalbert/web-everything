---
bornAs: xei9oen
kind: task
parent: "4075"
status: open
scope: ["we:.github/workflows/soak-replay-gate.yml"]
dateOpened: "2026-09-27"
tags: []
---

# soak-replay-gate workflow's two-endpoint diff counts main's own unrelated breaks/ changes as the PR's

Still-open Codex advisory finding from chalbert/web-everything#2775 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: the we:.github/workflows/soak-replay-gate.yml step computes the changed-file list with a plain two-endpoint diff — git diff --name-status -M "$BASE_SHA" "$HEAD_SHA" — comparing the PR's base sha directly against its head sha, rather than a merge-base-to-head diff. Whenever a PR is behind main and main has independently modified an existing breaks/ file since the branch diverged, this two-endpoint diff reports that file as touched by the PR even though the PR's own branch never changed it. Depending on isLikelyDaemonBugFix's classification of the PR, this can make the gate wrongly treat an unrelated file under scripts/conveyor/soak/breaks/ as if the PR itself added/changed a break scenario — i.e. the gate can pass a fix with no real soak replay at all, or (the opposite direction) flag a PR that never touched daemon-soak scope.

EVIDENCE: read we:.github/workflows/soak-replay-gate.yml directly off origin/main — the fetch/diff step still does git fetch origin "$HEAD_SHA" --depth=1 followed by git diff --name-status -M "$BASE_SHA" "$HEAD_SHA", with no merge-base computation anywhere in the workflow.

PREVENTION (from the reviewer, still owed): add a deterministic Git-history integration test with a divergent base and head, requiring the diff to be computed from the merge-base (e.g. git diff --name-status -M "$(git merge-base "$BASE_SHA" "$HEAD_SHA")" "$HEAD_SHA") so a base-only breaks/ change never counts as the PR's own.

Priority: not HIGH (a gate-accuracy gap that can wrongly pass or wrongly flag one PR's soak-replay requirement, not a close/resolve of the wrong PR, not data loss, not indefinite healing suppression).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
