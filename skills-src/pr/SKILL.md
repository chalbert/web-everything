---
name: pr
description: Open a self-approved pull request for the current committed work and land it on `main` via the standard PR transport — the SAME self-approval the parallel `/workflow` integrator uses (`scripts/pr-land.mjs`, #2138 Fork 5 / #2153). Use when the user asks to "create/open a PR", "raise a PR", "land this via PR", "ship it", or "land it the standard way". NOT for reviewing an existing PR (that is `/review`).
---

# Open a self-approved PR (standard land flow)

The whole mechanism lives in **[scripts/pr-land.mjs](../../../scripts/pr-land.mjs)** — this skill
is the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The
flow is identical to what the `/workflow` integrator + the #2162 drain use to land a lane: a
**self-approved** PR (`gh pr create`, **0 required reviewers** + the required `test` check, #2151/#2152),
author merges their own PR once CI is green. GitHub's native merge queue stays OFF.

## Preconditions

- The work is **committed** (on the checked-out branch — commit-on-current-branch, #104). `pr-land`
  publishes a *commit*, never a local branch. If there are uncommitted changes the user wants to land,
  commit them first (tight pathspec — your changeset only, per the shared-index-race rule).
- `gh` is authenticated (`gh auth status`) and the change is small/coherent enough for one PR. Split
  unrelated concerns into separate PRs.
- Per lane isolation (#2123) the edit should already have happened in a lane clone; the commit you are
  landing is that lane's HEAD (or a commit already ff'd onto the primary's `main`).

## Steps

1. **Pick a `lane/*` ref name** — the #1934 guard carve-out only allows pushing to `lane/*` (never a
   local branch, never `main` directly). Use a descriptive slug: `lane/<short-slug>` for an ad-hoc
   change, or `lane/<NNN>-<slug>` when it closes a backlog item.
2. **Dry-run first** to show the user the exact `gh` sequence, execute nothing:
   ```
   node scripts/pr-land.mjs --ref=lane/<slug> --sha=HEAD --base=main --dry-run
   ```
3. **Write a PR body to a file and ALWAYS pass `--body-file`** — this is required, not optional:
   `pr-land` derives the title from the commit subject, and `gh pr create --title …` with **no** body
   drops into an interactive body prompt that **fails headless** (there is no `--fill` fallback for a
   remote-only `lane/*` head). So a bodyless run errors on create. Compose the body (the change summary,
   plus any `/review` findings/dismissals audit trail) to a file first.
4. **Open + land** (self-approved, wait for the `test` check, merge, delete the ref):
   ```
   node scripts/pr-land.mjs --ref=lane/<slug> --sha=HEAD --base=main --body-file=<path>
   ```
   - `--label-on-green` is the **producer hand-off** mode (#2199): open the PR, **wait for the required
     checks, apply `ready-to-merge` only once they are green**, then STOP — the drain lands it. Use this
     (not `--no-wait`) when you want the drain to merge; the label then truly means "fully checked".
   - `--no-wait` opens the self-approved PR **UNLABELLED** and leaves it (CI unconfirmed — the label lander
     won't collect it until something labels it). Use only when the user just wants the PR raised now and
     will land it themselves.
   - **The `ready-to-merge` label is applied ONLY after the required checks are green (#2196/#2199)** — never
     eagerly at open, so a red PR never enters the drain's queue. In the default land path (above) and the
     `--label-on-green` path `pr-land` applies it once CI passes. Pass `--no-label` to opt out; `--label=<name>`
     overrides the name.
   - `--fallback-git` degrades to a local `git merge --no-ff` + push when `gh` is unavailable.
   - If `pr-land` still fails on create, the manual equivalent is `gh pr create --base main
     --head lane/<slug> --title "…" --body-file <path>` then `gh pr merge <n> --merge --delete-branch`
     once the required `test` check is green (only `test` is required on `main`; a failing `cla` check
     is non-blocking).
5. **Sync the local checkout** — after a clean merge `pr-land` **auto ff-syncs local `main`** to the
   advanced `origin/main` (`git pull --ff-only --autostash`, best-effort, #2205) — the same post-merge sync
   the drain runs, so no land route leaves the checkout it ran in behind. If you landed from a lane clone,
   also reset that lane back to `origin/main` so the pool stays reusable.

## Exit codes (surface these, never merge a red PR)

- `0` = merged (or opened with `--no-wait` / dry-run).
- `2` = the required check was RED — nothing merged, `main` untouched. Report the failing check; fix and
  re-run.
- `3` = unmergeable / `gh` error / push failed — recoverable: rebase the ref on `main` and re-run, or
  pass `--fallback-git`.

## Guardrails

- **Self-approved, never request a human reviewer** — 0 approvals + the `test` gate is the contract.
- **Never push `main` directly** and never force-push over a shared ref — the only pushes are to the
  `lane/*` ref (create + delete).
- One PR = one coherent changeset. Do not fold unrelated work (e.g. tooling + a feature) into one PR.
