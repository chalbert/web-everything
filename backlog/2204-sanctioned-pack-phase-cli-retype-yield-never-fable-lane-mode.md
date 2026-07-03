---
kind: story
size: 3
status: resolved
scaffoldedBy: "gating-fix"
dateScaffolded: "2026-07-03"
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Sanctioned pack-phase CLI (retype/yield) + never-Fable lane model + memory guard carve-out

Remove the reasons agents override the #2123 lane guard: add we:scripts/backlog.mjs retype/yield for pack-phase flag-fixes + NNN-collision yield (no LANE_GUARD_OFF); default /workflow lanes to Sonnet (Opus for rare complex, never Fable) via the probe complex flag in we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js; exempt the we:.claude/agent-memory tree from we:scripts/guard-lane.mjs (restores its stated tilde/.claude intent, defeated by the symlink). Clarify the batch SKILL wording to point at the CLI.

## Why

Surfaced by the 2026-07-03 parallel `/workflow` batch (#1974–2184). Three gaps let a session drift into editing the shared primary checkout (the #2123 anti-pattern):

- **Pack-phase flag-fixes had no sanctioned path.** The batch skill says "fix a mis-flagged item in place," but the lane guard blocks a raw primary-tree Edit of the item's `.md`, so the fix went through `LANE_GUARD_OFF` — and once the guard is overridden, real code edits drift into the primary tree too. An NNN collision (two files share a number) had no mechanical fix either.
- **Lanes inherited the session model.** With no default, the first run's 24 lanes inherited a Fable session and all died on "out of Fable 5 usage credits" (~1.5M tokens wasted). Execution should never be on Fable.
- **Saving a memory tripped the guard.** The per-project memory dir symlinks into `we:.claude/agent-memory`, so a memory write classified as a primary-checkout edit and was blocked — defeating the guard's own stated intent that `~/.claude` memory is free to edit.

## Scope

- `we:scripts/backlog.mjs` — `retype <NNN> [--to] [--size] [--status]` (frontmatter-only pack-phase splice) + `yield <NNN-slug>` (move a local-only NNN collision to the next free number; refuses a git-tracked item — NNN is immutable).
- `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` — probe emits a per-item `complex` flag; `laneModelFor(it)` = Sonnet default / Opus if complex / never Fable, always passed explicitly so a lane can't inherit a Fable session.
- `we:scripts/guard-lane.mjs` — exempt `we:.claude/agent-memory/` (the symlink target) so memory edits pass; source/content edits still blocked.
- `we:.claude/skills/batch-backlog-items/SKILL.md` — pack-phase wording points at the CLI; documents the lane-model policy.
- Memory rule 144 (lane model: Sonnet default, never Fable) added as a numbered `we:.claude/agent-memory/index-meta.md` entry.

Deliberately deferred (needs its own discussion): the bigger "reclassify what the guard *enforces* — allow bookkeeping, block only code" reframe.

## Done when

`retype`/`yield` work and are gate-clean, `/workflow` lanes default off Fable, memory edits pass the guard, and the batch skill no longer tells the packer to edit the primary tree in place.
