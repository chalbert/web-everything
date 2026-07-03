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
`we:.claude/skills/resume/SKILL.md`** with the finisher playbook learned that day.

## `land <pr>` subcommand (durable + tested)

Reuse the #2198 `rebaseDropManifest()` helper (single source of truth): per PR, `merge-tree main × laneRef` →
if the only conflict is the transient lane manifest, resolve via temp-index write-tree + `commit-tree` (main
first parent) + push to `lane/*` (guard-safe, no checkout) → `gh pr merge`. Skip on any real conflict. Unit
tests cover: clean merge, manifest-only conflict (dropped + landed), real conflict (skipped), non-required-check
tolerance (`UNSTABLE` + `test=pass` lands).

## Harden `we:.claude/skills/resume/SKILL.md` — the finisher playbook

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

Relates to #2198 (shared helper), #2197 (clean-clone precondition), #2200 (the resume skill this hardens).
