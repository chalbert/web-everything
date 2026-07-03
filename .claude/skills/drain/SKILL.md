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

- Run from the **WE checkout on `main`** (the manifest reads + the post-merge `main` fast-forward assume it).
- `gh` is authenticated (`gh auth status`) — landing is the same self-approved `gh pr merge` (0 required
  reviewers + the required `test` check) `/pr` uses. See [`/pr`](../pr/SKILL.md) for the transport.
- The tree is clean-*ish* on `main`: the post-merge local sync is `git pull --ff-only --autostash`, which is
  best-effort (it stashes/reapplies dirty edits) and degrades (reported) under a conflicting local change.

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
3. Merges each ready PR via the SAME self-approved, non-admin `gh pr merge --merge --delete-branch` the `/pr`
   flow uses — only when its required `test` check is green and GitHub reports it cleanly mergeable. A merge
   **frees its dependents** the next inner pass; a failed/behind PR stays blocking its dependents (never land
   past a broken blocker). The closed PR carries the label away — that PR-merge IS the single clear point (no
   `queued.json` unqueue).
4. After anything merged, fast-forwards the local `main` checkout to the advanced `origin/main`
   (`git pull --ff-only --autostash`, best-effort).

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
