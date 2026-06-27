---
name: feedback_commit_to_default_branch_ok
description: "Commit on whatever branch is checked out, never branch-first: solo has no PR flow AND `git checkout -b` corrupts concurrent sessions sharing the checkout"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b295cc6-d99a-4ee9-8ba4-ebdfc2c278af
---

The user is a **single developer**, so committing straight to a repo's **default branch (`main`)** is
acceptable across the constellation (webeverything, frontierui, plateau-app, …). Do **not** create a
feature branch first, and do **not** ask whether commits-on-main are OK — just commit to the target repo
on whatever branch it's on.

**Why:** the "branch first if on the default branch" harness default assumes a team/PR flow; for a solo
dev it's pure friction with no reviewer to protect. Confirmed 2026-06-14 after a batch landed 2 frontierui
commits on `main` ("all ok on main for now — I am a single dev").

**How to apply:** keep committing per finished piece to its `commitTarget` repo (see
[[feedback_no_commit_talk_in_backlog]]) — staging only that piece's files, **still never `push`** — and
skip the branch-first step / the "want me to move these to a branch?" question entirely. The never-push
rule is unchanged; only the branch-first/ask-about-main behavior is waived.

**Stronger reason — shared checkouts (folded from feedback-no-branches-in-shared-checkouts, 2026-06-22).**
The constellation checkouts are **shared across concurrent agent sessions**; `git checkout -b` / `switch -c`
changes the checkout's HEAD for **every** session at once, so other sessions then unknowingly commit their
work onto your branch (observed 2026-06-22: branched `explorer/cli-autonomy` off frontierui `main`; while it
was checked out, 4 other sessions committed their work onto it thinking they were on `main`). So **never**
branch in these repos — for any reason, not just solo convenience. Recover a stray branch without losing
work: `git branch -f <intended> <stray-tip>` (ff-only) → `git checkout <intended>` (same commit, tree
preserved) → `git branch -d <stray>`; never reset/force-delete; verify with `git reflog`.
