---
bornAs: x4vmv9w
kind: task
status: open
relatedTo: ["3149", "3162"]
dateOpened: "2026-08-17"
tags: []
---

# dispatch-lane redispatch can coexist with a supposedly-killed prior session, not replace it

Self-reported live by the we#1454 building agent (2026-08-17): the conveyor genuinely dispatched TWO separate delivery agents for #3151 at once (lane-28 and lane-29) -- the two agents found each other mid-build, compared state, and one stood down without opening a PR, folding its findings into the other's PR instead. The building agent flagged this as systemic, not item-specific: the same double-dispatch was independently observed on #3150, #3154, and #2972 too. This almost certainly traces to the orchestrating session's own kill-and-redispatch recovery pattern used repeatedly tonight for stuck `conveyor-<item>` background sessions (a session slug, not a file path) (kill the OS pid, release the lane, call we:scripts/operations/run.mjs dispatch-lane --num=<item> fresh) -- killing the OS process does not appear to reliably clear whatever in-flight bookkeeping we:scripts/conveyor/tick-core.mjs / we:scripts/operations/dispatch-lane.mjs uses to decide an item is already being built, so a fresh dispatch can spawn a genuinely new session that coexists with a zombie of the old one rather than cleanly superseding it. This is a sharper, live-reproduced instance of the same liveness-detection gap #3149/#3162 already target, but specifically on the WRITE side (what dispatch-lane does when asked to redispatch an item with a stale in-flight record) rather than the read/detection side those two items cover.

## Done when

1. **Executable** — a test asserts that calling `dispatch-lane --num=<item>` while a prior in-flight run record for that same item still exists (even if its underlying OS process is dead) either (a) refuses to dispatch a second session and reports why, or (b) marks the prior record superseded AND confirms the prior session is actually dead (not just marks the record and spawns regardless — marking a record superseded on disk cannot by itself kill a still-live agent) before spawning, so only one live dispatch session ever coexists per item — fails today (both we#1454's and this session's own live observations show two genuine dispatches for the same item coexisting), passes once one of the two behaviors is implemented.
2. Killing an OS pid alone (without going through a proper release/supersede path) is explicitly NOT sufficient to make a redispatch safe — a test simulates exactly this sequence (kill pid, do nothing else, redispatch) and asserts the operation either detects the stale record and cleans it up itself, or refuses with a clear "release the item's in-flight record first" message rather than silently spawning a duplicate.
3. Relates to #3149/#3162 (liveness detection) but is scoped to the write/redispatch side specifically, not a re-implementation of either.
4. `npm run check:standards` is 0 errors and the relevant new test file is green.
