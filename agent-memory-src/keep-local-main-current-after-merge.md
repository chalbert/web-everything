---
name: keep-local-main-current-after-merge
description: After every PR merge, local main must be fast-forwarded to origin — use pull --ff-only --autostash so the dirty tree never blocks it
metadata:
  type: feedback
---

The user wants **local `main` kept up to date after each PR merge** (feedback 2026-07-03, after every `/merge`
left it behind with "local main NOT fast-forwarded — pull by hand").

**Why:** under [[104-feedback_commit_to_default_branch_ok]] + #2183, local `main` never diverges (edits land
via PR, not direct commits), so the post-merge sync is a **pure fast-forward**. It only ever "failed" because
a bare `git pull --ff-only` aborts the moment ANY incoming file is also locally-modified — and the working
tree is almost always dirty (session state like `claims.json`, mid-edit docs). It was never a real divergence.

**How to apply:** the sync must be `git pull --ff-only --autostash` — autostash sets the dirty edits aside,
fast-forwards, then reapplies them, so `main` advances AND local edits are preserved. Still ff-only (never
rebase/force). Wired into the `/merge` lander (`we:scripts/merge-ai-prs.mjs` post-merge sync). To reconcile a
tree that fell behind: `git pull --ff-only --autostash` (0-ahead/N-behind = a clean ff; only a genuinely
overlapping reapplied edit surfaces a normal stash-pop conflict).
