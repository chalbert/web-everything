---
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: []
---

# file-item-io's alreadyQueued check uses raw string equality instead of queue-store's normNum, can misreport on a differently-formatted duplicate id

Independent review of #1991 (graduating we:scripts/operations/file-item.mjs to main) found: we:scripts/operations/file-item-io.mjs:401's queue sink computes 'already queued' via String(e.num) === String(payload.num), not we:scripts/conveyor/queue-store.mjs's own normalizing normNum comparison that addToQueue uses internally. CONFIRMED: seeding we:.conveyor/queue.json with a zero-padded entry {num:'042'} and calling the sink with payload.num='42' (normNum-equal) still returned alreadyQueued:false and rewrote the file, misreporting a fresh clear that did not happen (addToQueue's own idempotency still held — no duplicate or corruption, only the returned flag is wrong). Unreachable via we:scripts/operations/file-item.mjs's own normal call path today (payload.num always comes from a freshly-allocated, collision-free verdict.num), so impact is cosmetic unless we:.conveyor/queue.json formatting conventions drift or gets hand-edited. No existing test in we:scripts/operations/__tests__/file-item-io.test.mjs exercises a differently-formatted duplicate. Fix: reuse we:scripts/conveyor/queue-store.mjs's exported queueHas(before, payload.num) for the 'already' flag instead of the local strict-string comparison, so there is exactly one definition of queue membership.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
