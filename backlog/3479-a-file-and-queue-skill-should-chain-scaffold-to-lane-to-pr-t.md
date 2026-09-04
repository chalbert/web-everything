---
bornAs: x3c3ylx
kind: story
size: 2
parent: "3383"
status: open
blockedBy: ["3478"]
dateOpened: "2026-09-04"
tags: [conveyor, dispatch, delivery]
---

# A file-and-queue skill should chain scaffold to lane to PR to queue-target resolution into one command

Filing a real, ready idea and getting it in front of the live conveyor is three disconnected manual
steps a session has to remember and chain by hand every time:

1. Scaffold the card (`we:scripts/backlog.mjs scaffold` or the declared `scaffold` operation).
2. Land it — a lane clone, commit, verify-lane, then `/pr`.
3. Separately work out which checkout's `we:.conveyor/queue.json` sidecar the live conveyor runner is
   actually reading, and queue the newly-landed item into it — the resolution gap `3478` (this
   filing's sibling story, same parent) proposes fixing with a queue-target-resolution operation.

Each step is already scriptable/declared on its own, but nothing chains them, so a session has to
remember all three and run them in order by hand every single time an idea needs to go from "found a
gap" to "the live conveyor is building it." A single skill (name TBD — call it `/file-and-queue` for now,
not a ruling) should wrap scaffold → lane → PR → queue-target-resolve-and-clear into one command.

## Depends on

Blocked by `3478` — this item's own step 3 needs that story's queue-target-resolution operation to
exist before there is anything to chain to. Build `3478` first; this item is the thin orchestration
layer on top of it plus the existing scaffold/lane/PR machinery.

## Done when

1. **Executable** — running the new skill/command on a well-formed idea (title + digest) produces, with
   no other manual step: a landed backlog card (merged PR), AND that card's id present in the live
   runner's resolved `we:.conveyor/queue.json` — or, if the live runner's checkout can't yet see the
   newly-landed card (the same staleness class `#3472` documents), a clear report saying so rather than a
   silent partial success.
2. Each of the three chained steps still fails loudly and stops the chain on its own terms (a scaffold
   refusal, a failed verify-lane, a PR that can't land) — the skill must not swallow or retry past a
   failure in any step.
