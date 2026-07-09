---
name: merge
description: Sweep OPEN pull requests and merge the AI-generated ones that are safe to land — every commit co-authored by Claude, the required `test` check green, and cleanly mergeable. Use when the user asks to "merge the AI PRs", "sweep/clear the open PRs", "merge my open PRs", "land the AI-generated PRs", or "merge the current PR if AI-generated". Clears the orphan PRs the queue-scoped `/drain` never touches. NOT for opening a PR (that is `/pr`).
---

# Merge AI-generated PRs (the orphan-PR sweep)

The whole mechanism lives in **[scripts/merge-ai-prs.mjs](../../../scripts/merge-ai-prs.mjs)** — this skill is
the trigger + the ceremony around one invocation. It complements the two other transports:

- **`/pr`** opens + lands ONE change you just committed.
- **`/drain`** lands the deferred **queue** (couples a stop-at-push producer enqueued) — queue-scoped only.
- **`/merge`** (this) sweeps **open PRs** and lands the AI-generated, green, mergeable ones — the ORPHANS the
  drain ignores (a PR with no queued work item, opened by `/pr` or a peer session).

## Preconditions

- **Run from a LEASED lane-pool clone on `main` — never the shared primary checkout (#2197 / ratified
  #2123).** `/merge` advances `main` (the post-merge sync is `git pull --ff-only`), so the same isolation
  [`/drain`](../drain/SKILL.md#preconditions) requires applies here. Acquire the same way:

  ```
  node scripts/lane-pool.mjs acquire --purpose=merge --session=<merge-session-slug> --json   # → {lane, path, …}; cd into .path
  …dry-run, then live sweep…
  node scripts/lane-pool.mjs release --lane=<lane> --session=<merge-session-slug>
  ```

  See [`/drain`'s preconditions](../drain/SKILL.md#preconditions) for the full acquire/release contract
  (session-slug pairing, TTL self-reclaim, `LANE_POOL_ROOT` config) — it is the identical allocator, just a
  different `--purpose`.
- `gh` authenticated (`gh auth status`).
- This MERGES pull requests. Always **dry-run first** and show the user the verdicts before a live sweep.

## Run it

```
node scripts/merge-ai-prs.mjs --dry-run            # list every open PR + a merge/skip verdict, merge NOTHING
node scripts/merge-ai-prs.mjs --dry-run --json     # machine-readable verdicts
node scripts/merge-ai-prs.mjs                       # merge every qualifying AI PR, then pull local main
node scripts/merge-ai-prs.mjs --pr=12               # consider ONLY PR #12 (still subject to every gate)
node scripts/merge-ai-prs.mjs --base=main           # restrict to PRs targeting <base>
```

**Always `--dry-run` first**, relay the verdicts, then run the live sweep only once the user is happy (or they
asked for it directly). Prefer `--pr=<N>` when they mean one specific PR.

## The gates (a PR is merged ONLY if ALL hold)

1. **AI-generated** — EVERY substantive commit is co-authored by Claude (the `Co-Authored-By: Claude` trailer).
   One human content commit ⇒ skipped. Mechanical `Merge branch 'main'` commits (from `update-branch`) are
   ignored, not disqualifying.
2. **Green** — the required `test` check is SUCCESS. `cla` / `Workers Builds` are non-required and ignored
   (matching branch protection + the `/pr` contract).
3. **Cleanly mergeable** — `mergeable == MERGEABLE` and merge state CLEAN or UNSTABLE. A **BEHIND** PR (needs
   rebase) is **skipped and reported**, never force-updated; DIRTY / BLOCKED / DRAFT are skipped too.

Then it merges via the SAME self-approved, **non-admin** `gh pr merge --merge --delete-branch` that `/pr` uses,
and **pulls local `main`** (`git pull --ff-only`, best-effort) so the checkout reflects the merges.

## Exit codes

- `0` = swept cleanly (0+ merged, none failed). `2` = a merge attempt FAILED (surfaced). `3` = bad input / `gh` down.

## Guardrails

- **Never `--admin`, never force-merge, never force-update a branch.** A blocked/behind PR is left for its
  author. A human commit in the PR ⇒ never merged (it needs review).
- **Read-safe first:** the default posture is `--dry-run`; a live sweep merges real PRs, so confirm scope
  (all vs `--pr=<N>`) with the user unless they asked for the sweep outright.
- Local-main pull is **ff-only + best-effort** — a diverged / dirty tree aborts it (reported), never discards
  local work (mirrors the `/drain` post-land sync).
