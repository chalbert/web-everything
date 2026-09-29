---
bornAs: x21soye
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/operations/completion-store.mjs", "we:scripts/operations/__tests__/completion-store.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "755a028a365b4e3a32068358009c09c97d84f7a1"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2831's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4306-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md` — A fold-in checklist/lint rule requiring that any decision/story card gating a guarantee on an external or injected read (here, a listing helper) enumerate ALL of that read's documented outcomes (success/empty/error) in its ownership table and Test plan, not just the outcomes relevant to the motivating scenario.
2. `we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md:40` — Require a deterministic integration test with a configuration commit created before the ready label and merged afterward; derive the historical value from main's integration history or persist the epoch's deadline.
3. `we:backlog/4308-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md` — A deterministic review lens ("Verify that spec constraints are mathematically consistent") or a truth-check red-team step (like the Jury refinement method) would catch it.
4. `we:backlog/4306-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md` — A lint rule enforcing `finally` cleanup blocks for temp file handles, or a property-based test that asserts directory size remains constant after simulated concurrent accesses.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2831@4fdc1a012e71c0abc34bf163530b11ac605e124f

## Design

These four findings are independent debt items from one review; there is no single code change that
closes all four, and folding them into one PR would violate the small-file/single-responsibility
preference. Premise check (2026-09-29, against `main`): none of the four is already done — a full-text
search of `backlog/` and of `git log --all` for each finding's own language (temp-file `finally`
cleanup, an outcome-enumeration lint, a git-history integration test for the overlap-yield window, a
spec-consistency review lens) found no existing card or landed commit covering any of them. Scope was
corrected above from the two *cited* cards (`we:backlog/4306`/`we:backlog/4308` — those are the review's
citation anchors, already resolved, not files this item touches) to the real touch-set of the one
finding built here.

## MVP (this item builds ONE finding; the other three are filed as follow-ups)

**Finding 4** — "A lint rule enforcing `finally` cleanup blocks for temp file handles, or a
property-based test that asserts directory size remains constant after simulated concurrent
accesses" — is the one built here. It is the only one of the four that is (a) about code that already
exists and is already merged (`we:scripts/operations/completion-store.mjs`'s `writeCompletion`, shipped
by `we:backlog/4306`), (b) reproducible as a real, non-mocked failure (no new subsystem or design
needed), and (c) fully self-contained in one file + its test. `writeCompletion`'s atomic
temp-file-then-rename write had no cleanup on a failed rename (a real `EISDIR`/`ENOTDIR`/disk-full/
permission error between the write and the rename) — the `.tmp` file was left on disk forever, with
nothing to reap it. Fixed with a `try/finally` that removes the temp file on any throw, before the
original error propagates (a cleanup failure never masks the original error).

The other three findings (1, 2, 3) each need their own design pass (a new content-lint heuristic, a real
git-fixture integration test, a new review lens) that would grow this item past a single, reviewable
change — filed as their own cards instead (see Follow-ups).

## Test plan (fails before the fix)

`we:scripts/operations/__tests__/completion-store.test.mjs` — new case *"leaves no temp file behind when
the write fails partway through (a real rename failure, not a mock)"*: creates the completion record's
destination path as a directory (so `renameSync(tmp, path)` throws real `EISDIR`), calls
`writeCompletion`, asserts it still throws, then asserts no `.tmp` file remains in the completions
directory. It is one example-based case (a real, non-mocked `EISDIR`), not a property-based test over many
inputs — this MVP built the narrower of finding 4's two offered shapes. **Confirmed RED on `main`** before
the fix (the `.tmp` file was left behind); **confirmed GREEN** after the `try/finally` fix, with the wider
`vitest related` run this touch-set selects (128 test files / 5417 tests) otherwise unchanged.

## Proof plan (live, before/after)

- **Before:** ran the new test against the pre-fix `writeCompletion` (via targeted `vitest related` on
  the two touched files) — failed with the leaked `.tmp` file listed in the directory, matching the
  finding's own "directory size does not remain constant" framing exactly.
- **After:** same command, same test, GREEN; the full related-test run (5417 tests) is unaffected,
  confirming the change is additive (an error path only, no behavior change on the success path).

## Follow-ups (filed via the `file-item` operation, not built in this item)

1. **Finding 1** (outcome-enumeration lint) → `4485` — a `check:standards` content-lint rule requiring
   a decision/story card that gates a guarantee on an external/injected read to enumerate every
   documented outcome of that read in its Ownership table / Test plan.
2. **Finding 2** (git-history integration test for the overlap-yield window) → `4486` — a real-git-fixture
   integration test proving `windowMsAtLabelTime` reads the settings-file commit in effect AT a PR's
   `readyAt(X)`, never a later widening, against a real repo history rather than an injected fake reader.
3. **Finding 3** (spec-consistency review lens) → `4487` — a new deterministic jury lens or red-team step
   that checks a spec's own stated rules/invariants for mutual contradiction or an unhandled edge case,
   independent of whether the code matches the spec.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest related we:scripts/operations/completion-store.mjs we:scripts/operations/__tests__/completion-store.test.mjs --run --passWithNoTests` exits 0 with the new test passing (run the command from the WE repo root without the `we:` prefix); reverting the `try/finally` in `writeCompletion` makes that same test fail.
2. `writeCompletion` never leaves a `.tmp` file behind in the completions directory when the write-then-rename pair throws, for any reason.
3. Findings 1–3 are each filed as their own backlog item (`4485`, `4486`, `4487`), each carrying a design gist, named edge cases, and a required integration/wiring test per build-brief discipline — not half-built here.
