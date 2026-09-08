---
bornAs: x0eymrj
kind: story
size: 3
status: open
blockedBy: ["3015"]
dateOpened: "2026-08-08"
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
