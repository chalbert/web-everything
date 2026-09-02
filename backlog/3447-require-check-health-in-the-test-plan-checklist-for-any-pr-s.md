---
bornAs: x2u8e5d
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
scope:
  - we:skills-src/prepare-decision-item/
  - we:docs/agent/
---

# Require check:health in the test-plan checklist for any PR stamping preparedDate on a decision with Fork sections

PR #1803 (#3427 prep) bounced review:changes on a G4 false-positive (FORK_TELLS matched "another surface" in a Fork 2 sentence about run-record resumability) that we:scripts/audit-backlog-health.mjs check:health would have caught pre-review -- the test plan never ran it. Add `npm run check:health` to the required test-plan checklist (we:docs/agent/backlog-workflow.md and/or the prepare-decision-item skill) for any PR that stamps preparedDate on a decision item with `## Fork` sections, so a G4 false-trip surfaces before review, not after a bounce.

## Done when

1. **Executable** — `we:skills-src/prepare-decision-item/SKILL.md` explicitly lists `npm run check:health` as a
   required verification command (alongside `check:standards`) before stamping `preparedDate` on a decision
   that carries `## Fork` sections.
2. `we:docs/agent/backlog-workflow.md`'s "The prepared-fork shape" section states the same requirement, so an
   agent authoring or reviewing a prepared decision reads it there too, not only in the skill file.
3. Proof: `grep -l "check:health" we:skills-src/prepare-decision-item/SKILL.md we:docs/agent/backlog-workflow.md`
   returns both files.
