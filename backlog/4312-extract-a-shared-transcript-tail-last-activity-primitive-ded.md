---
bornAs: xo9fynf
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/hung-session.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "755a028a365b4e3a32068358009c09c97d84f7a1"
tags: []
---

# Extract a shared transcript-tail last-activity primitive (dedupe we:scripts/conveyor/session-reaper.mjs and we:scripts/conveyor/hung-session.mjs)

we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs (added by #4306) is a third near-duplicate of the tail-read + newest-entry-timestamp logic already in we:scripts/conveyor/hung-session.mjs's readIdleFinishedInfo and readHungInfo. Extract one shared low-level primitive (bounded transcript tail read -> newest parseable entry timestamp, with an mtime fallback) that all three call, so a future fix to the tail-parsing/mtime-fallback logic needs applying in one place, not three. Independent panel review finding from #4306's own converge pass (simplicity lens, carve-out: introduced, worse-than-base, parallelizable -- cosmetic impact if unfixed). Done when: one shared exported helper exists in we:scripts/conveyor/hung-session.mjs, we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs and we:scripts/conveyor/hung-session.mjs#readHungInfo/#readIdleFinishedInfo all call it (no behavior change), and each of the three call sites' existing tests still pass unchanged.

## Design

Confirmed on `origin/main` (sha `755a028a3`): `we:scripts/conveyor/hung-session.mjs#readHungInfo` and
`#readIdleFinishedInfo` each resolve the session's transcript, tail-read it (`READ_TAIL_LINES`/
`READ_MAX_BYTES`), map lines through `summarizeEntry`, scan for the newest parseable `ts`, and fall back to
the file's `mtime` when no entry carries one. `we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs`
(#4306) is a third copy of the identical shape with its own constants
(`BLOCKED_ON_INFRA_TAIL_LINES`/`_MAX_BYTES`/`_FIELD_MAX` — 60/600_000/4000 — vs the other two's
15/400_000/200), plus its own injectable IO (`resolveTranscript`/`tailLinesFn`/`summarizeEntryFn`/`statFn`).
Not already fixed; not superseded.

One divergence found between the copies: `readHungInfo`/`readIdleFinishedInfo` wrap `tailLines(...).map(...)`
in a single try/catch, so ONE unparseable line aborts the whole read (`no-signal`). `resolveLastActivityMs`
wraps `summarizeEntryFn` per-line instead, so one bad line is skipped and the scan continues (this exact case
has its own test: `we:scripts/conveyor/__tests__/session-reaper.test.mjs` — "one unparseable line never
aborts the scan"). These are genuinely DIFFERENT requirements, not an accidental drift to unify away: only
`readHungInfo`/`readIdleFinishedInfo` derive a pending-tool-call verdict from `entries`
(`detectBlockedOnChild`), and a `entries` array missing a dropped line is indistinguishable from "that line
never had a tool call" — acted on, that can reap a session genuinely still mid a call. `resolveLastActivityMs`
never reads `entries` for anything, so it has no such exposure. (Converge review, round 1: the FIRST attempt at
this card unified both onto the tolerant shape and called it "strictly safer" for every caller; the security
lens caught that this holds only for `resolveLastActivityMs` — see the design below, which keeps the two
policies distinct instead.)

Add one exported primitive to `we:scripts/conveyor/hung-session.mjs` — `readTranscriptTailActivity(session,
{ tailLines, maxBytes, fieldMax, resolveTranscript, tailLinesFn, summarizeEntryFn, statFn })` — that owns ONLY
the mechanical read: resolve → tail-read → per-line-tolerant parse (skip on failure, keep scanning) →
newest-`ts` scan → mtime fallback. Returns `{ file, entries, lastActivityMs, hadUnparseableLine }` or `null`
(missing `cwd`/`sessionId`, unresolvable/unreadable transcript, or a failed mtime fallback with nothing
parsed at all). `hadUnparseableLine` reports whether ANY line failed, so each CALLER can apply its own policy
on top — the primitive itself never rejects a read just because some line failed to parse. Tail size/byte
cap/field cap and every IO function stay caller-injected (the two call sites' constants differ, so the
primitive must not hardcode either set).

`readHungInfo`/`readIdleFinishedInfo` check `hadUnparseableLine` themselves: if true, they answer no-signal
outright, ignoring whatever `entries`/`lastActivityMs` the primitive tolerantly computed — this is
BYTE-IDENTICAL to their pre-#4312 shape (any unparseable line, anywhere in the tail, already aborted the whole
read via the old single try/catch around `.map()`). `resolveLastActivityMs` ignores `hadUnparseableLine`
entirely and just uses `tail.lastActivityMs` — also byte-identical to its own pre-#4312 shape, since it was
always the tolerant one. **This is now a genuine "no behavior change" for all three call sites** — the shared
primitive's own tolerance is real, but each caller's use of it reproduces exactly the policy it already had,
never a new one.

## MVP

Musts only:
- One new exported function in `we:scripts/conveyor/hung-session.mjs` implementing the shared read, returning
  `hadUnparseableLine` alongside `entries`/`lastActivityMs` so each caller can apply its own policy.
- `readHungInfo`/`readIdleFinishedInfo` (`we:scripts/conveyor/hung-session.mjs`) call it and refuse the whole
  read (no-signal) when `hadUnparseableLine` is true — their pre-#4312 behavior, unchanged.
  `resolveLastActivityMs` (`we:scripts/conveyor/session-reaper.mjs`) calls it and ignores
  `hadUnparseableLine` — its own pre-#4312 tolerant behavior, unchanged. No other logic in those three
  functions changes.
- Every existing test in `we:scripts/conveyor/__tests__/hung-session.test.mjs` and
  `we:scripts/conveyor/__tests__/session-reaper.test.mjs` passes unchanged.
- New regression tests locking in: (a) the primitive's own tolerance + `hadUnparseableLine` reporting
  (position-independent), and (b) each caller's distinct policy on top of it — `readHungInfo`/
  `readIdleFinishedInfo` refuse on ANY unparseable line anywhere in the tail; `resolveLastActivityMs` tolerates
  one regardless of position. (Round-1 review found the FIRST attempt's tests covered only a benign
  bad-line-is-older shape for the two destructive callers — this closes that gap.)

Out of MVP (no behavior change anywhere, no new callers, no touching `classifySessionReapWithGroundTruth`'s
axes, no touching `NO_OUTCOME_*`/auth-expired logic — unrelated to this dedupe).

## Test plan

- `we:scripts/conveyor/__tests__/hung-session.test.mjs`: the primitive's own "one unparseable line never
  aborts the scan" case now also asserts `hadUnparseableLine: true`, plus a clean-tail case asserting it
  `false`, plus a position-independence case (bad line newest, primitive still tolerates it) and a malformed-
  `tailLinesFn`-result case (non-array `lines` answers `null`, never throws).
- `we:scripts/conveyor/__tests__/hung-session.test.mjs`: `readHungInfo`/`readIdleFinishedInfo` each get ONE
  test asserting no-signal for an unparseable line in EITHER position (older or newest) in the same tail as a
  real timestamp. **Neither position was actually RED against the pre-#4312 code** — its single try/catch
  around `.map()` already aborted on a bad line anywhere, so both new caller-level tests already pass
  unchanged against the old code too (only the `readTranscriptTailActivity` describe block's own tests are RED
  pre-extraction, because that export doesn't exist yet — see Proof plan). These two tests exist to LOCK IN,
  not to catch a regression: the previous card version wrongly implied the "newest" half was new coverage of
  changed behavior; it is new coverage of unchanged behavior.
- `we:scripts/conveyor/__tests__/session-reaper.test.mjs`: `resolveLastActivityMs` keeps its existing
  bad-line-older case and gets a new bad-line-newest case, both asserting the SAME tolerant result — same
  "locks in, doesn't catch a regression" character as above.
- Full existing suites for both files run unchanged and stay green (dedup must be behavior-preserving for
  every already-tested path).

## Proof plan

This is a behavior-preserving refactor, not a bug fix — so the "before" state is "the new tests physically
cannot run", not "the old code answers wrong". Proof: swap `we:scripts/conveyor/hung-session.mjs`/
`we:scripts/conveyor/session-reaper.mjs` back to their pre-#4312 (`origin/main`) content with the NEW test
files in place, run the full targeted suite — the `readTranscriptTailActivity` describe block's own tests fail (that export
doesn't exist pre-#4312; every other test, including the new `readHungInfo`/`readIdleFinishedInfo`/
`resolveLastActivityMs` position-independence cases, already passes against the OLD code too, since none of
those three callers' observable behavior actually changed). Then restore the post-#4312 source — all tests
green. Captured verbatim (both runs) in the PR body.

## Follow-ups

None — this is a pure internal dedupe with no scope creep; nothing else was found worth filing separately.

## Done when

1. **Executable** — the literal command below (repo-relative paths, not the `we:` citation prefix used
   elsewhere in this card — a #4312 converge-review finding: the citation form isn't a real filesystem path and
   `vitest` can't resolve it) fails before this item lands (`readTranscriptTailActivity` doesn't exist yet, so
   the new tests importing it error out) and passes after (shared `readTranscriptTailActivity` exists in
   `we:scripts/conveyor/hung-session.mjs`, all three call sites use it, and every existing + new test is
   green — see Proof plan for why this is a "doesn't exist yet" red, not a behavior-regression red):
   ```bash
   npx vitest run scripts/conveyor/__tests__/hung-session.test.mjs scripts/conveyor/__tests__/session-reaper.test.mjs
   ```
