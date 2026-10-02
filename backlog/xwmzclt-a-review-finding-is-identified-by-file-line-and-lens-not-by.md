---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "91d9b89ae899dd70bd0cc1f410917670f5e9ad98"
tags: []
---

# A review finding is identified by file, line and lens, not by its wording, so a rephrased claim reuses its ruling

A reworded mandatory referral at the same file, line and source lens must reuse its evidence-backed ruling for the same repository, PR and reviewed head. Conflicting rulings on that identity must produce one actionable human escalation, retaining the hold until explicit resolution.

## Progress

- **Original premise/scope:** the reported 2026-10-02 #3432 incident described five wordings of an “undeclared required” claim, attributed an earlier ruling-carry fix to #3507, and scoped the fix to the core and its unit tests. The incident's exact count and review history have not been independently replayed; they are historical input, not verified proof.
- **Corrected premise:** the defect is still present: `referralFindingKey` includes normalized summary text at we:scripts/lib/jury-core.mjs:2270-2273. A direct Node import probe during preparation returned `sameLocationRewordedKeysEqual: false` for two summaries at the same seat, file and line. In the current target, `required` is declared at we:scripts/operations/pr-status.mjs:172; line 179 is the empty-list branch, not an undeclared identifier. The #3507 attribution is stale: we:backlog/3507-liveheaddiff-collapses-a-computed-empty-diff-into-a-read-fai.md:11 concerns empty diff versus failed read, not ruling carry.
- **Corrected scope:** add the referral effect and its regression tests, plus direct acceptance-boundary tests. The effect computes covered keys and additions at we:scripts/operations/review-pr-io.mjs:530-544; changing only the hash would also invalidate existing version-1 records, whose keys are recomputed during validation at we:scripts/lib/jury-core.mjs:2285-2297. Existing replay coverage uses identical wording at we:scripts/operations/__tests__/review-pr-io.test.mjs:1061-1070. Conflict resolution already requires explicit supersession within a record at we:scripts/lib/jury-core.mjs:2323-2327; cross-run state currently accumulates results record by record at we:scripts/lib/jury-core.mjs:2386-2393.

## Design

1. **Identity and evidence.** For a located finding, derive identity from the source seat/lens, exact file and normalized positive line; exclude summary from identity and retain every reported wording as evidence. Keep repository, PR and head as outer grouping boundaries. Do not equate different source seats or infer a lens from prose. The current coordinates are normalized at we:scripts/lib/jury-core.mjs:371-380 and the current source seat is passed by the effect at we:scripts/operations/review-pr-io.mjs:535. For this MVP use the available file/line contract; do not invent a nearest symbol from summary text. Missing or invalid coordinates retain conservative, wording-specific identity and cannot acquire another finding's clearance. Automatic symbol resolution is a follow-up.
2. **Durable compatibility.** Introduce a versioned identity format for new records while retaining strict validation and reading of existing v1 records with their original keys. Project validated legacy referrals into the new identity for same-head grouping; never rewrite historical comments or silently discard their rulings. Keep raw evidence and each ruling's original record/reviewer provenance. Existing serialization and monotonic append-only validation live at we:scripts/lib/jury-core.mjs:2333-2374. Adapt these together, including mixed-version comment parsing and event validation, rather than replacing the v1 key calculation in place.
3. **Reuse across runs.** Compute coverage using the shared identity projection in we:scripts/operations/review-pr-io.mjs:530-544. A rewording must not create a new automated obligation after the same-head identity has been attempted or ruled. Preserve reworded evidence durably without modifying an earlier snapshot's immutable referral list. Keep the existing persist/read-back and attempt-before-dispatch ordering at we:scripts/operations/review-pr-io.mjs:516-550. A new head requires fresh review, as the current boundary states at we:scripts/lib/jury-core.mjs:2385.
4. **Conflicts have one owner.** Fold active rulings across records by subject/head/identity. Compatible repeated results may discharge one obligation; different active results (including different deferral cards) retain all evidence and yield one pending identity with a conflict explanation. Reuse the existing human parking effect at we:scripts/operations/review-pr-io.mjs:509-514,589-591; replay must neither dispatch another automatic judge nor repeat label writes once parked. Resolution must explicitly supersede every conflicting active ruling using record-qualified references, validated within the same subject/head/identity, and retain each original reviewer attribution. Do not choose the newest result or treat a generic human approval as a ruling. Preserve the current independence, card-readability and head checks at we:scripts/lib/jury-core.mjs:2321-2328.
5. **Acceptance remains guarded.** Return the same pending/blocked contract to existing consumers. A valid ruling releases only its referral obligation; a block stays blocking and other acceptance gates remain intact (we:scripts/lib/jury-core.mjs:2317-2330). Exercise the direct acceptance boundary already covered at we:scripts/__tests__/review-set-label.test.mjs:3443-3459.

## MVP

- Implement version-aware identity, legacy projection and grouped conflict resolution in we:scripts/lib/jury-core.mjs, then use that same logic for durable reuse in we:scripts/operations/review-pr-io.mjs.
- Extend the three scoped test files with rewording, mixed-version, conflict, restart and refusal cases. Keep existing historical fixtures literal where needed: generating all old keys with the new helper would hide compatibility breakage.
- Reproduce the #3432 failure shape in an offline replay fixture with five summaries, one location/lens and one head. Mark it synthetic unless actual historical records are retrieved and pinned. No live PR labels or comments are changed as part of preparation.
- Exclude provider/model changes, fuzzy semantic matching, automatic symbol extraction, cross-head clearance, and changes to which findings require mandatory referral.

## Test plan

- In we:scripts/lib/__tests__/jury-core.test.mjs, extend the referral suite at line 1571: five rewordings group once; different files, lines and seats stay separate; missing/zero/negative/fractional lines cannot inherit a located ruling; literal v1 and new records round-trip together; source evidence remains recoverable.
- Cover equal results across runs, block versus not-real, different card targets, explicit qualified supersession, duplicate IDs in different runs, forged reviewer identity, partial/corrupt records, wrong subject and changed head. Build on the existing conflict/corruption assertions at we:scripts/lib/__tests__/jury-core.test.mjs:1613-1628.
- In we:scripts/operations/__tests__/review-pr-io.test.mjs, extend the harness at line 1013 to replay rewordings through fresh sink instances. Assert one judge attempt per same-head identity, durable evidence read-back, no second label write after conflict parking, and successful explicit conflict resolution after restart. Preserve the failure matrix at lines 1044-1059 for unavailable persistence, changed head, timeout, omitted ruling and unreadable card.
- In we:scripts/__tests__/review-set-label.test.mjs, extend the boundary suite at line 3443: rewordings covered by a valid ruling no longer cause a referral refusal, while unresolved conflicts refuse accepted/restamp/clear-human before writes. Parameterize source, documentation, configuration and data findings; use fixture paths local to the tests and do not special-case extensions.

## Proof plan

1. Add the rewording regression first. Run `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs we:scripts/operations/__tests__/review-pr-io.test.mjs we:scripts/__tests__/review-set-label.test.mjs` (remove each documentation-only `we:` prefix when executing); capture red output showing a new obligation or repeated judge dispatch before implementation. The existing unchanged-summary replay at we:scripts/operations/__tests__/review-pr-io.test.mjs:1061 is insufficient evidence.
2. After implementation, run the same suites green. Capture the synthetic #3432 replay's keys, judge-call count, pending/blocked state, evidence history and label-write trace; then replay conflicting rulings, observe one human hold, explicitly resolve it, and observe the hold discharge. Repeat on a new head and observe renewed review.
3. Run `npm run check:standards` and `node we:scripts/verify-lane.mjs` from the checkout (remove the documentation-only `we:` prefix when executing). Preserve output and distinguish passing unit replay from any real #3432 replay. If historical records are available, replay them offline with original head, author and reviewer provenance; never describe a synthetic fixture as the live incident.

## Done when

1. **Executable:** the rewording/conflict regressions in the three scoped suites fail on the old behavior and pass after implementation; same-head replay reuses a ruling and dispatches no new judge for rewording alone.
2. **Must refuse on error:** malformed/unreadable history, ambiguous location, stale head, wrong subject, unauthorized or incomplete rulings, failed persistence/read-back, and unresolved conflicts never borrow clearance or bypass the existing hold. Ambiguous locations retain their own obligations rather than being dropped.
3. **Must cover every input kind:** documentation, configuration and data findings receive the same cautious location, provenance and conflict handling as source findings; no file-extension exemption is introduced.
4. One conflict identity is visibly human-owned until explicit supersession; evidence and v1 history survive restart. Unrelated findings and ordinary acceptance gates retain their prior behavior.

## Follow-ups

- Add nearest-symbol fallback only with a structured, validated coordinate contract; the current normalizer exposes file and line at we:scripts/lib/jury-core.mjs:371-380. Keep this separate from the located-finding MVP.
- If actual #3432 records cannot be retrieved, retain the synthetic replay and record the missing historical evidence rather than claiming a live replay passed.
- Testing lesson: compatibility regressions need literal historical records, while restart tests must vary wording; the current same-wording coverage at we:scripts/operations/__tests__/review-pr-io.test.mjs:1061-1070 misses this failure. Keep this lesson in the card, without changing shared agent documentation.
