---
bornAs: xsc9w09
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-25"
tags: []
---

# Declare an operation that dispatches an independent review to a fresh session

An author can RUN review-pr; what they cannot do is record the acceptance. `we:scripts/review-set-label.mjs:586` refuses only `--to=accepted`, and only on a proven self-clear. So a bounce needs no separate session and an ACCEPT always does — and a subagent inherits its parent's id, so a panel spawned from the authoring session is still one actor. Something must spawn a non-author session and nothing declares it: `dispatch-lane` takes `--num` and never takes a lane, so it cannot serve this. Measured 2026-08-25: ten review mandates hand-written in one session, the largest single source of repeated orchestration that day.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
