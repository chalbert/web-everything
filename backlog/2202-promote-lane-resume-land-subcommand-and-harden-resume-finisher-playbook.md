---
kind: story
size: 5
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain, resume]
---

# Promote the scratchpad land plumbing into `we:scripts/lane-resume.mjs` land + harden the resume finisher playbook

The 2026-07-03 `/resume` run finished stuck lanes with **ad-hoc scratchpad plumbing** (hand-run
`git merge-tree` / temp-index / `commit-tree` / push-to-`lane/*` / `gh pr merge`). That plumbing worked but
lived nowhere durable — the next resume re-derives it from memory. `we:scripts/lane-resume.mjs` today has only a
`discover` subcommand. Promote the proven land path into a durable, unit-tested **`land <pr>`** subcommand
(sharing the same rebase-drop-manifest helper as the #2198 lander) and **harden
`we:.claude/skills/finish/SKILL.md`** with the finisher playbook learned that day.

## `land <pr>` subcommand (durable + tested)

Reuse the #2198 `rebaseDropManifest()` helper (single source of truth): per PR, `merge-tree main × laneRef` →
if the only conflict is the transient lane manifest, resolve via temp-index write-tree + `commit-tree` (main
first parent) + push to `lane/*` (guard-safe, no checkout) → `gh pr merge`. Skip on any real conflict. Unit
tests cover: clean merge, manifest-only conflict (dropped + landed), real conflict (skipped), non-required-check
tolerance (`UNSTABLE` + `test=pass` lands).

## Harden `we:.claude/skills/finish/SKILL.md` — the finisher playbook

- **Env setup:** symlink `node_modules` from the primary + a sibling `../frontierui` (generators/gates need
  both).
- **Conflict resolution table:** the transient lane manifest → drop; coordination JSON
  (`claims`/`reservations`/`capacity`/`queued`) + the `.claude/agent-memory` tree → take-main; generated
  artifacts (grammar-scorecard report, `we:AGENTS.md`, parity report) → **regenerate**, not hand-merge; code →
  union additive by intent, **stop-and-report** on genuine same-line overlaps.
- **Recurring test-red root causes** (fix minimally, never weaken a test): epic-closeout (resolving the last
  child ⇒ resolve the umbrella epic); living-catalog count-pins (a new deliverable moves a `toBe(N)`);
  reports-not-hidden (add `relatedReport:` to the backlog item); stale generated inventory (regen
  `we:AGENTS.md`); backlog id-collision (yield the newcomer to the next free NNN).
- **Landing nuances:** `UNSTABLE` + `test=pass` **is** mergeable (only `test` is required; `cla`/Workers-Builds
  are non-required); land shared-file lanes **serially** and re-rebase between; `discover` should
  warm-recompute mergeability (`gh pr view` each) so nothing shows `UNKNOWN`.

## Finisher learnings — 2026-07-03 `/finish` run of PR #67 (add to the playbook)

Three nuances that cost real CI rounds and aren't yet explicit above:

- **Local gate must be the full `check:standards`, not `vitest run`.** The CI `test` job runs the repo
  **health gate** (id-uniqueness, memory-index, epic-closeout, digest, blocker-DAG). A green local
  `vitest run` says nothing about it — PR #67 went red on CI three times (NNN collision, memory-leaf
  collision, missing linked file) while local vitest was green. Run `npm run check:standards` in the lane
  clone before every push.
- **A single-branch lane clone's `origin/main` goes stale.** `git clone --branch <lane> --single-branch`
  sets a refspec that only tracks the lane, so `git fetch origin main` updates `FETCH_HEAD` but **not**
  `refs/remotes/origin/main`. On a fast-moving main this silently recomputes yield NNNs against a stale
  set and collides repeatedly. Force-sync first: `git fetch origin main:refs/remotes/origin/main --force`,
  then re-merge, then compute the free number.
- **A merge-collision on a lane-*committed* item yields via `we:scripts/backlog.mjs yield <full-slug>
  --force`.** Plain `git mv backlog/NNN… backlog/MMM…` is hard-blocked by `we:scripts/guard-bash.mjs` (NNN
  immutable), and `yield` without `--force` refuses a git-tracked file — so `--force` is the sanctioned
  path for the merge-collision case. It renumbers via internal fs writes (not shell `mv`/`rm`), so it
  doesn't trip the guard. Pass the **full `NNN-slug`** to disambiguate when two files share the number.

Relates to #2198 (shared helper), #2197 (clean-clone precondition), #2200 (the resume skill this hardens),
#2218 (the `pr-land` report-crash surfaced on the same run).
