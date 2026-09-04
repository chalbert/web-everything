---
bornAs: xfs4w9z
kind: story
size: 2
parent: "3484"
status: open
blockedBy: ["3484"]
scope: ["we:scripts/operations/verify.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-04"
tags: []
---

# Fold the gate's request/check modes into the declared we:scripts/operations/verify.mjs operation

Already fully drafted (unlanded) on origin/lane/mechanical-dispatcher as backlog/xab3jh7-*; re-filed here as a real numbered child once its prerequisite slice lands, rather than cherry-picked verbatim. #3105 added request/check/reset CLI modes to we:scripts/verify-lane.mjs so a dispatched agent hands the long-running gate to the mechanical runner instead of blocking on it (see the sibling slice graduating that work). The delivery brief calls these on the raw script, not the declared verify operation (we:scripts/operations/verify.mjs) -- #3224 flags this as an undelegated raw home, marked @operation-home-ok:#xab3jh7 meanwhile on the branch. Fold request/check into verifys own shape so the brief and any future caller share one declaration, per operations-declared-once-callers-generated in we:docs/agent/platform-decisions.md.

## Done when

1. **Executable** — `we:scripts/operations/verify.mjs` declares a mode (or a sibling operation) covering `request`/`check`, with its own unit tests, and `we:skills-src/conveyor/delivery-agent-brief.md`'s two `@operation-home-ok:` markers for these lines are removed.
2. `npm run check:standards` — 0 errors, and the #3224 rule no longer needs a marker for these two lines.
