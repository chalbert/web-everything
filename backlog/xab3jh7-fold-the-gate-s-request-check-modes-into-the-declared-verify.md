---
kind: story
size: 2
status: open
dateOpened: "2026-08-29"
tags: [conveyor, gate, operations, footgun]
---

# Fold the gate's request/check modes into the declared verify operation

#3105 added `request`/`check`/`reset` CLI modes to `we:scripts/verify-lane.mjs` so a dispatched agent hands the
long-running gate to the mechanical runner instead of blocking on it. The delivery brief calls these on the RAW
script, not the declared `verify` operation (`we:scripts/operations/verify.mjs`) — #3224 flags this as an
undelegated raw home, marked `@operation-home-ok: #xab3jh7` meanwhile. Fold `request`/`check` into `verify`'s
own shape so the brief and any future caller share one declaration, per
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated).

## Done when

1. **Executable** — `we:scripts/operations/verify.mjs` declares a mode (or a sibling operation) covering
   `request`/`check`, with its own unit tests, and `we:skills-src/conveyor/delivery-agent-brief.md`'s two
   `@operation-home-ok: #xab3jh7` markers are removed because the brief now calls the operation.
2. `npm run check:standards` — 0 errors, and the #3224 rule no longer needs a marker for these two lines.
