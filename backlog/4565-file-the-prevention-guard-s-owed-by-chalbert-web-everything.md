---
bornAs: xh98vyj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "fc502a8a94f1d1971b3483f0db29b3d943f7588a"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3034's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Bound trailing-report parsing in `we:scripts/operations/probation-build-run.mjs:666-685`; cover a large JSONL stream followed by stderr text. The original scan and complexity requests are one prevention guard with executable regression coverage.
2. Correct the advisory-only comment in `we:scripts/operations/build-dispatch-hold-route-land.mjs:174` and test that possible-blocker hints never create dependency edges. Use the original review's permitted wording correction until a verified consumer exists.
3. Close the explicitly reported stale-log bypass in `we:scripts/operations/probation-build-run.mjs:786-798` and extend freshness coverage in `we:scripts/operations/__tests__/probation-build-run.test.mjs:754-764`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3034@70619765cef5c33a826a72bd43594cb3d5617561

## Progress

Preparation research against checkout `fc502a8a94f1d1971b3483f0db29b3d943f7588a`:

- **Old premise/scope:** four review debts cited capture at lines 493/497, freshness at line 599, and blocker handling at line 164. Scope named two operation modules and their two existing test files.
- **Corrected premise/scope:** the same four files remain sufficient; the two scan debts overlap. Capture now lives at `we:scripts/operations/probation-build-run.mjs:666-685`, freshness at `we:scripts/operations/probation-build-run.mjs:786-798`, and advisory blocker extraction at `we:scripts/operations/build-dispatch-hold-route-land.mjs:174-186`. No broader lint infrastructure or automatic dependency consumer is needed for this bounded prevention item. Both source entries already have their matching existing test entries in scope.
- **Observed evidence:** a direct call to capture with 1,000 noise JSONL rows plus a stderr tail took 16 ms; 4,000 rows took 288 ms on this checkout. These are diagnostic observations, not portable timing thresholds. The source retries suffix construction and parsing for every column-zero opening brace.
- **Observed freshness failure:** a temporary launcher printed a report naming its unchanged default log, with no final message. The real worker IO returned the log's old `STALE` message. The `!reportedPath` condition bypasses the signature comparison when the report explicitly names that same file.
- **Consumer evidence:** `we:scripts/operations/build-dispatch-hold-route-land.mjs:174-186` emits prose hints only. The prepare envelope regression in `we:scripts/operations/__tests__/probation-build-run.test.mjs:910-913` rejects a worker adding `blockedBy`. The brief in `we:skills-src/conveyor/prepare-item-worker-brief.md` also permits only scope and preparation metadata changes. Thus a prepare-side edge-setting test would promise behavior this path does not implement. Correct the comment as the original review explicitly allowed.

## Design

In `we:scripts/operations/probation-build-run.mjs`, cap trailing-report parsing at eight column-zero opening-brace candidates, scanned newest first. Count failed candidates toward the cap. Preserve whole-report precedence for ordinary compact and pretty-printed reports, then retain the existing linear JSONL fallback. This bounds suffix construction to a constant number of attempts instead of one attempt per stream row; do not suppress useful failure diagnostics merely because the launcher exits unsuccessfully.

Apply freshness checking even when the report explicitly names the configured log. Resolve paths before comparing identities; only read the log whose signature was captured before launch (the explicit log argument or provider default). An unobserved alternate reported path cannot establish freshness and must yield no log fallback. Preserve report and current-stream messages, newly created or changed configured logs, and missing-log tolerance. Keep the pure capture helper's injected reader interface; enforce filesystem freshness in the real IO shell.

In `we:scripts/operations/build-dispatch-hold-route-land.mjs`, replace the comment promising prepare-side verification with an accurate statement: hints are advisory, this writer does not set `blockedBy`, and any future consumer must verify dependencies before promotion. Keep hint extraction, deduplication, self-exclusion, and existing frontmatter preservation unchanged. This takes the review's wording-correction alternative; dependency automation remains outside this item.

## MVP

1. Implement the eight-candidate bound and freshness correction in `we:scripts/operations/probation-build-run.mjs`.
2. Add focused capture and real-IO regressions in `we:scripts/operations/__tests__/probation-build-run.test.mjs`.
3. Correct the advisory comment in `we:scripts/operations/build-dispatch-hold-route-land.mjs` and add an assertion in `we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs` that hints do not add or alter dependency metadata.

## Test plan

- In `we:scripts/operations/__tests__/probation-build-run.test.mjs`, generate thousands of valid noise rows followed by malformed stderr text. Spy on JSON parsing with restoration in a finally block: assert no more than eight multiline suffix parse attempts, separately from per-line fallback parsing. Preserve an earlier completed agent message. This deterministic work bound replaces a flaky wall-clock limit and covers both original scan debts.
- Cover compact and pretty-printed final reports, report precedence over stream messages, and malformed tails. Run a real temporary launcher emitting the large stream plus a stderr tail to exercise merged diagnostic output.
- Extend the existing provider-parametrized real-IO freshness test with an unchanged log explicitly referenced by a report containing no final message; require an empty message. Cover relative and absolute references to the configured log, explicit log arguments, newly created/changed logs, missing logs, an unobserved alternate reported path, and current report/stream text taking precedence.
- In `we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs`, feed a standalone decline naming a possible blocker. Assert the hint appears, absent `blockedBy` stays absent, and an existing `blockedBy` value is preserved. No filesystem-backed blocker lookup is promised by this pure formatter.

## Proof plan

Run the focused Vitest suites for `we:scripts/operations/__tests__/probation-build-run.test.mjs` and `we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs`. First demonstrate that the new bounded-work and explicitly reported unchanged-log regressions fail on the pre-fix implementation; then require both full suites to pass with the implementation. Record the commands, failing assertions, and passing totals in this card during delivery. The formatter test locks in an existing boundary and need not fail before the change.

Run `npm run check:standards` during delivery. Use temporary local launchers and logs only; these proofs require no live model invocation, dispatch, commit, or PR. Preparation itself leaves stamping and checks to the runner.

## Done when

1. The focused regressions prove at most eight suffix parse attempts for the adversarial stream and an empty captured message for an explicitly reported unchanged log.
2. Existing report precedence, fresh-log capture, stream fallback, and both focused suites pass.
3. Advisory blocker wording matches the implementation, and a regression proves hints do not mutate dependency edges.
4. `npm run check:standards` passes during delivery.

## Follow-ups

A future consumer that promotes possible-blocker hints into dependency edges must separately verify card existence, unresolved status, and dependency validity at its mutation boundary. This item neither introduces that consumer nor changes the prepare envelope. A repository-wide loop lint is unnecessary for this local guard; the deterministic bounded-work regression covers the owed prevention without expanding scope.
