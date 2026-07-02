---
kind: task
status: open
relatedTo: ["2138"]
dateOpened: "2026-07-02"
tags: [pr-flow, branch-protection, ci, session-tooling]
---

# Configure main branch protection for self-approved PR landing

The PR-only landing flow (#2138, ruled) needs main's branch protection set so a session lands its own lane through a PR without an external reviewer, while still requiring green CI. Configure: require the CI status check (#2151, done), require branches up-to-date before merge, and 0 required approving reviews (author self-merge) — the practical 'self-approved PR'. Per #2138 Fork 5, do **NOT** enable GitHub's native merge queue — the custom drain (#2153) owns every merge in impl-first/WE-last order; a branch-level queue would reorder couples.

**Ground state (verified 2026-07-02):** `gh` is authed as `chalbert`, and `main` currently has **no branch protection** (`gh api .../branches/main/protection` → 404) — so this is a clean slate to configure via `gh api`, nothing to override.
