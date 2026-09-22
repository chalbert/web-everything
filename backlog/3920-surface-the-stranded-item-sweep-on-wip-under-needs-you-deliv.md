---
bornAs: xu4doeg
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-22"
tags: []
---

# Surface the stranded-item sweep on /wip under Needs you — delivered work still marked open/active, for a human to confirm

we:scripts/backlog-stranded-sweep.mjs finds cards whose work already merged but whose status never flipped (106 candidates on 2026-09-22). It is report-only on purpose: a merged PR can be a slice or a note (#3467 was a false positive). Nobody reads the report, so the strandings sit as fake claims on /wip. Add a /wip Needs-you row per candidate in the #3383 subtree, with the matched PR and a one-tap resolve/keep, so the human triage the sweep asks for actually happens.

## Done when

1. **Executable** — a `plateau:src/wip/wip-model.ts` unit test: a card in the subtree that the sweep matches to a merged PR lands in Needs you with that PR linked, instead of in Doing as a suspect claim.
2. **Observed** — on the live /wip page, a known stranding shows under Needs you with its PR, and resolving it from there removes it on the next snapshot.
