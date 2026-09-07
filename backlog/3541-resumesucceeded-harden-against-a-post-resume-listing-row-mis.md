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
graduatedTo: none
tags: []
---

# resumeSucceeded: harden against a post-resume listing row missing the id field

PR #1966's independent review (correctness finding, 3544): resumeSucceeded (we:scripts/operations/dispatch-lane-io.mjs) confirms a resume solely by matching the CLI printed short id against a listing row id field, but that same file's own listedSessionIds docblock documents id as absent from roughly half of a live listing. If a post-resume row for a genuinely-resumed session omits id, resumeSucceeded finds no match, reports resumed:false, and dispatchFix then stops the very session that was just handed new work -- strictly worse than never attempting a resume. NOTE for whoever picks this up: a naive fallback of is requestedSessionId still listed at all does NOT work -- it was tried and rejected during this item's own build, because the original session stays listed under either outcome (genuine resume or a fork), so that check cannot tell resume apart from fork at all. A real fix needs a way to confirm the SPECIFIC printed id actually IS the requested session even when its own id field is missing (for example: verify id is reliably present for every kind:background row the way we:scripts/conveyor/session-reaper.mjs already verified live for its own domain, and prove it with a test that supplies a post-spawn row missing id).

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs -t "3541"` is green after this item lands. The tests supply the exact card scenario (a post-spawn row missing `id`) directly and assert the landed, safe behavior.

## Resolution — no full fix; the honest answer is a documented safe fallback, arrived at after two rejected attempts

**What was actually true, measured.** A live `claude agents --json --all` read (CLI 2.1.263, 2026-09-06) found
259/259 `kind:'background'` rows carrying `id` and 0/4 `kind:'interactive'` rows carrying it — the exact split
`we:scripts/conveyor/session-reaper.mjs`'s own header already measured for its domain on 2026-09-03 (204/204 vs
0/4). `listedSessionIds`'s "absent from roughly half the listing" is entirely the `interactive` half; a
`background` row missing `id` — the scenario this item worried about — has never once been observed live.

**Two positive fallbacks were built, and independent review found a real hole in each.**
1. *Round 1:* when the `id`-match found nothing, fall back to "no new `sessionId` exists anywhere since
   `agentsBefore`, and the requested session is still listed ⇒ resumed". An independent reviewer (dispatched via
   `we:scripts/operations/review-dispatch.mjs` against PR #1970) found this could answer `true` on the very
   FIRST post-resume read, on the strength of a fork whose row simply had not propagated into the listing yet —
   indistinguishable from a clean resume at that instant.
2. *Round 2:* gated the same fallback on `isFinalAttempt` — only trust the absence-of-evidence once
   `dispatchFix`'s retry loop reaches its last attempt. A SECOND independent review round found this only
   bounds the wait to `RESUME_CONFIRM_MAX_ATTEMPTS × RESUME_CONFIRM_WAIT_MS` (~600ms), and nothing proves a
   fork's row always propagates that fast.

**Round 2's finding was checked empirically rather than argued away.** A live probe (2026-09-07): spawn a fresh
`claude --bg` session, then poll `claude agents --json --all` for its row every ~700ms. It had **still not
appeared after 26+ seconds** on this same machine, under its ordinary background-session load. No fixed short
retry budget can outrun a lag of that shape, and `dispatchFix` cannot afford to block tens of seconds per resume
attempt either — it is a synchronous call inside a waker pass that is supposed to stay fast and fail-soft.

**The conclusion: there is no reliable way to positively confirm a resume from the listing alone, within a
budget this call site can afford, once the `id`-match itself is empty.** Both rejected designs tried to prove a
universal negative ("no new session exists ANYWHERE") from a snapshot read, and a snapshot read against a
listing with unbounded propagation lag can never prove that at any fixed budget — restating, at a different
timescale, the SAME reason the item's own originally-rejected naive check ("is `requestedSessionId` still
listed at all") could never work either.

**The landed fallback direction: false-stop over false-resume, argued explicitly.** `resumeSucceeded` does not
attempt a positive fallback. On a missing `id` it answers `resumed:false` — exactly the pre-#3541 behavior — and
`dispatchFix`'s existing `stop(printedId)` cleans up, which is correct for an actual fork and merely a wasted
(recoverable) attempt for the never-observed missing-`id` shape. This is the safer direction given the stakes on
each side: a false stop costs one wasted resume attempt plus a redundant fresh dispatch, and the fix still
lands; a false resume reports success while the real work silently never happens (the untouched candidate never
receives the new prompt) and leaves an unmanaged forked session running unstopped, with nothing to signal that
anything went wrong. Between a residual that has NEVER been observed (missing `id`) and one just MEASURED to be
real and immediate (unbounded listing lag), trading the second for a hedge against the first is the wrong trade.

**The one real improvement that shipped: an `anomaly` diagnostic, never a verdict input.** When the `id`-match
fails but the requested session IS still listed under a row carrying no `id` at all, `resumeSucceeded` now names
that shape (`anomaly: 'requested-session-listed-without-id'`) on its return, and `dispatchFix` rides it onto
`resumeAttempt` — so if this never-yet-observed shape is ever actually hit, it is visible on the record instead
of being silently indistinguishable from an ordinary fork. It never changes the `resumed:false` verdict.

Proven by `we:scripts/operations/__tests__/dispatch-lane.test.mjs`'s "resumeSucceeded — a MISSING `id` on the
post-resume row resolves `false`, with an anomaly diagnostic (#3541)" block — including the exact card scenario
(a post-spawn row missing `id`, supplied directly) and a case where the fork's row never propagates within the
retry budget at all — and `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`'s two `#3541` tests
(end-to-end through `dispatchFix`, asserting `resumed:false`, the correct `stop()` call, and the anomaly's
presence/absence).
