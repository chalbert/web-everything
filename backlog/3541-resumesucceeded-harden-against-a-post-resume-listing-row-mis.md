---
bornAs: x3gdu12
kind: story
size: 2
parent: "3383"
status: resolved
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-06"
dateStarted: "2026-09-06"
dateResolved: "2026-09-06"
tags: []
---

# resumeSucceeded: harden against a post-resume listing row missing the id field

PR #1966's independent review (correctness finding, 3544): resumeSucceeded (we:scripts/operations/dispatch-lane-io.mjs) confirms a resume solely by matching the CLI printed short id against a listing row id field, but that same file's own listedSessionIds docblock documents id as absent from roughly half of a live listing. If a post-resume row for a genuinely-resumed session omits id, resumeSucceeded finds no match, reports resumed:false, and dispatchFix then stops the very session that was just handed new work -- strictly worse than never attempting a resume. NOTE for whoever picks this up: a naive fallback of is requestedSessionId still listed at all does NOT work -- it was tried and rejected during this item's own build, because the original session stays listed under either outcome (genuine resume or a fork), so that check cannot tell resume apart from fork at all. A real fix needs a way to confirm the SPECIFIC printed id actually IS the requested session even when its own id field is missing (for example: verify id is reliably present for every kind:background row the way we:scripts/conveyor/session-reaper.mjs already verified live for its own domain, and prove it with a test that supplies a post-spawn row missing id).

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs -t "3541"` is green after this item lands (5 tests). Neither the tests nor the production fix exist before it; reverting only the production half of this diff while keeping the tests turns 2 of the 5 red — verified directly, since a brand-new test can't "fail before it exists" in the usual sense.

## Resolution

**What was actually true, measured twice.** A live `claude agents --json --all` read (CLI 2.1.263, 2026-09-06) found
259/259 `kind:'background'` rows carrying `id` and 0/4 `kind:'interactive'` rows carrying it — the exact split
`we:scripts/conveyor/session-reaper.mjs`'s own header already measured for its domain on 2026-09-03 (204/204 vs
0/4). `listedSessionIds`'s "absent from roughly half the listing" is entirely the `interactive` half; a
`background` row missing `id` — the scenario this item worried about — has never been observed live.

**The fix anyway, because "never observed" isn't "impossible."** `resumeSucceeded`
(`we:scripts/operations/dispatch-lane-io.mjs`) keeps its existing `id`-match as the primary path (unchanged,
still proven correct for every case ever seen) and gains a FALLBACK for when that match finds nothing: it takes
an optional `agentsBefore` (the pre-resume listing snapshot `dispatchFix` already captures for its ownership
check, threaded through at no extra read cost) and reasons from `sessionId` alone, which — unlike `id` — is
present on every row of every shape. A genuine resume mints no new session, so its `sessionId` was already in
`agentsBefore`; a fork, by construction, is a new session under a fresh `sessionId` never listed before. So: if
nothing in the post-resume listing carries a `sessionId` absent from the pre-resume one, and the requested
session is still listed, nothing but a genuine resume explains it — no `id` required.

**What this does NOT claim to fully solve.** The fallback cannot tell an actual fork apart from an unrelated
dispatch (a different item's build/fix) landing in the same narrow post-resume retry window — both introduce a
"new" `sessionId`. Rather than force a complete disambiguator that does not exist, the residual ambiguity
resolves to `resumed: false` (a suspected fork) — the SAME direction `dispatchFix` already takes today on any
ambiguity. Argued in `resumeSucceeded`'s own docblock: a false stop costs a wasted resume attempt plus a
redundant fresh dispatch, but the fix still gets done; a false resume would report success while the real work
silently never happens (the untouched candidate never sees the new prompt) and leave an unmanaged forked session
running unstopped. Compounding a missing `id` (never yet observed) with a genuinely concurrent unrelated dispatch
in the same sub-second window is narrow enough that shipping this is a strict improvement over the unconditional
gap PR #1966's review found, without overclaiming a complete fix.

Proven by `we:scripts/operations/__tests__/dispatch-lane.test.mjs`'s "resumeSucceeded fallback — the post-resume
row is MISSING `id` (#3541)" block (unit-level, supplies a post-spawn row missing `id` directly) and
`we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`'s "#3541 hardening (3)" test (end-to-end through
`dispatchFix`, same missing-`id` row shape).
