---
kind: story
size: 5
parent: "x6yoscx"
status: open
blockedBy: ["xpop00d", "xsrjgzo", "x392ihw"]
dateOpened: "2026-07-10"
tags: []
---

# Producer overlap-stacking: author a selective stacked chain with a push-time safety re-check

In we:.claude/skills/batch-backlog-items, build per-repo overlap chains via union-find on each item DECLARED locus file-set: an overlapping item bases (via lane-pool --base) on the open chain frontier tip and extends it; a provably-disjoint item stays a sibling off origin/main; a bridging item merges two chains tips in-session and records both stackParents. AT PUSH recompute the actual touched files (git diff --name-only base...head) and assert actual is a subset of declared; on violation rebase onto the overlapping chain frontier IN-SESSION and re-resolve before pushing (never certify a mislabelled sibling to the deferred drain). Cap chain depth (fall back to siblings past the cap). Stack ONLY when the durable capability marker read off origin/main advertises gate support; default hard to siblings on any read failure or version mismatch. Write stackParents+base into the manifest. E2e: a 3-item batch with one shared file lands with zero conflict-rebases; a disjoint item lands independently; an under-declared item is caught at push and rebased in-session, not shipped as a sibling.
