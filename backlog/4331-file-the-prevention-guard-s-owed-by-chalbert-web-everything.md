---
bornAs: xoebb7z
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/conveyor/guard-1c-mutation-check.mjs", "we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "d72504a07100a8583235f6b0112aa87c9807f0ba"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2834's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/session-reaper.mjs:481` — Extract the shared activity-time primitive and add a targeted duplicate-code check. Backlog item 4312 already records the extraction, but its executable guard remains TODO.
2. `we:scripts/conveyor/__tests__/session-reaper.test.mjs` — Add isolated timestamp-refusal fixtures with legacy or matching identities, and a targeted mutation gate requiring those named tests to fail when Guard 1(c) or its pass-level wiring is disabled.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2834@6bb04de4350d279d600ea0d5690a19e97c67cc7d

## Design

Premise check (against `origin/main` `d72504a07`): still owed, not superseded. Card #4312 is `resolved`
and did the extraction: `we:scripts/conveyor/hung-session.mjs#readTranscriptTailActivity` (line 151) now
holds the one tail-read + newest-`ts` + mtime-fallback loop, and
`we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs` (line 489) just forwards to it. What is
missing is the two executable guards, so a future edit cannot quietly undo either.

**Guard 1 — duplicate-code check.** Add one test to `we:scripts/conveyor/__tests__/session-reaper.test.mjs`
that reads `we:scripts/conveyor/session-reaper.mjs` source text and fails if the reaper re-grows its own copy of the loop. The
markers are: (a) no `Date.parse(` applied to a transcript entry's timestamp field inside the file (today the only
`Date.parse` uses are on record/listing timestamps, so the test pins an explicit allow-list of the exact
lines), (b) `resolveLastActivityMs` body must contain a call to `readTranscriptTailActivity`, and (c)
`we:scripts/conveyor/session-reaper.mjs` must not call `statFn(`/`statSync(` inside `resolveLastActivityMs` (the mtime fallback
belongs to the primitive). Cheap, text-level, no new dependency.

Rule tightening (review): do not pin `Date.parse` by line number. Forbid the loop's real fingerprints
instead — `entry?.ts`, `.ts ??`, and `summarizeEntryFn(` — anywhere in the file outside comments. Rule (c)
extracts the `resolveLastActivityMs` body from `export function resolveLastActivityMs` to the next `\n}\n`
(not the docblock, which names these words).

**Guard 2 — isolated timestamp-refusal fixtures.** The existing Guard 1(c) tests (test file lines 1162-1190,
1430-1470) use one record with a FOREIGN-looking id (`bStarted.sessionId = 'B'`), so guard (a) can refuse
first and mask (c). The existing pass-level test masks it too: its record has `sessionId: 'A'` but the
listing row has `sessionId: 'sess-A-guard1c'`, so (a) refuses before (c). Add fixtures where (a) and (b) provably cannot fire, so only (c) can refuse: a record
with `sessionId: null` (legacy, `isForeignCompletionSessionId` → false per `we:scripts/operations/completion-record.mjs:158`) and a
record whose `sessionId` equals the reaped session's. Each has a `started` `startedAt` later than
`lastActivityMs`. One unit case drives `planBackstopCompletion`; one pass-level case drives
`runSessionReaperPass` with a REAL temp transcript (same `CLAUDE_PROJECTS_DIR` + `vi.resetModules()` recipe as
the existing test at line 1430). Name them with a shared prefix, `Guard 1(c) isolated:`.

The pass-level isolated test uses ONE listing row (so (b) is inert), a terminal state, and a row `sessionId`
equal to the transcript filename and to the record's `sessionId` (or the record's is null); the transcript
entry is ~20 minutes stale and the record's `startedAt` is now.

**Mutation gate.** New script `we:scripts/conveyor/guard-1c-mutation-check.mjs`:
- Copies `we:scripts/conveyor/session-reaper.mjs` to a uniquely named sibling (relative imports keep working),
  cleaned up in a try/finally. Applies each of two source mutations — disable the comparison
  (`recStartedMs > lastActivityMs` → `false`) and disable the pass-level wiring (`resolveLastActivityMs(session)`
  → `null`). Each search string must occur EXACTLY once or the script refuses (a rename cannot turn the gate
  into a no-op).
- Redirecting the test at the mutant: the test file imports the module statically and dynamically. The script
  writes a generated vitest config that spreads the repo config and adds a `resolve.alias` mapping the
  reaper module path to the mutant (different basename, so no loop). The original file is never swapped.
- Judgment uses `--reporter=json`, not exit code: the unmutated run must show at least 3 named
  `Guard 1(c) isolated` tests PASSED; under each mutant the expected named tests must have status `failed`
  with an assertion error, and a run where the suite failed to load or collected zero tests is refused (a
  syntax-broken mutant is not "killed"). Comparison mutant must kill the unit + pass-level tests; wiring
  mutant must kill the pass-level one.
- Testability seam: the script exports `run({ mutations, runVitest, readFile, ... })` and the CLI wraps it;
  its own test injects a fake `runVitest` (no vitest inside vitest).
Scope gains this script and its test (frontmatter already updated).

## MVP

Musts only:
1. The duplicate-code source test (Guard 1) in the existing reaper test file.
2. The isolated legacy-id and matching-id refusal fixtures, unit + pass-level (Guard 2).
3. The mutation script proving those tests fail when `(c)` or its wiring is disabled, plus one test of the
   script's own "search string not found → refuse" path.
   The script exposes an injectable `run()` so that test needs no nested vitest.

Out of scope (Follow-ups): wiring the mutation script into `check:standards`/CI; a general mutation framework;
a repo-wide duplicate-code detector.

## Test plan

- `Guard 1: no local transcript-timestamp loop in we:scripts/conveyor/session-reaper.mjs` — asserts the marker rules above. RED
  before: verify by temporarily pasting the old `Date.parse(...)` entry-timestamp loop into the file; the test must fail.
- `Guard 1(c) isolated: legacy record (sessionId null) with later startedAt refuses` — asserts
  `planBackstopCompletion` → `null`. Would go RED if `(c)` were deleted, because with (a) inert nothing else
  refuses (existing tests miss this: `bStarted` trips (a) first).
- `Guard 1(c) isolated: matching-sessionId record with later startedAt refuses` — same assertion, other identity.
- `Guard 1(c) isolated: pass-level wiring refuses with a REAL transcript` — `runSessionReaperPass` with a
  legacy record; `written` stays empty. RED if the `resolveLastActivityMs(session)` call is nulled.
- `mutation script` cases: exits 0 when both mutants are killed; exits non-zero when a fake mutant survives
  (an injected no-op mutation); exits non-zero when a search string is absent.

## Proof plan

Live before/after on the real files: (1) run the new named tests on `main` code — pass; (2) run
`we:scripts/conveyor/guard-1c-mutation-check.mjs` under node — both mutants report KILLED, exit 0, output pasted into
the PR; (3) as the negative proof, run the same script against a checkout where the isolated tests are removed
(or `git stash` the test file) and show it exits non-zero because fewer than 3 named tests passed unmutated
(and both mutants would survive). Guard 1: re-add `Date.parse(entry?.ts ?? '')` inside a loop in
`resolveLastActivityMs`, paste the diff, and show the source test failing.

## Follow-ups

- Run the mutation script from `check:standards` (or a nightly) once its runtime is known.
- Same "targeted mutation gate" pattern for Guard 1(a)/(b) of `planBackstopCompletion`.
- Generalize the source-text duplicate check into a small shared helper if a second module needs one.

## Done when

1. **Executable** — run vitest on the reaper test file filtered with `-t "Guard 1"`: it passes. Then run the
   `we:scripts/conveyor/guard-1c-mutation-check.mjs` script with node: it exits 0 (both mutants killed)
   and exits non-zero when the isolated tests are absent or `(c)` is not covered.
