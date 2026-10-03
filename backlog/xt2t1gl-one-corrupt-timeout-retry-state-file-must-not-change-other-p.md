---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/timeout-retry-state.mjs", "we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "f0acdbc764e7c8e655f69d4c9723d30d1b386abb"
tags: []
---

# One corrupt timeout-retry state file must not change other PRs budgets

Follow-up from the #3559 advisory (2026-10-02). When the requested head has no canonical ledger, the fallback in `we:scripts/conveyor/timeout-retry-state.mjs:11` parses all JSON candidates and validates their envelope before filtering by repository, PR, and head. An unrelated malformed or unsupported-version ledger therefore makes this head's budget pending. Isolate fallback errors by identity while preserving refusal for corrupt state belonging to the requested head.

## Design

Keep the change in `we:scripts/conveyor/timeout-retry-state.mjs`, shared by budget reads and legacy migration. Preserve the existing canonical-first selection and strict equality of `(repo, pr, head)`; signatures do not divide the per-head budget.

- A canonical filename is identity evidence even when its contents cannot be parsed. Read and validate that file strictly; malformed JSON, unsupported version, absent evidence, mismatched identity, or non-array requests must throw and produce a pending budget with the existing unreadable-state reason. Never fall back to legacy files after a canonical failure.
- Without a canonical file, inspect fallback candidates independently. Parse each candidate and establish its evidence identity before validating its version and requests. Skip candidates with a different or absent identity, and candidates that cannot be read or parsed and therefore cannot be attributed to this head. Do not infer a legacy identity from fragments of malformed JSON. This implements the original matching-evidence boundary; an unattributable legacy file cannot hold every PR.
- Once a fallback candidate matches all three identity fields, envelope validation errors must propagate. Do not wrap matching validation in a catch that silently discards its spend. Aggregate all valid matching legacy requests, including pending requests, as today.
- Preserve directory-enumeration failures as unreadable budgets. Keep reads side-effect free: no deletion, rewriting, quarantine, migration format change, or retry-policy change.

The existing consumers require no source changes: enrichment in `we:scripts/conveyor/reconcile-pass.mjs:1372`, the hold in `we:scripts/operations/ci-heal-pr-dispatch.mjs:475`, and legacy initialization in `we:scripts/operations/ci-heal-pr-dispatch.mjs:566` all use this shared reader. Canonical identity validation closes the otherwise possible empty-budget result from a wrongly attributed canonical payload.

## MVP

1. Separate canonical validation from per-candidate fallback parsing in `we:scripts/conveyor/timeout-retry-state.mjs`, retaining the exported API and budget result shape.
2. Add the planned `we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs` with real temporary-directory fixtures for isolation, matching corruption, canonical precedence, and legacy aggregation.
3. Run that focused suite and the existing dispatch regression suite in `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs`. No consumer edits or new persistence infrastructure are required.

## Done when

- **Executable:** from the WE checkout, run `npx vitest run "$FOCUSED_TEST"`, with `FOCUSED_TEST` set to the repository-relative portion of `we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs`. The unrelated-corruption regression fails against the current reader and passes after the fix.
- **Must refuse on attributable error:** a corrupt canonical ledger or malformed envelope with matching legacy evidence yields `pending: true` and a `timeout-state-unreadable:` reason; valid matching pending requests remain pending, and confirmed requests are never dropped.
- **Must preserve non-source caution:** the boundary depends only on repository, PR, and head, never whether a PR changes source, docs, config, data, or a mixture. No change to eligibility, evidence completeness, retry limits, or ambiguous-outcome handling is permitted for any of those input kinds.
- Unrelated fallback corruption cannot change the requested head's confirmed count or pending flag, and reading the budget leaves all fixture bytes unchanged.

## Test plan

Use Vitest and actual files in a temporary directory, cleaned up in a finally block, in the planned `we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs`:

1. Missing/empty directory returns zero confirmed and no pending. Non-JSON files are ignored.
2. With no requested canonical file, add malformed JSON at another head's canonical name and at an arbitrary legacy name; the requested budget remains unchanged. Repeat with unsupported versions and malformed request envelopes carrying another repo, PR, or head, varying each identity field independently.
3. Combine those unrelated candidates with valid matching legacy ledgers: two confirmed requests still count as two; adding a matching pending request still holds. Different signatures with the same identity aggregate.
4. Matching legacy evidence with unsupported version or non-array requests throws from the state reader and holds through the budget reader, irrespective of candidate order. Missing evidence, null, arrays, and scalar JSON candidates cannot crash unrelated reads.
5. A valid canonical ledger takes precedence over legacy spend and unrelated corruption. A malformed, unsupported-version, missing-evidence, wrong-identity, or invalid-requests canonical ledger holds even beside valid legacy evidence.
6. A deterministic directory-read failure remains pending. Assert fixture bytes are unchanged after success and failure; avoid permission-bit fixtures whose result depends on the user running the test.

Retain the existing legacy-import and per-head spend coverage in `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs:562` and `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs:572`. Run that suite as consumer regression coverage, without adding it to the edit scope unless an actual consumer defect is discovered.

## Proof plan

Before implementation, add the focused regression and record its failure against the unchanged reader: baseline `{ confirmed: 0, pending: false }` becomes pending after adding another head's corrupt canonical file. After implementation, run the same test unchanged and record the passing result, alongside matching-corruption controls that still hold.

Run the focused suite plus the existing dispatch suite using their repository-relative paths (the `we:` prefixes identify the repository and are not CLI path syntax). Run `npm run check:standards` for the implementation changes. Proof uses isolated local files and existing simulated dispatch effects; it requires no live GitHub retry, production ledger mutation, or feature enablement. The runner owns preparation stamping and checks.

## Follow-ups

No prerequisite policy fork remains: the original card explicitly bounds corruption errors by matching identity. Repair or recovery of malformed, unattributable legacy files is outside this item, as are deeper request-schema validation and changes to retry eligibility or limits. Do not silently add a global corruption hold while implementing the isolated reader.

## Progress

- **Original premise/scope:** the card cited `we:scripts/conveyor/timeout-retry-state.mjs:13` and described one corrupt file turning every red PR budget pending; it listed `we:scripts/conveyor/__tests__/timeout-retry-state.test.mjs` without identifying that it does not yet exist.
- **Corrected premise/scope:** the affected heads are those without canonical state that enter the fallback scan. Canonical state already bypasses unrelated files. The source remains `we:scripts/conveyor/timeout-retry-state.mjs:11`; the scope retains its matching test path explicitly as a planned file. No moved source or consumer edit is needed.
- **Source evidence:** fallback parsing precedes identity filtering in `we:scripts/conveyor/timeout-retry-state.mjs:14`; the catch converts any error to pending in `we:scripts/conveyor/timeout-retry-state.mjs:27`. Legacy migration consumes the same reader in `we:scripts/operations/ci-heal-pr-dispatch.mjs:567`. Existing migration regression coverage is in `we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs:562`.
- **Observed preparation probe:** a Node import of the real reader against a disposable directory returned `{ "confirmed": 0, "pending": false }` initially, then `pending: true` with an unreadable-state parse reason after another PR's hashed canonical file containing malformed JSON was added. Adding the requested head's valid canonical file returned `{ "confirmed": 1, "pending": false }` despite the unrelated corrupt file. The directory was removed after the probe. This confirms the defect remains and narrows the original blanket claim; no implementation or test file was changed during preparation.
