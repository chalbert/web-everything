---
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-06"
tags: []
---

# no skill tells an agent maintaining a long-lived branch to use branch-sync instead of a hand-rolled loop

we:scripts/conveyor/branch-sync.mjs (built 2026-09-04) replaces exactly the failure mode agent-memory already had to name twice: a hand-rolled `bash -c "while true; do sleep N; git merge ...; done"` loop that repeats the SAME doomed merge forever with no retry policy and no escalation past an untailed log line (the incident its own header documents: a scratch checkout drifted 53 commits behind while the loop kept reporting fetch succeeded). we:agent-memory-src/keep-prototype-branch-synced-after-each-merge.md records the lesson and names the replacement, but agent memory is a lesson store, not an operational skill surfaced by trigger words — checked every skills-src SKILL file for "branch-sync" and got zero hits, including we:skills-src/conveyor/SKILL.md and we:skills-src/finish/SKILL.md, the two most likely homes for "how do I keep a long-lived dispatched-work branch current against origin/main." Add a pointer (`node we:scripts/conveyor/branch-sync.mjs loop` or `once`, per its own CLI) to whichever skill governs operating a long-lived branch outside the normal lane pool (we:skills-src/conveyor/SKILL.md is the likely home, per the epic-3383 mechanical-dispatcher work this file was built for).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
