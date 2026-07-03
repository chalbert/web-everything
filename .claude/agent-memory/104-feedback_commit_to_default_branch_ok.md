---
name: feedback_commit_to_default_branch_ok
description: "Never branch in a shared checkout (`git checkout -b` corrupts concurrent sessions); edits land via a lane-clone -> ready-to-merge PR (#2183/#2190), NOT direct commits to main"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b295cc6-d99a-4ee9-8ba4-ebdfc2c278af
---

**SUPERSEDED in part by #2183/#2190 (2026-07-03): edits no longer commit directly to `main`.** Every
edit-action now runs in an **isolated lane CLONE** (`node scripts/lane-pool.mjs`, #2123) and lands via a
**ready-to-merge PR** (`pr-land --no-wait` + the `ready-to-merge` label); `main` advances only when a drain
(`/merge`/`/drain`) merges that PR. So the old "just commit straight to `main`" guidance below is retired —
but its two hard rules **stand**: (1) **never branch in a shared checkout**, and (2) **never `git push` to
`main` yourself** (a drain lands the PR). The lane clone is precisely how we get isolation *without* branching.

**Why the clone, not a branch (the durable rule):** the constellation checkouts (webeverything, frontierui,
plateau-app) are **shared across concurrent agent sessions**; `git checkout -b` / `switch -c` changes the
checkout's HEAD for **every** session at once, so others then unknowingly commit onto your branch (observed
2026-06-22: branched `explorer/cli-autonomy` off frontierui `main`; while checked out, 4 other sessions
committed their work onto it thinking they were on `main`). A lane clone has its OWN HEAD, so it sidesteps
this entirely. Recover a stray branch without losing work: `git branch -f <intended> <stray-tip>` (ff-only)
→ `git checkout <intended>` → `git branch -d <stray>`; never reset/force-delete; verify with `git reflog`.

**How to apply (post-#2190):** work each finished piece in its lane clone, commit only that piece's files
(explicit paths, never `git add -A`; see [[feedback_no_commit_talk_in_backlog]]), open a ready-to-merge PR,
and stop — never commit to `main`, never branch, never `git push` to `main`. (Historic context: the user is
a single dev — "all ok on main for now" 2026-06-14 — which was why direct-to-`main` was fine pre-#2183; the
PR flow now supersedes it while keeping the same solo, no-team-review ergonomics.)

**Stronger reason — shared checkouts (folded from feedback-no-branches-in-shared-checkouts, 2026-06-22).**
The constellation checkouts are **shared across concurrent agent sessions**; `git checkout -b` / `switch -c`
changes the checkout's HEAD for **every** session at once, so other sessions then unknowingly commit their
work onto your branch (observed 2026-06-22: branched `explorer/cli-autonomy` off frontierui `main`; while it
was checked out, 4 other sessions committed their work onto it thinking they were on `main`). So **never**
branch in these repos — for any reason, not just solo convenience. Recover a stray branch without losing
work: `git branch -f <intended> <stray-tip>` (ff-only) → `git checkout <intended>` (same commit, tree
preserved) → `git branch -d <stray>`; never reset/force-delete; verify with `git reflog`.
