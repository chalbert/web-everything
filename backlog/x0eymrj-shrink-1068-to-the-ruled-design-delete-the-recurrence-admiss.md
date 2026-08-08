---
kind: story
size: 3
status: open
blockedBy: ["xby3o0h"]
dateOpened: "2026-08-08"
tags: []
---

# Shrink #1068 to the ruled design — delete the recurrence admission gate

#2978 shrinks #1068 rather than repairing it. The sessions/days corroboration axes survive as ranking inputs; the admission floor, the --min-sessions gate semantics, and the skill prose defending them are deleted. Add the grounding fields (quoted turn + transcript pointer) and the harvest-side verification. The branch is 29 commits behind main and needs a rebase before any of this is worth doing.

Ordered after #xby3o0h (move the secret scrub to the publish seam): adding the uncapped quoted-turn field here removes the append-seam scrub's protection, so a raw transcript quote must never be able to enter the pool before the publish-seam scrub exists to catch it on the way out. Land the scrub move first.
