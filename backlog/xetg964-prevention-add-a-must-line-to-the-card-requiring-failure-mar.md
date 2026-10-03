---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "10730be79e6a135d93ff84847a46f27fa23bc977"
tags: []
---

# Prevention — Add a Must line to the card requiring failure-marker diagnostics to be a structured allow-listed set (e… (from chalbert/web-everything#3440 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md (Done when)` — Add a Must line to the card requiring failure-marker diagnostics to be a structured allow-listed set (exit code, signal, quota-hold id, reset time) or redacted, with a named test. Longer term, add a lint or gate that any text written to a PR comment goes through a shared redaction helper.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3440@e1ba0281892ef443ab0f18d0379232760bbdaa88

## Progress

Preparation research, 2026-10-03:

- **Old premise/scope:** the approval asked for a Must line in we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md, citing line 23 and suggesting diagnostic fields including a quota-hold id. The scope named only that card. Line 23 now belongs to implementation progress, not acceptance criteria.
- **Corrected premise/scope:** the target card is resolved, but its Done when section still has no diagnostic-publication Must line or named redaction test. Retain the documentation-only scope and target that heading. Do not reopen the implemented heal story or add a new runtime feature. The requested documentation guard remains undelivered even though runtime protection has landed.
- **Source evidence:** commit `e23f1963f` added structured public failure evidence. In we:scripts/operations/probation-heal-run.mjs:70-75, publicFailureEvidence selects outcome, integer exit code, shaped signal, quota state and reset time; invalid or absent values become unknown. It does not publish a quota-hold id. In we:scripts/operations/probation-heal-run.mjs:118-125, publishHealAttempt passes that projection, not the raw detail, to the comment builder. These are fixed selected fields with shape validation, not a closed enumeration of every string value.
- **Matching tests already exist:** we:scripts/operations/__tests__/probation-heal-run.test.mjs:745-753 tests that unlisted secret shapes never reach the public comment while exit/signal/quota/reset survive. Its next case covers upstream truncation boundaries. In we:scripts/conveyor/ci-heal-mark.mjs:92-93, sanitizeForPublicComment redacts before truncating; we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:454-509 covers credentials, forged markers and bounded output. These source/test pairs are read-only grounding, not planned edits. No source entry is being added to scope, so no source/test scope expansion is required.

## Design

Add the following acceptance requirement under Done when in we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md:

> **Must — failure-marker diagnostics:** CI-heal failure comments publish only the selected, validated structured fields (outcome, exit code, signal, quota state and reset time); absent or invalid fields say unknown. Raw worker output, wrapper logs and arbitrary diagnostic detail must not enter the public comment. The comment formatter must redact before truncating and neutralize forged markers. Verify with “never publishes raw worker or log text: unlisted secret shapes cannot reach the public comment” in we:scripts/operations/__tests__/probation-heal-run.test.mjs and the “PR #3577 review: failure detail is neutralised before it reaches a public bot comment” suite in we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs.

This documents the current stronger structured-publication boundary rather than relaxing it to permit arbitrary text merely because a denylist redactor ran. The original quota-hold-id example is not a requirement to invent or expose another field. Preserve the target card's status, historical evidence and existing acceptance criteria.

## MVP

Insert that single Must bullet, including the named existing regression coverage, into the target card. No production code, test implementation, shared documentation or general PR-comment gate changes. Do not claim that the formatter's secret-pattern denylist proves arbitrary text safe.

## Done when

- The target card's Done when section contains the designed Must bullet and both exact test references; all existing criteria remain intact.
- **Executable:** the document assertion described in Test plan fails before the insertion and passes afterward. Existing runtime tests pass independently; their already-green baseline is not evidence that the documentation requirement existed.

## Test plan

For the implementation, run a read-only document assertion using `python3` from the WE root: read we:backlog/xp0lsdi-ci-heals-routed-to-antigravity-die-without-an-outcome-so-a-r.md, isolate Done when through the next level-two heading, and assert it contains `Must — failure-marker diagnostics`, the five selected fields, the raw-text prohibition, and both exact prefixed test paths from Design. Capture the missing-bullet assertion before editing and the successful assertion after editing. No new test file is needed for this one-bullet documentation change.

Run `npx vitest run` with we:scripts/operations/__tests__/probation-heal-run.test.mjs and we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs (remove the repository prefix when invoking). Confirm the named publication, truncation and formatter cases execute. Run `npm run check:standards` and `git diff --check` as the implementation checks. No real PR writes or worker launches are needed.

## Proof plan

Record the before/after document assertion and the focused test results. Review the final target-card diff to show only the Must bullet was added and no status or existing criterion changed. Use the injected publication harness in we:scripts/operations/__tests__/probation-heal-run.test.mjs to demonstrate the actual produced comment excludes hostile raw diagnostics while retaining the selected evidence. Keep documentation proof separate from the already-delivered runtime behavior. Preparation does not insert the bullet into the other card, run a live heal, or claim new runtime protection.

## Follow-ups

- The original longer-term proposal remains separate: inventory PR-comment publication boundaries and scope a lint/gate requiring a shared redaction helper. That broader guard is not delivered by this card; its consumers and exceptions require research before implementation.
- If the selected public fields change later, update the Must line and its named test together. A quota-hold id is not currently a public field and must not be added merely to match the old example.
