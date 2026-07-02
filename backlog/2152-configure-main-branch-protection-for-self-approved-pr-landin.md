---
kind: task
status: open
blockedBy: ["2138", "2151"]
relatedTo: ["2138"]
dateOpened: "2026-07-02"
tags: [pr-flow, branch-protection, ci, session-tooling]
---

# Configure main branch protection for self-approved PR landing

Moving automation to a PR-only landing flow (#2138) needs main's branch protection set so a session lands its own lane through a PR without an external reviewer, while still requiring green CI. Configure: require the CI status check (#2151), require branches up to date before merge, and 0 required approving reviews (author self-merge) — the practical form of 'self-approved PR'. Optionally enable GitHub's native merge queue for the single-repo WE case. Blocked by #2138 (requiring PR checks on main breaks today's direct-push landing until the queue-drain flow is ruled) and sequenced after #2151 (a check must exist to require).

**Ground state (verified 2026-07-02):** `gh` is authed as `chalbert`, and `main` currently has **no branch protection** (`gh api .../branches/main/protection` → 404) — so this is a clean slate to configure via `gh api`, nothing to override.
