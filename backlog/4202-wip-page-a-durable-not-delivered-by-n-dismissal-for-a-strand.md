---
bornAs: xkol9y8
kind: task
parent: "4075"
status: open
scope: ["plateau:src/wip/wip-model.ts", "plateau:src/wip/stranded-read.ts", "plateau:src/wip/wip-read.ts"]
dateOpened: "2026-09-25"
tags: []
---

# WIP page: a durable 'not delivered by #N' dismissal for a stranded row that's only a slice or a note

Follow-up from 4201. plateau:src/wip/wip-model.ts's needs-you 'merged' row (fed by plateau:src/wip/stranded-read.ts, which loads we:scripts/backlog-stranded-sweep.mjs's own sweepStrandings — the identical matcher we:scripts/conveyor/health-smells/stale-claim.mjs's own class-B 'matched' tier uses) re-asks the SAME question every 10s poll once a card is confirmed to be only a slice/note, because nothing records that confirmation. The health-watch layer already has a generic per-(smell,subject) dismissal (tracked-silence, we:scripts/conveyor/health-watch.mjs's silence/unsilence, we:scripts/conveyor/health-watch-core.mjs's stepEpisodes tracked-silence handling) — that already durably quiets stale-claim's own 'landed:<id>' episode. This item is scoped to the WIP PAGE'S OWN UI: a small plateau-app change (a dismissedPrs-style card annotation, or a WIP-page-local note store) so confirming 'this PR was only a slice' in the WIP UI itself stops that specific row from re-asking. Filed, not built, per the operator's own instruction not to hand-edit plateau-app from a WE-repo session.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
