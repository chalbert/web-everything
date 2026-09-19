---
bornAs: x0eymrj
kind: story
size: 3
status: resolved
blockedBy: ["3015"]
dateOpened: "2026-08-08"
dateStarted: "2026-09-14"
dateResolved: "2026-09-14"
tags: []
scope:
  - we:scripts/conveyor/learnings-drop.mjs
  - we:scripts/conveyor/learnings-harvest.mjs
  - we:scripts/conveyor/learnings-dedup.mjs
  - we:scripts/conveyor/close-session-sweep.mjs
  - we:scripts/lib/review-loop-policy.mjs
  - we:scripts/__tests__/learnings-drop.test.mjs
  - we:scripts/__tests__/learnings-harvest.test.mjs
  - we:scripts/__tests__/learnings-dedup.test.mjs
  - we:scripts/__tests__/close-session-sweep.test.mjs
  - we:scripts/lib/__tests__/review-loop-policy.test.mjs
  - we:skills-src/harvest-learnings/SKILL.md
  - we:skills-src/closing-session/SKILL.md
  - we:skills-src/capture-learning/SKILL.md
  - we:.claude/commands/harvest.md
---

# Shrink #1068 to the ruled design — delete the recurrence admission gate

#2978 shrinks #1068 rather than repairing it. The sessions/days corroboration axes survive as ranking inputs; the admission floor, the --min-sessions gate semantics, and the skill prose defending them are deleted. Add the grounding fields (quoted turn + transcript pointer) and the harvest-side verification. The branch is 29 commits behind main and needs a rebase before any of this is worth doing.

Ordered after #3015 (move the secret scrub to the publish seam): adding the uncapped quoted-turn field here removes the append-seam scrub's protection, so a raw transcript quote must never be able to enter the pool before the publish-seam scrub exists to catch it on the way out. Land the scrub move first.

## Progress

- **Premise check (2026-09-14).** #3015 is resolved, so this is unblocked. The "29 commits behind, needs a rebase" line is stale: PR #1068 merged long ago. The floor it built was still live on `main` (`harvest({ minSessions })`, `stats.belowFloor`, the `--min-sessions` CLI flag, and skill prose defending it).
- **Floor deleted.** `harvest()` returns every cluster, ranked `sessions` → `days` → `count`. The new `days` axis is emitted by `dedup()` alongside `sessions`. `belowFloor`/`minSessions` stats are gone. The CLI refuses `--min-sessions` with exit 2 instead of silently ignoring it.
- **Grounding fields added.** `quotedTurn` + `transcript` are optional, both-or-neither, uncapped, and allow-listed in `we:scripts/conveyor/learnings-drop.mjs`. The CLI flags are `--quoted-turn`/`--transcript`. Shape rules: the quote must be at least 12 normalized chars (a shorter one matches almost any transcript), and the pointer must be an absolute `.jsonl` path on one line. Decision: the caps on `summary`/`area`/`suggestion` **stay**. Fork 3's "uncapped" is read as applying to the evidence, not the lesson fields, so `we:scripts/lib/review-loop-policy.mjs` needed no change.
- **Harvest-side verification.** New file `we:scripts/conveyor/learnings-grounding.mjs`. It gives `verified` / `failed` (with a reason) / `ungrounded`, matching only visible user/assistant text. The drop command's own tool_use and its `--json` tool_result echo are excluded, so a note cannot verify against its own emission. Thinking and `isMeta` records are excluded too. The pointer must stay inside `~/.claude/projects` (checked on the resolved path and the realpath, so no `..` or symlink escape), and the whole file is searched. `harvestPool` verifies eligible entries with one read per transcript. Each candidate carries `grounding` counts plus one `evidence` row per grounded member, excerpted to `EVIDENCE_EXCERPT_CHARS` (the harvest-side context budget). The run total is `stats.verification = { verified, failed, ungrounded }`, the counter #3018 binds to.
- **Skill prose.** Updated `we:skills-src/harvest-learnings/SKILL.md`: the recurrence filter is removed, the Grounding filter is now the mechanical verdict, and memory needs `verified`. `we:skills-src/closing-session/SKILL.md` and `we:skills-src/capture-learning/SKILL.md` now teach emitting the quoted turn and transcript path.
- **Not done — left for follow-up.** `we:.claude/commands/harvest.md` still advertises `--min-sessions`: the write was refused by a permission prompt in this run. It is a two-line edit. The overlap with #3019: its digest also says "delete the admission floor", which is now done here. Its remaining scope is cause synthesis and memory/backlog destination routing.
