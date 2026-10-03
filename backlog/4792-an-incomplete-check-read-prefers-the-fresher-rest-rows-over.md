---
bornAs: xd5465r
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8ea8162831244061921931ff25ea3bfaafbd67c4"
tags: []
---

# An incomplete check read prefers the fresher REST rows over the stale snapshot

Follow-up from the #3432 advisory (operator approved #3432, 2026-10-02). In `we:scripts/conveyor/reconcile-pass.mjs:1040`, an incomplete exact-head REST read can still select an older red or pending snapshot instead of the validated REST rows. Preserve known snapshot evidence only on read errors; use REST rows on an incomplete but valid read. Missing required checks must remain unchecked, never become an inferred pass.

## Progress

- Original premise/scope: the refusal branch at the formerly cited `we:scripts/conveyor/reconcile-pass.mjs:1022` discarded fresher REST rows; a snapshot cancellation followed by REST success was expected to read green. Scope named `we:scripts/conveyor/reconcile-pass.mjs` and `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`.
- Corrected premise/scope: the selection is now at `we:scripts/conveyor/reconcile-pass.mjs:1039-1040`. `result.incomplete` is set only when required names are absent and no relevant red/pending REST evidence exists (`we:scripts/conveyor/reconcile-pass.mjs:1014-1023`). Thus the defective case should become unchecked, not green. Complete successful REST evidence already supersedes the snapshot. The existing source/test scope remains sufficient; no reducer, REST reader, or required-check policy change is needed.
- Source evidence: `we:scripts/operations/pr-status.mjs:171-213` reduces missing required checks to unchecked after red/pending precedence. Existing tests in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:1039-1066` currently require snapshot cancellation recovery for both transport failure and absent evidence; split those expectations. The latest-run collapse regression at `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:1068` already covers superseded cancellations in complete REST rows.
- Observed with a network-free injected `runReconcilePass` probe: required names smoke/test, snapshot smoke CANCELLED, REST smoke success with test absent produced red, ci-heal, and check-read-failed; reducing the REST rows alone produced unchecked. Adding successful test to REST produced green, promote-draft, and no refusal. The defect is still present; the complete-green variant is already supported.

## Design

In `we:scripts/conveyor/reconcile-pass.mjs`, separate refusal reporting from evidence selection. Keep reporting `check-read-failed` for both error and incomplete results. Select the known red/pending snapshot only when `result.error` exists; on errors without that evidence select an empty rollup. Otherwise select the normalized `result.rows`, including an empty array or a valid incomplete result. Do not merge snapshot-only rows into REST: those rows could reintroduce stale failure or falsely fill missing required checks.

Retain exact-head validation, row validation, latest-per-name collapse, read deduplication, and the existing reducer. Update the adjacent comment to describe error fallback separately from incomplete-read handling. Keep the PR in non-CI planning regardless of refusal.

## MVP

1. Adjust the final evidence-selection condition and comment in `we:scripts/conveyor/reconcile-pass.mjs:1032-1040` so only read errors permit snapshot fallback.
2. In `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, split the existing absent-evidence/transport-error regression and add stale cancellation and pending cases with validated but incomplete REST success. Assert the hydrated rollup at the injected enrichment boundary as well as the resulting plan.
3. Keep changes to the scoped source and matching test file. No new API, check-name policy, or recovery policy is required.

## Test plan

Extend `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` with item-labelled cases:

- Snapshot smoke CANCELLED; REST smoke success; another required name absent: REST rows reach enrichment, state is unchecked, refusal remains visible, and neither ci-heal nor promote-draft is dispatched. Repeat with snapshot smoke IN_PROGRESS and with an empty REST array.
- Snapshot cancellation; all required REST names successful: green and promote-draft, without refusal. Keep the existing unordered duplicate-run success regression.
- Valid REST cancellation or pending evidence with another required name missing: preserve REST evidence and existing red/pending behavior; do not revert to snapshot evidence.
- Read exceptions, malformed rows, invalid SHA, and unreadable completed conclusions: preserve error refusal and known red/pending fallback; an otherwise green truncated snapshot remains unchecked and cannot promote.
- Parameterize incomplete-read refusal across source, docs, configuration, and data file inputs. Retain same-head deduplication and demonstrate non-CI review-fix planning still proceeds with a refusal.

## Proof plan

1. Add the item-labelled regression cases first in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`; run them against the unchanged source and capture the stale cancellation yielding ci-heal and the stale pending rollup surviving. Those are the expected pre-fix failures.
2. Apply the bounded source change and rerun the same cases; capture unchecked, no CI dispatch, preserved REST rows, and the visible incomplete-read refusal. Capture the complete REST success control and the transport-error cancellation fallback separately.
3. Run Vitest on `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` and `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs`, then run `npm run check:standards`. Use repository-relative filesystem arguments when executing Vitest; the `we:` prefix here identifies the repository.
4. All proof uses injected readers and enrichers; no live GitHub mutation or actual heal dispatch is needed. Record actual results during implementation, not assumed passes during preparation.

## Done when

- **Executable:** the item-labelled regression subset in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` fails before the selection fix and passes afterward; the affected suites and standards gate pass.
- **Must on error:** retain visible refusal, preserve known red/pending snapshot fallback, and never promote from an unreadable or truncated green snapshot.
- **Must for every input kind:** source, docs, configuration, and data changes all retain missing-required-check caution; valid incomplete REST evidence never grants a green verdict or promotion.
- Incomplete successful REST evidence supersedes stale snapshot red/pending evidence without removing the PR from non-CI planning.

## Follow-ups

None required for this bounded fix. Pagination, freshness comparisons across snapshots, required-check policy changes, and renaming the existing refusal kind are outside scope; raise separate work only if implementation exposes an additional defect.
