---
name: pr
description: Open a self-approved pull request for the current committed work and land it on `main` via the standard PR transport — the SAME self-approval the parallel `/workflow` integrator uses (`scripts/pr-land.mjs`, #2138 Fork 5 / #2153). Use when the user asks to "create/open a PR", "raise a PR", "land this via PR", "ship it", or "land it the standard way". NOT for reviewing an existing PR (that is `/review`).
---

# Open a self-approved PR (standard land flow)

The whole mechanism lives in **[scripts/pr-land.mjs](../../../scripts/pr-land.mjs)** — this skill
is the trigger + the ceremony around one invocation, so there is nothing to keep in sync here. The
flow is identical to what the `/workflow` integrator uses: a **self-approved** PR (`gh pr create`,
**0 required reviewers** + the required `test` check, #2151/#2152). **#2290 — pr-land no longer merges:
the drain is the SOLE writer to `main`.** `/pr` opens the PR, waits for green, labels it `ready-to-merge`,
and **triggers a single-couple fast drain** (`merge-ai-prs.mjs --only=<pr>`) that lands it — so `/pr` still
feels instant while a single serialized writer owns every merge (the prerequisite for JIT NNN numbering).
GitHub's native merge queue stays OFF.

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
4. **Open + hand off** (self-approved, wait for the `test` check, label green, trigger the drain — #2290
   pr-land NEVER merges):
   ```
   node scripts/pr-land.mjs --ref=lane/<slug> --sha=HEAD --base=main --body-file=<path>
   ```
   - **Default:** open → wait for required checks → label `ready-to-merge` when green → **trigger a
     single-couple fast drain** (`merge-ai-prs.mjs --only=<pr> --this-repo`) that lands it. The trigger is
     best-effort: if review parks the PR (or the drain hiccups), `/pr` still exits success with the PR
     labelled and the standalone drain lands it later. **No `gh pr merge` runs from pr-land.**
   - `--label-on-green` is the **batch producer** mode (#2199): open the PR, **wait for the required
     checks, apply `ready-to-merge` only once they are green**, then STOP — does NOT trigger a drain (a
     `/workflow` or `/batch` closeout runs the standalone drain over the whole set).
   - `--no-wait` opens the self-approved PR **UNLABELLED** and leaves it (CI unconfirmed — the label lander
     won't collect it until something labels it). Use only when the user just wants the PR raised now and
     will land it themselves.
   - **The `ready-to-merge` label is applied ONLY after the required checks are green (#2196/#2199)** — never
     eagerly at open, so a red PR never enters the drain's queue. In the default land path (above) and the
     `--label-on-green` path `pr-land` applies it once CI passes. Pass `--no-label` to opt out; `--label=<name>`
     overrides the name.
   - `--fallback-git` degrades to a local `git merge --no-ff` + push. **#2290 — this is a write to `main`,
     so it is routed through the shared merge gate (`scripts/lib/pr-merge-gate.mjs`, caller `pr-land`) and is
     BLOCKED unless the documented `WE_MERGE_BREAK_GLASS=1` emergency admin override is set (which logs a loud
     audit line).** Normal landing goes through the drain, never `--fallback-git`.
   - If `pr-land` still fails on create, the manual equivalent is `gh pr create --base main
     --head lane/<slug> --title "…" --body-file <path>` then **label it** `gh pr edit <n> --add-label
     ready-to-merge` and run the drain (`node scripts/merge-ai-prs.mjs --only=<n> --this-repo`) — never
     `gh pr merge` yourself (the gate rejects any non-drain merge).
5. **Sync the local checkout** — the drain (which lands the PR) ff-syncs the lane clone's local `main` to the
   advanced `origin/main`; pr-land best-effort ff-syncs the user's PRIMARY checkout too (`git pull --ff-only
   --autostash`, #2205). If you landed from a lane clone, also reset that lane back to `origin/main` so the
   pool stays reusable.

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
