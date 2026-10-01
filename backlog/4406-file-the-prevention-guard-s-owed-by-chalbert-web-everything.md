---
bornAs: xpyelm4
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/ci-heal-owed.mjs", "we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-10-01"
dateResolved: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "07bb7c5142d6cbc26c11e22d05e1e29d9ce9c44e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2903's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/ci-heal-owed.mjs:111` — Have readOwedWrites re-derive slug from CONSTELLATION_REPOS[rec.repo].slug, and reject the record if it disagrees, instead of trusting the stored slug. Add a unit test for a tampered record.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2903@f03b153c5c56dc56248fc60ebe823e450e548820

## Done when

1. **Executable** — run the regression cases in `we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs` with Vitest. The new tampered-slug rejection and zero-GitHub-call assertions must fail against the current reader and pass with the guard.
2. A persisted record is eligible only when its repository key is an own key of `CONSTELLATION_REPOS` and its stored slug exactly equals that key's canonical slug. Valid records retain existing retry behavior.

## Progress

- Original premise/scope: the approval requested slug validation in `readOwedWrites`, citing `we:scripts/conveyor/ci-heal-owed.mjs:103`, with implementation and tests confined to `we:scripts/conveyor/ci-heal-owed.mjs` and `we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs`.
- Corrected premise/scope: the reader now starts at `we:scripts/conveyor/ci-heal-owed.mjs:111`; the guard is still absent. The two-file change scope remains accurate, including its matching existing test file. The canonical mapping in `we:scripts/lib/constellation-repos.mjs:32` is already imported by the implementation and needs no edit. Unknown/missing repository keys must also be rejected so canonical lookup cannot accidentally accept an absent slug or an inherited property.
- Source evidence: the reader currently checks kind, integer PR, head, body, and optional repo filter, then returns the parsed record. The flush consumes its slug for the PR read at `we:scripts/conveyor/ci-heal-owed.mjs:200` and comment post at `we:scripts/conveyor/ci-heal-owed.mjs:218`. Existing malformed-file coverage in `we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs` does not test repository/slug consistency.
- Preparation probe: created one temporary record with repo `we` and slug `outsider/wrong`, read it, then called the real `flushOwedWrites` with an injected exec recorder returning an open PR with no comments. The reader accepted the slug; the recorder observed both a PR view and comment targeting `outsider/wrong`, and the result contained one posted record. No GitHub process was invoked, and the temporary directory was removed. This confirms the gap remains undelivered.
- Delivered: `readOwedWrites` now skips any record whose repo key is not an own key of `CONSTELLATION_REPOS` or whose stored slug differs from the canonical slug, and returns the canonical slug. New table-driven and real-flush tests fail without the guard (13 failures) and pass with it; `we:ci-heal-pr-dispatch.test.mjs` still passes.

## Design

At the persistence read boundary in `we:scripts/conveyor/ci-heal-owed.mjs`, validate each parsed record against the existing `CONSTELLATION_REPOS` import before adding it to the returned array. Require a string repository key owned by the mapping (`Object.hasOwn`), derive its canonical slug from the mapping, and skip the record unless its stored slug strictly equals that canonical value. Return accepted records with the canonical slug explicitly assigned.

Preserve `readOwedWrites({ dir, repo })` and its array return shape, optional exact-key filter, sorted iteration, and malformed-record skip behavior. Rejection is a skip, without throwing, rewriting, deleting, or silently repairing the persisted record. This extends the existing malformed-input treatment. Canonical records require no migration. Keep the writer API, record version, flush result shape, retry bounds, and callers unchanged; every flush already passes through this reader.

## MVP

1. Add the repository ownership and canonical-slug checks inside `readOwedWrites` in `we:scripts/conveyor/ci-heal-owed.mjs`.
2. Add table-driven persistence tests and a real-flush test with injected exec in `we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs`. Use temporary directories and guaranteed cleanup, following the existing tests.
3. Deliver the guard and regression tests together as one bounded change. No registry, dispatcher, CLI, or external-service changes are required.

## Test plan

In `we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs`:

- Persist a valid record, then alter only its slug on disk. Cover both an outside slug and another constellation repository's slug. Assert rejection with and without the repo filter, while a valid neighboring record remains readable.
- Cover missing, empty, and non-string slugs; missing/unknown/non-string repository keys; and inherited-property names such as `toString` and `__proto__`. All must be skipped without throwing. Include the unknown-key plus missing-slug case to catch an accidental undefined-equals-undefined acceptance.
- Accept each canonical key/slug pair for both supported kinds, preserving the record fields and repository filtering behavior.
- Call the real `flushOwedWrites` on a fresh tampered-only directory with an exec spy: assert zero calls and empty posted/cleared/dropped/kept arrays. Assert the rejected file remains unchanged. Add a canonical control that reads and posts through the canonical slug and clears successfully, proving the flush has not simply been disabled.

Run this focused suite and the existing caller regression suite in `we:scripts/operations/__tests__/we:ci-heal-pr-dispatch.test.mjs`, which already covers flush-before-reconcile, dedupe, closed PRs, retry bounds, and repo isolation. The caller suite is validation-only, outside the edit scope.

## Proof plan

Before implementation, add the new regression tests and capture their failure against the unguarded reader: a mismatched slug is returned and the flush exec spy is called. After implementation, run both test files named in the Test plan with `npx vitest run` and capture the passing results. Temporarily remove only the new reader guard and verify the mismatch/zero-call regressions fail again, then restore it. Use only temporary persisted records and injected exec; this proof needs no live comment or shared owed-state mutation.

Run `npm run check:standards` for the delivered implementation. Review the final diff to confirm only the scoped source/test pair and the card changed. The preparation runner owns preparation checks, stamping, and the parked independent review; this preparation does not assert implementation completion.

## Follow-ups

None required for this guard. Broader persisted-record schema validation, writer-side hardening, or quarantine/cleanup of malformed files would be separate work; they are not necessary to reject repository/slug mismatches at the shared read boundary.
