---
bornAs: x2j0l3t
kind: story
size: 5
parent: "2612"
status: resolved
scaffoldedBy: "feedback-pool-collect-triage-split"
dateScaffolded: "2026-08-06"
dateOpened: "2026-08-06"
dateResolved: "2026-08-06"
graduatedTo: scripts/conveyor/learnings-harvest.mjs (npm run harvest) + skills-src/harvest-learnings + emit-only closing-session
tags: [conveyor, agent-memory, learnings, close-session, feedback]
---

# Close emits, harvest judges: split learnings collection from curation

Move ALL judgment off session close. The close (and any agent) only APPENDS validated learnings entries to the drop-box pool; nothing is red-teamed, filed, or landed at close. A separate periodic /harvest run reads the whole cross-session pool, dedups, red-teams with recurrence count as evidence, and routes survivors to backlog/memory via lane PR. Fixes three things: subagents that cannot run a close lose nothing; a session that never closes cleanly loses nothing; and dedup/recurrence stops being a one-session guess. Single-tenant shape of #2610's owner-review pipeline.

## The rule

**Collection is not adjudication.** A session — main or subagent — records *what it observed*. It never
decides what that observation is worth. Worth is decided later, once, over the whole pool.

## Why now (three failures the current shape has)

1. **The subagent leak.** #2614 built the drop-box precisely because a subagent can't run a close, and the
   close's §1b does sweep it — but the sweep is scoped to **this session's own** drop-box file and consumes
   it there. So a subagent's entry only counts if the session it rode under closes cleanly, in this repo,
   before anything else reads it.
2. **The un-closed session leak.** The close is the only curator, so a session that ends without one loses
   everything it noticed.
3. **Dedup-from-a-sample-of-one.** The §1a red-team's own filters ask recurrence questions ("a fresh angle on
   a covered cluster?", "narrow/rare → leave on-disk") that a single session structurally cannot answer. A
   pool answers them with a count. This is the quality argument, independent of the other two.

## Shape

- **Emit (everywhere, cheap, no judgment).** `we:scripts/conveyor/learnings-drop.mjs` unchanged — same
  validated, tenant-ready-by-construction schema, same deny-on-hit scrub. The close becomes one more caller.
- **Pool (durable across sessions, untracked).** Entries stop being consumed at close. `we:.conveyor/learnings/`
  is the pool: one JSONL per session (no cross-process append race), all of them read together. Untracked and
  machine-local by design — a cheap in-the-moment append cannot afford a lane→PR, and durable *artifacts* are
  what the harvest lands. When the multi-tenant transport of #2610 exists it ships pool entries to the central
  inbox; the emit seam does not change.
- **Harvest (periodic, the only judgment).** `we:scripts/conveyor/learnings-harvest.mjs` — the deterministic
  core: read every pool file, re-validate through the same scrub, dedup/cluster across sessions, rank by
  recurrence, emit candidates + pool age stats; `--archive` moves consumed files to
  `we:.conveyor/learnings/harvested/` so a re-run doesn't re-process. The `/harvest` skill is the thin judgment
  half: red-team each candidate, then route survivors (fix/owner → `we:backlog/`, reusable principle →
  `we:.claude/agent-memory/`) via the normal lane → PR.

## What close STOPS doing

`we:skills-src/closing-session/SKILL.md` §1 backlog-item proposals, §1a memory red-team → lane → PR, §1b's
single-session sweep, §3a model-usage suggestion, and the repo close command's `npm run reflect` step all
collapse into **emits**. The close still **names what it emitted** on its **Context capture** line and
reports the pool depth — reporting the data is not judging it, and it keeps the operator able to say "file
that one now". The close also stops being a PR-opening path: the memory carve-out on the "never open a PR"
hard rule goes away with §1a.

## Non-goals

- No carve-out for "actionable now" observations. A carve-out re-imports judgment into the close, which is
  the whole thing being removed. Harvest cadence is the answer.
- No cron yet. `/harvest` is on-demand first; a scheduled beat only once the run has proven itself.
- The pool does not become committed content.

## Placement note

#1878 ruled this fork "repo-local" when the close skill was global-only. It no longer is: the live copy is
the **tracked** `we:skills-src/closing-session/SKILL.md` (`we:.claude/skills` is a symlink to
`we:skills-src`), so the trim lands in this repo's normal lane → PR with no global blast radius. A **stale
duplicate** of the same skill still sits in the user's home `.claude/skills/` (diverged since 2026-07-10 —
it lacks §1b entirely). It is not what loads here and is deliberately **left alone** by this item; syncing
or deleting it is a separate operator call.
