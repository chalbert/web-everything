---
kind: story
size: 8
parent: "2289"
status: open
blockedBy: ["x2rabof", "x52nn3j"]
scope: ["we:scripts/pr-land.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/lib/nnn-collision-heal.mjs", "we:scripts/check-standards-rules.mjs", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-10-03"
tags: []
---

# Producer numbering at PR open and the write-point clash verify

Under #3732 the producer numbers every hash card before a tip's first push for review, and the drain refuses a clashing NNN under the land mutex just before the merge. A clash on an accepted PR re-parks it; otherwise the heal renumbers it. The numbering tail after merge is removed for the PR route. The conveyor fix and ci-heal briefs call the numbering operation. #2548 stays a lane-local fast-fail that exempts the operation's own commit. Honours the where-numbering-happens setting.

## Done when

1. **Executable** — two lanes on two hosts handed the same NNN cannot both merge; the second is renumbered by the heal, or re-parked when it holds an acceptance, and main stays green. The test fails before this lands.
2. **Executable** — `we:scripts/pr-land.mjs` opens no PR when numbering fails (reason `numbering-failed`).
3. The conveyor fix and ci-heal briefs under `we:skills-src/conveyor/` call the numbering operation before a push; the numbering tail is removed for the PR route and kept in `we:scripts/push-if-green.mjs`.
4. Selecting the `integration-branch` setting refuses and names the value as unbuilt.
