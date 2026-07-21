---
bornAs: xq8w3rc
kind: story
size: 3
parent: "2560"
status: resolved
dateOpened: "2026-07-20"
dateResolved: "2026-07-20"
tags: [plateau-loop, console, scope-lease, conflict-policy, readiness, lanes]
---

# Live scope-snapshot collector (slice 4)

Slice 4 of the scope-lease engine (epic #2560): the CLI **collector** that is the IO boundary for the pure
slice-3 observer (#2594). The observer (`liveScopePicture`) owns no fs/git/clock — everything is passed in. This
slice is the missing other half: it walks the live lane pool, reads each HELD lease and its git diff, assembles
the observer's `leases` array, and composes the observer to print the live conflict picture.

## Scope (delivered)
- New module `we:scripts/readiness/scope-lease-collect.mjs`:
  - PURE core (no fs/git/Date/child_process — injected deps, unit-tested directly): `qualifyPaths` ·
    `parseObservedFiles` (committed diff ∪ porcelain uncommitted, rename-aware, repo-qualified) ·
    `resolvePredictedScope` · `collectSnapshot` (pool status → the observer's `{lane, session, predictedScope,
    observedScope}` lease shape, live-leased lanes only).
  - IO shell (CLI, `--json` / `--repo` / `--name` / `--policy` / `--plan`): runs `we:scripts/lane-pool.mjs status
    --json`, per lane runs `git merge-base` + `git diff --name-only <base>...HEAD` + `git status --porcelain`,
    repo-qualifies via `repoKeyFromSlug`, composes `liveScopePicture`, emits the picture as clean JSON to stdout
    (human summary to stderr). Every git call is guarded — a broken lane contributes `[]`, never crashing the run.
- Composes, never reinvents: imports `normScope`, `porcelainFiles`, `repoKeyFromSlug`, `liveScopePicture`.

## The predicted=observed default (a design call — flagged)
The live orchestrator (#2183 PR-fan-out) emits **no** predicted file-scope: backlog items carry no declared
file-set, and the workflow probe predicts only non-WE repos, not files. So with no `--plan`, the collector defaults
`predictedScope := observedScope` ⇒ **zero false breach**; the observer then reports only the trustworthy signal —
real cross-lane **overlaps** (two lanes on the same file), which need no plan. Breach detection turns on only when
a real per-lane plan is supplied via `--plan`. This is forward-compatible: when a live predicted-scope producer
lands, breach lights up with no collector change.

## Acceptance
The collector snapshots the live lease set and prints the observer's picture (JSON to stdout, summary to stderr,
exit 0); the pure core is unit-tested (21 cases incl. an end-to-end overlap through the real `liveScopePicture`);
the full `we:scripts/readiness/` suite stays green (342); no existing file modified.

## Not in scope (remaining #2560 children)
- Wiring the collector into the live `we:scripts/lane-pool.mjs` acquire/release path (a durable per-lane
  breach-attempt counter would live here too — none exists yet, so outcomes read first-attempt).
- The board lease-zone rendering (#2589) that consumes this picture.
