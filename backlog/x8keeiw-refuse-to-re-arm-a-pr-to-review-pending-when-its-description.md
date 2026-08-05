---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Refuse to re-arm a PR to review:pending when its description contradicts its diff

PR #1031 review finding 3's owed prevention. At head a2a99afb the PR title still read 'and tier its mechanical agents' and the body still claimed 5 scripts (it is 3) and 7 agents tiered (the tiering was fully reverted and is absent from the diff), while never mentioning we:scripts/fetch-parked.mjs, where four of five blockers were repaired. The fix commit ASSERTED it had corrected the description; it had not. This is not cosmetic: we:.claude/skills/review/SKILL.md states the review subagent seeded by buildMandate() sees ONLY the diff plus the PR description, so the next fresh-context panel is seeded with a promise of a cost change that does not exist and no mention of the module carrying most of the change. Both halves are script-decidable from data the drain already fetches: require the body's updatedAt to be newer than the head commit's authored date, and require the body's claimed changed-file mentions to be a subset of computeNetDiffPaths() for the current head.
