---
kind: task
status: resolved
relatedTo: ["2138"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: [pr-flow, branch-protection, ci, session-tooling]
---

# Configure main branch protection for self-approved PR landing

The PR-only landing flow (#2138, ruled) needs main's branch protection set so a session lands its own lane through a PR without an external reviewer, while still requiring green CI. Configure: require the CI status check (#2151, done), require branches up-to-date before merge, and 0 required approving reviews (author self-merge) — the practical 'self-approved PR'. Per #2138 Fork 5, do **NOT** enable GitHub's native merge queue — the custom drain (#2153) owns every merge in impl-first/WE-last order; a branch-level queue would reorder couples.

**Ground state (verified 2026-07-02):** `gh` is authed as `chalbert`, and `main` currently has **no branch protection** (`gh api .../branches/main/protection` → 404) — so this is a clean slate to configure via `gh api`, nothing to override.

## Progress

**Applied 2026-07-02** via `PUT /repos/chalbert/web-everything/branches/main/protection`:

- `required_status_checks`: `strict: true` (branches up-to-date before merge), `contexts: ["test"]` — the `test` job from `we:.github/workflows/ci.yml` (unit+coverage, `check:standards`, interaction lane; the #2151 PR-trigger check).
- `required_pull_request_reviews`: `required_approving_review_count: 0` — self-approved PR (author merges own PR, no external reviewer).
- `enforce_admins: false` — **deliberate**: admins bypass protection, so the retained `git push origin main` fallback (#2138 Fork-5 "local `git merge` retained fallback") keeps working. Flipping protection does *not* brick today's direct-push landing before #2153's PR-drain is adopted; it only gates non-admin merges through the self-approved-PR path.
- `restrictions: null`, and **GitHub native merge queue left OFF** (per #2138 Fork 5 — the custom drain owns couple-order).

Verify: `gh api repos/:owner/:repo/branches/main/protection --jq '{strict:.required_status_checks.strict, contexts:.required_status_checks.contexts, admins:.enforce_admins.enabled, reviews:.required_pull_request_reviews.required_approving_review_count}'`.

Unblocks #2153 (the PR-based drain that lands lanes via `gh pr create`/`gh pr merge`).
