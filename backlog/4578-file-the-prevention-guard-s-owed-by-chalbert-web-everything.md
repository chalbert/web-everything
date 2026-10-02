---
bornAs: xmy3u7x
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/guard-1c-mutation-check.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "1a0e4e56d34c40e9ad5d5cd89ca5bc96529795d5"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3057's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/guard-1c-mutation-check.mjs#run` — Match each mutant report against baseline test identities filtered by mustKill, and add a deterministic regression test requiring rejection when any expected identity is absent.
2. `we:scripts/conveyor/__tests__/session-reaper.test.mjs:1502` — A shared transcript mock factory that enforces the correct schema and types, preventing tests from hand-writing incorrect JSON log entries and relying on parser fallbacks.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3057@8cb24579eff98681fe91ce7c57f550188e1b2c98

## Done when

1. The targeted Vitest suite rejects mutant reports missing any baseline identity selected by `mustKill`, even if every reported test failed with an assertion message.
2. Valid assistant transcript fixtures share a schema-validating factory in the existing reaper test file; direct parser/resolver assertions prove embedded timestamps are used without mtime fallback.
3. Both real Guard 1(c) mutants remain killed. Execution commands and red/green evidence are specified below.

## Progress

Preparation research: the original scope named the mutation gate and its two existing test files; it implied missing-identity protection and a transcript factory were still owed. That remains true, so the write scope stays unchanged and already pairs the only production source with its matching test file.

The corrected premise is narrower than a current malformed-fixture bug: `we:scripts/conveyor/__tests__/session-reaper.test.mjs:1216` already constructs a valid assistant entry locally, while lines 1456 and 1502 hand-write the same valid shape. There are also separate text-entry helpers in that file. The debt is shared validation and prevention of future fixture drift, not a demonstrated current parser failure. The old line-1500 citation is corrected to line 1502; the mutation-gate citation now names `run` rather than a drifting line.

Source evidence: `we:scripts/conveyor/guard-1c-mutation-check.mjs#run` filters the mutant's collected tests by `mustKill`, instead of filtering the baseline identities. A preparation-time Node probe injected three passing baseline identities (unit, pass-level A, pass-level B), then returned only failing pass-level A for each mutant: the current gate returned `{"ok":true,"problems":[]}`. This directly reproduces the owed rejection gap; the goal is not already delivered.

Read-only dependencies: `we:scripts/conveyor/session-reaper.mjs#resolveLastActivityMs` delegates to `we:scripts/conveyor/hung-session.mjs#readTranscriptTailActivity`, which parses summarized timestamps and falls back to file mtime only when none parse. `we:skills-src/inspect-agent-health/agent-health.mjs:243` summarizes assistant message content and exposes the top-level timestamp as `ts` (line 276). These dependencies need no implementation changes for this prevention work.

## Design

In `we:scripts/conveyor/guard-1c-mutation-check.mjs`, keep the current baseline minimum and all-passed checks. For each mutation, derive the expected identities from the validated baseline using that mutation's `mustKill`. Match by the existing normalized full title (`fullName`, falling back to `title`), independent of report order. Require every expected identity to appear in the mutant report and to have failed with a nonempty assertion-message list. Missing identities must produce an explicit problem naming the mutation and missing title; extra unrelated identities must not substitute for them. Retain rejection of empty expected sets, unloaded suites, survivors, and ambiguous mutation search strings. Do not count duplicate report entries as additional required identities or let a duplicate passing entry conceal a failure of the acceptance condition.

In `we:scripts/conveyor/__tests__/session-reaper.test.mjs`, promote the valid assistant text-entry construction to one file-level factory shared by resolver, blocked-on-infra text, and real Guard 1(c) transcript cases. Accept a timestamp and text, require a string timestamp with a finite parsed date and string text, and construct the fixed assistant/message/content/text envelope internally. Reject invalid inputs rather than coercing them. Keep deliberately malformed records explicit in negative parser tests. This is a test-fixture contract, not stricter production parsing or a new cross-repository schema.

## MVP

1. Extend `we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs` with missing-identity regressions before changing the gate.
2. Implement baseline-derived expectations and actionable missing-identity diagnostics in `we:scripts/conveyor/guard-1c-mutation-check.mjs`.
3. Add and exercise the shared validating factory within `we:scripts/conveyor/__tests__/session-reaper.test.mjs`; replace valid hand-written assistant text fixtures in the relevant groups, preserving malformed-input cases.
4. Keep the isolated pass-level cases for both legacy and matching session IDs. Add direct timestamp assertions through the real summarizer/resolver so another backstop guard or mtime fallback cannot satisfy the fixture proof.

## Test plan

- `we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs`: missing unit identity under the comparison mutant; missing one of two pass-level identities under the wiring mutant; same-count replacement with a different title; reordered complete reports; missing non-required unit identities under wiring; empty required set; assertion-free failure; skipped/passing required identity; duplicate entries cannot mask a missing identity. Preserve existing success, suite-load failure, no-op mutant, and source-search tests.
- `we:scripts/conveyor/__tests__/session-reaper.test.mjs`: factory rejects missing/invalid/non-string timestamps and non-string text; valid output round-trips through the real summarizer with the expected kind, text, and timestamp. Resolve factory-produced lines with the real summarizer and a throwing `statFn` to prove mtime fallback was not consulted. Keep both isolated real-file cases and intentional malformed/fallback coverage.

## Proof plan

Run the targeted tests using Vitest with `run` and these two file arguments: `we:scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs` and `we:scripts/conveyor/__tests__/session-reaper.test.mjs` (strip the repository prefixes when passing filesystem arguments). Capture the new missing-identity regression failing against the old gate, then passing after the implementation. The preparation probe above already establishes the false-positive premise; it is not an implementation test result.

Run Node on `we:scripts/conveyor/guard-1c-mutation-check.mjs` using its WE-relative filesystem path. Require exit zero, a passing unmutated baseline, and explicit kills for comparison and wiring. Capture the real-parser/no-fallback assertions from the reaper suite alongside this gate output. Run `npm run check:standards` during delivery. No live sessions, completion records, or production transcript files need mutation; real-file tests use temporary directories and retain their cleanup.

## Follow-ups

No prerequisite policy decision or additional item is needed. Broader adoption of the fixture factory across other transcript consumers can be considered separately if a second-file consumer needs it; this item keeps the factory and its tests together in `we:scripts/conveyor/__tests__/session-reaper.test.mjs`. Production parser tolerance, reaper policy, and support for other transcript formats remain outside this prevention scope.
