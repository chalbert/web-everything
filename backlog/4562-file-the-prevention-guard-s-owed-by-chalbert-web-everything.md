---
bornAs: xcu7t44
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "49ea1957f855dc716d077ced8c682ba6efa36c79"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3027's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the three owed protections: detect worker changes hidden by Git index flags, exercise each isolation-guard disjunct independently, and prove rejection of a second registered daemon clone.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3027@10fedba67afc9550fb9a6592282603117284c0c2

## Progress

Preparation research found factual drift in the original citations, but the goal remains outstanding.

- **Old premise/scope:** the review cited we:scripts/operations/probation-build-run.mjs:484 for launcher-script protection and we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:113 and :117 for independent OR-condition coverage. It offered script snapshots or rejection of lowercase/`S` index flags, plus a review lens or table-driven test convention. Scope named the launcher and its two existing test files.
- **Corrected premise/scope:** retain those three scope entries. Use the already-offered index-flag rejection and a local table-driven isolation test convention; no new shared review policy or registry implementation is needed. In we:scripts/operations/probation-build-run.mjs, `runProbationBuild` checks hook/config tampering immediately after the worker (lines 414–425), but `realIo.diffNumstat` still trusts `git diff` (lines 808–822). There is no lowercase/`S` index-flag check. The lane-local resolve and gate subprocesses still execute we:scripts/operations/run.mjs and we:scripts/verify-lane.mjs (lines 834–852).
- **Isolation evidence:** `realIo.acquireLane` in we:scripts/operations/probation-build-run.mjs:724–729 rejects launch-root equality, descendants, or registry membership. The refusal test now lives at we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs:192–199. Its `RETURN_SOURCE` fixture returns the launch root, which is also registered; equality short-circuits registry lookup. Removing only the registry disjunct would therefore leave that test green. Registry discovery in we:scripts/lib/daemon-clone-registry.mjs reads the fixture-overridable `WE_DAEMON_OVERLAY_DIR` and accepts exact roots and descendants. That module is evidence, not an implementation edit target.
- **Test mapping:** we:scripts/operations/__tests__/probation-build-run.test.mjs covers launcher ordering with fake IO; we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs supplies real Git/subprocess fixtures. Both exist and remain explicitly in scope for we:scripts/operations/probation-build-run.mjs.

## Design

Implement the review's narrow index-flag alternative in we:scripts/operations/probation-build-run.mjs. Read tracked entries with `git ls-files -v -z`, parse NUL-delimited records, and reject any lowercase status tag (assume-unchanged) or uppercase `S` (skip-worktree). Lowercase `s` must also reject. Inspect all tracked entries so a hidden imported dependency cannot bypass a small script allowlist. Ordinary uppercase tags remain acceptable. A failed or malformed listing must refuse rather than masquerade as an empty clean result.

Check after the existing hook baseline reset and before claim/worker execution, then after each worker attempt, after hook restoration/checking and before diff collection, report routing, prepare stamping, or any lane-local mutation subprocess. Run this check even when the worker reports failure. Apply the same boundary after an optional checker before continuing its result handling. Keep existing hook/config checks and visible-diff scope/envelope checks intact.

On suspicious flags or an unreadable index, return an explicit refusal with the affected paths/reason. Do not run resolve, stamp, gate, commit, or PR operations. Do not rely on the existing reset-based discard to restore files hidden by these flags: skip discard and explicitly report that the lane needs quarantine/inspection, following the existing unsafe-cleanup refusal pattern. Do not silently clear flags and continue. This closes the specific hidden-diff bypass; it is not a claim of general isolation from arbitrary Git metadata manipulation.

In we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs, make acquisition refusal cases a table documenting which predicate alone rejects each path. Use an unregistered launch root for equality/descendant rows; register a separate sibling clone for registry-only rows. Include its descendant and a normal unregistered lane as controls. Keep registry state and all candidate paths under the temporary fixture root.

## MVP

1. Add the index inspection IO seam and refusal ordering in we:scripts/operations/probation-build-run.mjs, including worker failure, prepare retry, and checker boundaries. Update fake IO defaults in we:scripts/operations/__tests__/probation-build-run.test.mjs so clean existing scenarios remain clean.
2. Add real Git hidden-script cases in we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs: mark tracked we:scripts/operations/run.mjs skip-worktree or assume-unchanged and replace its bytes with a sentinel-writing implementation during the fake worker. Leave an ordinary in-scope documentation diff to exercise the otherwise-successful route.
3. Extend that same fixture with a second registered sibling clone and independent acquisition rows. Record the one-disjunct-per-row convention beside the table. No shared documentation edits are required to discharge the original review's table-driven alternative.

## Test plan

- In we:scripts/operations/__tests__/probation-build-run.test.mjs, cover clean uppercase entries, `S`, lowercase `h` and `s`, multiple records, paths containing spaces/newlines, malformed output, and command failure. Assert preflight refusal prevents claim/worker; post-worker refusal precedes diff/stamp/resolve/gate/commit/PR; failed workers and optional checkers cannot skip the check. Verify unsafe-index refusal does not call discard and identifies the retained lane. Exercise both build and prepare routing, including the second prepare attempt.
- In we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs, use real `git update-index` flags and confirm `git diff --numstat` omits the modified tracked script while direct byte inspection sees it. Assert launcher refusal, no script sentinel, unchanged HEAD, and no resolve/gate/PR effects. Restore/remove only temporary fixtures in test cleanup.
- Table-driven acquisition cases must assert the precise refusal and byte-identical candidate checkouts, including ignored files and Git metadata. The registered sibling must be neither equal to nor beneath the launch root. The normal lane must still reach the existing successful route.
- Run from the WE checkout: `npx vitest run we:scripts/operations/__tests__/probation-build-run.test.mjs we:scripts/operations/__tests__/probation-build-run-isolation.test.mjs` (remove the descriptive `we:` prefixes when invoking the shell), then `npm run check:standards`.

## Proof plan

Before implementation, add the focused regression fixtures and capture the hidden-script fixture failing against the current launcher because refusal is missing. The new disjunct matrix should pass against the current guard; its registry-only row becomes a regression detector through the mutation experiment below. After implementation, capture passing focused tests and the standards gate.

Perform a temporary mutation experiment in an isolated test checkout: remove only the registry-membership disjunct in `realIo.acquireLane` in we:scripts/operations/probation-build-run.mjs. Require the registered-sibling row to fail while equality/descendant rows still reject. Restore it, then remove the index check and require the hidden-script regression to fail. Keep mutation diffs out of the delivered change. Record commands, outcomes, and the sentinel/HEAD assertions as evidence; a green aggregate suite alone is insufficient.

## Done when

1. The focused command in Test plan passes with the implementation and the hidden-script regression fails without the index guard.
2. Each acquisition disjunct has an independent fixture, and removing registry rejection makes the second-clone case fail.
3. Suspicious index flags cannot reach launcher mutation subprocesses or reset-based cleanup; clean build/prepare paths still pass, and the refusal explains that the lane was retained for inspection.
4. `npm run check:standards` passes and the proof includes both mutation experiments.

## Follow-ups

No additional policy decision is required. A broader immutable-script snapshot or general Git-metadata sandbox remains outside this bounded guard; do not advertise this check as providing either. If implementation exposes another bypass, record its concrete evidence separately rather than silently widening this item's scope.
