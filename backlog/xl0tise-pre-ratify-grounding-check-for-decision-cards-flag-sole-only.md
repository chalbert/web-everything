---
kind: story
size: 2
status: open
dateOpened: "2026-09-09"
tags: []
---

# Pre-ratify grounding check for decision cards: flag sole/only-path claims that cite no owning skill spec or open blocking item

Prevention owed by the review of PR #2027 (the conveyor-only dispatch-origin attribution decision, we:backlog/xoywo06). That card's central grounding claim -- that we:scripts/operations/dispatch-lane.mjs is 'confirmed the SOLE conveyor dispatch surface' with four named callers -- was false against the repo's own current state: we:skills-src/conveyor/SKILL.md's live spec has the main-session bridge spawning every surfaced build with the harness Agent tool, none of the four named files invokes the dispatch effect, and #3096 (route build dispatch through the declared operation) plus its blocker #3353 are both open. Nothing in the repo caught it, because a decision card's grounding is prose and no check reads it: a human could have ratified a recommendation scoped to a code path that has never run in production. Build a check:standards (or pre-ratify) rule that flags any grounding sentence in a kind:decision card asserting a specific file or operation is 'sole' / 'the only' / 'the sole caller' / 'confirmed' the single surface for something, and requires that sentence to carry a cross-reference to the owning skill spec under we:skills-src/ AND to any OPEN backlog item whose scope names that same file -- both mechanically checkable from data already on disk (declared-homes plus scope frontmatter, and the skill sources). Short of full automation, the fallback the review named is a mandatory second-pass grounding review before a decision's status may move from open toward ratified. Non-goal: judging whether a grounding claim is TRUE (undecidable here) -- only that a sole/only-path claim is cross-referenced against the two places that would contradict it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
