---
bornAs: x3gdu12
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-06"
tags: []
---

# resumeSucceeded: harden against a post-resume listing row missing the id field

PR #1966's independent review (correctness finding, 3544): resumeSucceeded (we:scripts/operations/dispatch-lane-io.mjs) confirms a resume solely by matching the CLI printed short id against a listing row id field, but that same file's own listedSessionIds docblock documents id as absent from roughly half of a live listing. If a post-resume row for a genuinely-resumed session omits id, resumeSucceeded finds no match, reports resumed:false, and dispatchFix then stops the very session that was just handed new work -- strictly worse than never attempting a resume. NOTE for whoever picks this up: a naive fallback of is requestedSessionId still listed at all does NOT work -- it was tried and rejected during this item's own build, because the original session stays listed under either outcome (genuine resume or a fork), so that check cannot tell resume apart from fork at all. A real fix needs a way to confirm the SPECIFIC printed id actually IS the requested session even when its own id field is missing (for example: verify id is reliably present for every kind:background row the way we:scripts/conveyor/session-reaper.mjs already verified live for its own domain, and prove it with a test that supplies a post-spawn row missing id).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
