---
name: drain
description: Launch the deferred merge-queue drain — land the queued `lane/*` couples onto `main` via the standard PR transport, impl-first/WE-last, in cross-item `blockedBy` order. Use when the user asks to "drain the queue", "run the merge monitor/drain", "land the queued lanes", "watch the merge queue", or "clear the ready-to-merge couples". NOT for landing one specific committed change (that is `/pr`).
---

# Drain the deferred merge queue (#2162)

The whole mechanism lives in **[scripts/merge-ai-prs.mjs](../../../scripts/merge-ai-prs.mjs)** — this skill is
the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The drain is the
consumer side of the #2183 PR fan-out: producing sessions (parallel `/workflow` lanes, solo `#2123` lanes, and
batch closeout) each **open a `ready-to-merge` PR per item** (#2196); this drain lands those labelled PRs
serially, in a later session, under the same self-approved PR transport the producers use.

> **Converged label lander (#2188/#2194).** `/drain` **is** the label lander
> `scripts/merge-ai-prs.mjs --label=ready-to-merge` — bare = one cascade pass, `--watch` = the poll loop. It
> merges the open `ready-to-merge` PRs (incl. orphans opened directly by `/pr`) in cross-item `blockedBy` order
> (each PR's `.lane-manifest.json`, read off its head ref, supplies the edges), and the PR-merge IS the single
> clear point (no `queued.json` unqueue). `/merge` (bare) is the same lander without the label scope. The old
> `queued.json` / `scripts/lane-drain.mjs` couple-drain is retired to a legacy no-op fallback (see below) — new
> producer output lands via the label lander.

## Preconditions

- **Run from an isolated clean clone on `main` — NEVER the shared primary checkout (#2197 / ratified #2123).**
  The drain is an edit-action session (it advances `main` and, per #2198, rebuilds lane tips), so #2123's
  "every edit-action session runs in an isolated clone" applies. The primary tree almost always carries a peer
  session's uncommitted work, and the drain's own post-merge `git pull --ff-only --autostash` then hits an
  autostash-pop conflict and strands the tree mid-merge (observed 2026-07-03: an autostash-pop conflict on
  `claims.json` left the primary half-merged; recovery was manual). Provision a fresh clone instead:

  ```
  git clone --local <primary> ../we-drain-clean && cd ../we-drain-clean
  git remote set-url origin <origin-url>           # push PRs to the real remote
  git reset --hard <origin/main sha>               # land on the true main (the local clone may be stale)
  ln -s <primary>/node_modules node_modules        # generators/gates need deps (+ a sibling ../frontierui)
  ```

  A clone sibling of `webeverything` keeps `../frontierui` resolvable (cross-repo artifact builds need it). The
  branch guard blocks `checkout -B`/`worktree add` even in a clone, so move `main` with `git reset --hard`, not
  a checkout. **Never `git pull` in the primary** — the sync below runs in the clone only.
- `gh` is authenticated (`gh auth status`) — landing is the same self-approved `gh pr merge` (0 required
  reviewers + the required `test` check) `/pr` uses. See [`/pr`](../pr/SKILL.md) for the transport.
- The clone's tree is clean: the post-merge sync (`git pull --ff-only --autostash`, in the clone) is a pure
  fast-forward there, so it never conflicts with a peer session's edits the way the primary would.

## Run it (the label lander — #2194)

`/drain` now drives the ONE label lander `scripts/merge-ai-prs.mjs --label=ready-to-merge`, **not**
`lane-drain.mjs`. It sweeps the open `ready-to-merge` PRs and merges each as it becomes eligible (green +
mergeable), in cross-item `blockedBy` order (each PR's `.lane-manifest.json`, read off its head ref, supplies
the edges — the #2188 convergence).

```
node scripts/merge-ai-prs.mjs --label=ready-to-merge --dry-run            # plan only — print the blockedBy-ordered merge order + deferred set, merge NOTHING
node scripts/merge-ai-prs.mjs --label=ready-to-merge                       # /drain (bare): ONE cascade pass — land every ready labelled PR, exit
node scripts/merge-ai-prs.mjs --label=ready-to-merge --watch --interval=30 # /drain watch: keep polling; land each PR the instant it goes green (--max-idle=N bounds it; Ctrl-C stops)
```

**Always dry-run first** to show the merge plan, then run bare (one-shot) or `--watch` (follow). Prefer the
one-shot unless the user wants a long-lived monitor waiting for producers still opening PRs.

## How it works (per pass)

1. Lists the open PRs carrying the `ready-to-merge` label (`gh pr list --label ready-to-merge`) — every
   producer (`/workflow`, `/pr`, solo `#2123` lanes, batch closeout) applies it (#2196), so this is the single
   collection point for ALL AI-generated work.
2. For each candidate, reads its `.lane-manifest.json` off its head ref and orders by cross-item `blockedBy` —
   a PR whose blocker is still an open (unlanded) PR **defers** to a later pass (the cascade). Orphan PRs (no
   manifest) are always ready.
3. **Rebase-drops the shared manifest (#2198)** — a certified + green PR that is only CONFLICTING/BEHIND on the
   one shared `.lane-manifest.json` path is rebuilt onto `main` (manifest dropped) via pure plumbing (no
   checkout) before merging, so the "manifest lands then conflicts every other PR" wall no longer stalls the
   queue. A real (non-manifest) code conflict is left as a skip for a human. On by default; `--no-rebase-drop`
   disables. A rebuilt tip re-runs `test`, so it lands on a later `--watch` pass (expected, not a failure).
4. Merges each ready PR via the SAME self-approved, non-admin `gh pr merge --merge --delete-branch` the `/pr`
   flow uses — only when its required `test` check is green and GitHub reports it cleanly mergeable. A merge
   **frees its dependents** the next inner pass; a failed/behind PR stays blocking its dependents (never land
   past a broken blocker). The closed PR carries the label away — that PR-merge IS the single clear point (no
   `queued.json` unqueue).
5. After anything merged, fast-forwards **the clone's** local `main` to the advanced `origin/main`
   (`git pull --ff-only --autostash`, best-effort) — in the isolated clone, never the primary checkout.

## Exit codes (surface these)

- `0` = swept clean (merged 0+ qualifying PRs, none failed) or a dry-run.
- `2` = at least one merge attempt FAILED (surfaced per PR). A deferred PR (blocker unlanded) is not a failure.

## Legacy `queued.json` fallback

The old `queued.json` / `scripts/lane-drain.mjs` couple-drain is **retired as the primary path** — new producer
output opens a `ready-to-merge` PR (above), never a `queued.json`-only couple. `lane-drain.mjs` stays only as a
no-op fallback for any **legacy** couple still sitting in `queued.json` (`node scripts/lane-drain.mjs drain
--dry-run` shows it; it is a clean no-op when the queue is empty). Do not reach for it unless a dry-run shows a
stranded legacy couple.

## Guardrails

- **Re-uses the shared transport, never re-implements it:** PRs land via the same self-approved `gh pr merge`
  (0 required reviewers + the required `test` check) `/pr` uses — never `--admin`, never a raw `git merge`/`git
  push` of `main`.
- **Never force-updates a PR branch** — a `BEHIND` PR (needs rebase) is left for its author / a later pass,
  never force-rebased by the sweep.
- **Label-scoped:** with `--label=ready-to-merge` the sweep only touches PRs a producer certified (#2196).
  Bare (`/merge`, no label) it also sweeps orphan AI PRs on the every-commit-AI gate — see [`/merge`](../merge/SKILL.md).
