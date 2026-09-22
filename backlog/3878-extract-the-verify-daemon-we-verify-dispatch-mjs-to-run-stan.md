---
bornAs: xt6vu5s
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3877"]
scope: ["we:scripts/conveyor/verify-dispatch.mjs", "we:skills-src/conveyor/runner-lock.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Extract the Verify daemon (we:verify-dispatch.mjs) to run standalone under its own keyed lease

we:scripts/conveyor/verify-dispatch.mjs's own header justifies its blocking safety entirely on 'the runner is a SINGLETON... so there is no risk of two dispatches racing the same lane's marker' (lines 23-27) -- a property that lives in we:skills-src/conveyor/runner.mjs today, NOT in this file; it holds no lock of its own. This is the one real gap in the whole daemon split (confirmed by direct read). Blocked on #3877 (keying we:skills-src/conveyor/runner-lock.mjs's lease): take that keyed lease under its own distinct key here BEFORE wrapping we:scripts/conveyor/verify-dispatch.mjs as a standalone daemon, then drop it from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
