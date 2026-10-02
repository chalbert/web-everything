---
bornAs: x1sc0zj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "fbce2821aa87df7b53c93531df5ae6ffb251c2b0"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2967's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the review's goal: prevent malformed scope-clearing edits and ancestry checks against a stale remote-tracking ref. The approval did not block on these guards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2967@bbef413af479a268701a157c5f3303903d80fa97

## Progress

Preparation research (2026-10-02; no stamp):

- **Old premise/scope:** the review cited scope clearing at line 118 and ancestry refresh at line 146 of we:scripts/operations/build-dispatch-hold-route-land.mjs, requested parsed round-trip fixtures, complete YAML-value replacement, and a lint/shared wrapper or stale-lane regression. The declared source and test files still exist.
- **Corrected premise/scope:** scope clearing now lives at we:scripts/operations/build-dispatch-hold-route-land.mjs:156–172; refresh and ancestry checking are at we:scripts/operations/build-dispatch-hold-route-land.mjs:283–285, and the unvalidated write is at we:scripts/operations/build-dispatch-hold-route-land.mjs:322. Existing inline/block/wrapped fixtures in we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs:52–100 assert text, not parsed YAML. Keep the existing two-file scope: implement the local guards and their deterministic regression coverage there; no repository-wide lint or shared git abstraction is required.
- **Observed YAML evidence:** importing the current transformer and `gray-matter` in a Node probe, a valid wrapped scope with a column-zero closing bracket parses before transformation; the transformed output fails with “end of the stream or a document separator is expected.” The indentation-only replacement leaves the closing bracket behind. This is not already delivered by bbef413af479a268701a157c5f3303903d80fa97.
- **Observed Git evidence:** in temporary local bare-remote/writer/lane repositories, advance remote main after cloning the lane, remove the lane's fetch mapping, then fetch origin main. FETCH_HEAD advances but origin/main remains at its old SHA. An explicit source/destination refspec refreshes origin/main. Narrow the original claim: a default fetch is not invariably broken; the failure depends on the fetch mapping.
- **Current behavior to preserve:** we:scripts/operations/build-dispatch-hold-route-land.mjs:169–172 removes the scope key for ordinary standalone worker declines and preserves it for builder-envelope declines. Ordinary hold routing writes an empty array. These later behaviors must not be replaced by an unconditional empty-array assertion.
- **Parser evidence:** we:scripts/backlog.mjs:229–235 uses `gray-matter` for structured frontmatter. The scalar reader in we:scripts/backlog/frontmatter.mjs:37 cannot validate arrays; that module also documents surgical edits instead of whole-document serialization. Reuse the parser dependency without expanding scope to edit those modules.

## Design

In we:scripts/operations/build-dispatch-hold-route-land.mjs, retain the pure transformer and dependency-injected landing shell. Parse input and transformed frontmatter with `gray-matter`; reject invalid input or output before the card write. Validate the route-specific postcondition: ordinary routing has an empty scope array, standalone decline has no scope key, and builder-envelope decline preserves the original scope. Compare other parsed fields to ensure the edit did not consume unrelated metadata. A missing ordinary scope key must be inserted as an empty array so the finding is truthful.

Replace the indentation-only scope match with a surgical complete-value splice inside frontmatter. Handle inline flow arrays, wrapped flow arrays including a column-zero closing bracket, and block sequences including YAML's unindented sequence form. Locate the end of a flow value without treating brackets in quoted entries or comments as delimiters; stop block values before the next top-level field. Preserve unrelated frontmatter text and the original body (apart from the existing newline normalization and appended finding). Reject an unsupported or ambiguous value rather than writing damaged YAML. Do not serialize the entire card merely to clear one field.

For the already-done route, explicitly fetch `+refs/heads/main:refs/remotes/origin/main` from origin before checking ancestry against origin/main. A failed fetch must prevent ancestry checking and resolution. Keep the existing delivery-subject, changed-file, identifier, lane-release, and PR behavior. The prevention mechanism is an actual local-Git regression around `landOne`, with publishing effects faked; this fulfills the review's stale-lane alternative without a generic lint policy.

## MVP

1. In we:scripts/operations/build-dispatch-hold-route-land.mjs, implement complete scope-value replacement and parser-backed pre-write postconditions for the three existing reason branches.
2. In the same source, make the ancestry target's fetch destination explicit and preserve fail-closed error handling.
3. Extend we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs with parsed fixture assertions, invalid-edit/no-effect cases, and temporary local-Git stale-ref coverage. No daemon changes, new production wrapper, or external service is needed.

## Test plan

All matching tests live in we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs, paired with the sole source entry in scope.

- Table-drive inline, wrapped (indented and column-zero closing brackets), indented/unindented block lists, empty and absent scope, CRLF, comments, and quoted entries containing bracket characters. Parse transformed cards with `gray-matter`; require the expected scope and deep equality of every unrelated frontmatter field. Assert original body content, including a body-only scope line, survives.
- Exercise ordinary routing, standalone decline, and builder-envelope decline separately. Malformed YAML and missing frontmatter must fail before card writes, add/commit/push, verification, or PR creation; `landOne` must return failed and release its acquired lane.
- Build temporary local Git repositories with a real new delivery commit referencing the fixture card and touching a non-backlog file. Leave the lane's origin/main stale and test both a normal fetch mapping and an absent mapping. Delegate fetch/ancestry/log/show to real Git through `runFn`; record/fake resolve and all publishing commands. Assert the remote-tracking SHA equals the new main SHA before ancestry and resolution, and the new delivery is accepted.
- Test fetch failure, an unknown SHA, and a real commit outside main: no resolve or publishing effects, with lane release. Keep existing delivery-citation and sanitization regressions green. Clean up all temporary repositories.

## Proof plan

Implementation proof command: run `npx vitest run` targeting we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs (strip the repository prefix when passing the local path). Record the result alongside `npm run check:standards`.

First add the regression assertions and demonstrate failures against the current source: the wrapped fixture must fail YAML parsing, and the absent-fetch-mapping fixture must fail to accept a new main delivery. After the fix, run the same cases green. Revert each fix independently in a temporary test copy to confirm its regression fails for the intended reason. Record SHAs for old lane main, new remote main, and refreshed origin/main in the Git proof; mocked argument matching alone is insufficient. Preparation already reproduced both underlying failures using real parser/Git probes; it has not implemented or validated the future fix. Do not exercise live lane acquisition, remote publishing, or PR creation for this proof.

## Done when

The targeted command passes with parser-backed assertions for all supported scope forms and reason branches, invalid cards cannot reach a write/publish, and a real stale local lane refreshes the exact ancestry target independently of its fetch mapping. Both regression cases fail against the pre-fix implementation. The standards gate passes, with only the scoped source and matching test changed during implementation.

## Follow-ups

A repository-wide fetch/ancestry lint or shared wrapper is outside this bounded prevention fix; pursue it only if another concrete caller demonstrates the same defect. Whole-document YAML normalization and dispatch policy changes are not prerequisites. No new follow-up card is required to complete the original guards.
