---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-smells/repeated-refusal.mjs", "we:scripts/conveyor/health-smells/no-progress.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-refusal.test.mjs", "we:scripts/conveyor/health-smells/__tests__/no-progress.test.mjs", "we:scripts/conveyor/health-smells/index.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: detect a repeated identical refusal and a PR with no progress between two checks

Operator, 2026-10-02. Two new detectors. (1) repeated-refusal: the same PR refused for the same reason by a daemon N times in a row (2026-10-01: #3336 stale-check-refused every tick for hours; #3432 review loop, about 17 runs). (2) no-progress: an open PR whose head, labels and checks have not changed across two checks a set interval apart (the operator standing rule: a PR that did not move between two checks gets dug into). Both feed the responder; their default action is the investigation and root-cause card of story x0zwwxn, plus escalation. Replay #3336 and #3432 from the daemon logs.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
