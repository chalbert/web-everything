---
kind: story
locus: webeverything
size: 2
parent: "4624"
status: resolved
blockedBy: ["x9jwbpi"]
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts"]
dateOpened: "2026-10-01"
dateResolved: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "19fed1922fd32ca0639b0950a14f493451049118"
tags: []
---

# Define executor provenance and hold evidence in the progress contract

Extend the WE progress contract with validated owner, supervisor, executor and requested-versus-reported model evidence, plus structured overlap and capacity hold observations. Preserve existing schema-2 and schema-1 snapshots so Plateau can adopt the populated contract before publishing new fields.

## Lineage and delivery boundary

This story carries its assigned part of the prepared Design, Test plan and Proof plan in we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md. Keep the all-configured-repos/all-authors goal, visible unmatched work, explicit unknowns, 120-second baseline and existing action/fork flows. No new dispatch policy, launcher registration, paid probe, or display-driven GitHub call. Parent grouping does not satisfy prerequisites: use the explicit blockedBy edges. Reconcile landed dependency revisions before building; the split itself claims no runtime proof.

## Progress

Premise checked 2026-10-02 against WE `19fed1922fd32ca0639b0950a14f493451049118` and the current Plateau checkout `ec375ab945e8794b10b0850c0f52bee3cac86507`, using the worker brief from local main. Preparation only; no implementation or product proof.

- Original premise/scope: three WE contract files need additive provenance and structured holds. Confirmed: run properties end without executor/model evidence at we:contracts/plateau-progress-view.schema.json:308; additional properties pass at :326; holds begin at :329. A direct Ajv probe of the moving-and-held fixture accepted executor=42, requestedModel=[] and capacity with negative usage/limit and a non-date timestamp (valid=true, errors=null). The gap is not already delivered.
- Corrected context: the contract now has 13 named examples and a strict calendar-valid timestamp definition at we:contracts/plateau-progress-view.schema.json:1505. Reuse that definition for new evidence rather than copying the older lexical timestamp pattern at :266. Existing strict evidence mutation tests at we:contracts/plateau-progress-view.test.ts:116 and :140 are the available pattern. Preserve the newer health examples as well as schema-1/2 compatibility.
- Plateau is a consumer already: we:../plateau-app/src/wip/progress-read.ts:52 projects runs but :56 fixes parent to null and derives repo from a PR or the WE work-item fallback (otherwise null); :58-59 emits basic role/state/time without executor evidence. Holds remain explicitly unavailable at we:../plateau-app/src/wip/wip-model.ts:358 and empty at :377. Its count/unknown-state regressions exist at we:../plateau-app/src/wip/progress-read.test.ts:24. These are downstream work, not reasons to add runtime to this scope.
- Corrected scope remains the same three explicit WE files, including the conformance test. The resolved predecessor is recorded at we:backlog/x9jwbpi-publish-the-plateau-progress-view-contract-schema-2-with-val.md:4; retain the existing dependency edge and reconcile landed revisions before implementation. No goal or ratified decision changes.

### Implementation proof (2026-10-02)

- Reconciled the resolved prerequisite and current contract: all 13 original schema-1/2 and health fixtures remain byte-for-byte equivalent as parsed JSON. Only the three scoped contract files plus this bookkeeping card changed.
- Red before: added mutations in we:contracts/plateau-progress-view.test.ts before changing the schema. Vitest reported 157 failed / 600 passed (757 total): invalid extensions were accepted, with no schema error path. The shell log-tail wrapper returned 0, so its status is not claimed as the Vitest exit status; the test summary is the red evidence.
- Green after: `npx vitest run we:contracts/plateau-progress-view.test.ts` (drop the prefix to execute) exited 0: 759/759 tests passed, including the two added fixture cases. Mutations assert both instance path and keyword. Observed rejection examples: `/runs/0/executor` → `type`; `/runs/0/reportedModel/observedAt` → `pattern` at `#/definitions/healthInstant/pattern`; `/runs/0/reportedModel/evidenceKind` → `const`. Capacity mutations assert `/holds/0/capacity/used` and `/holds/0/capacity/limit` with `minimum` or `type`; file mutations assert `/holds/0/overlap/files/0/path` with `pattern`.
- Independent Node/Ajv loading of we:contracts/plateau-progress-view.schema.json and we:contracts/plateau-progress-view.examples.json exited 0: all 15 named snapshots validated, and deep comparison against HEAD confirmed all 13 prior examples unchanged. No Plateau or UI loaded. New vectors cover all seven executor families, two repos/authors, parent-child linkage, cardless/unmatched work, explicit unknowns, requested/reported mismatch, and overlap/preparation/capacity holds.
- Regression proof covers missing/null extensions, complete closed evidence, bad types/unknown keys/missing members, calendar-invalid instants and valid leap days, negative/fractional/string/boolean counts, measured zero/unknown/over-limit capacity, safe repo-qualified files versus absolute/traversal/bare references, and unassigned preparation with unknown raw codes. Existing negative-count, unsupported-major, source-freshness and health regressions remain intact.
- Final gates: `npm run check:standards` exited 0 (0 errors, 5,228 warnings). `node we:scripts/verify-lane.mjs` exited 0: 2 suites / 774 tests passed, including the additionally selected we:scripts/operations/__tests__/deliver-item-run.test.mjs; its local standards pass had 0 errors / 771 warnings. `git diff --check` exited 0. No helper files, product/runtime changes or shared agent documentation edits.
- These are declarative hand-off and compatibility proofs only. Live discovery, source joins, liveness/deduplication, relay/browser acceptance, the 120-second soak and phone proof remain assigned to downstream cards; this slice makes no deployed-product claim.

## Design

Add optional, validated provenance fields to schema-2 runs and structured evidence to holds. Missing extension fields mean unknown; an included evidence object must be complete in shape, with nullable values for unattested facts. Preserve all existing required fields and the open outer run/hold objects for additive compatibility (we:contracts/plateau-progress-view.schema.json:310 and :329). Close the new nested evidence objects to catch misspellings. Do not infer executor or served model from owner, launcher, requested configuration or a supervisor.

Proposed field shapes for implementation:

- Run owner, author and origin: optional nullable non-empty strings, kept distinct. Supervisor and executor: optional nullable objects with identity and provider (nullable non-empty strings), plus source identity and observedAt. Source identity is a non-empty string; observedAt is a calendar-valid UTC instant or null. An unknown identity stays null even if its observation source is known.
- Separate requestedModel and reportedModel objects: nullable provider/model strings plus source, observedAt and an evidenceKind discriminator fixed to requested or reported respectively. A null object means no evidence. Requested settings never populate reported evidence; a reported model requires its own source. Allow mismatches and unknown provider codes without enforcing a provider/model catalogue. Existing runId, logicalWorkId, parentRunId and rawState retain their meaning (we:contracts/plateau-progress-view.schema.json:188, :192, :203 and :251).
- Hold source evidence: source identity plus observedAt, distinct from since/asOf. Optional overlap evidence contains counterpart work/run identity and an array of repo-qualified relative file references. Validate non-empty repo/path, reject absolute paths and traversal segments; do not include prompts, credentials or machine-local log paths. Unknown counterpart or file evidence is null, not a fabricated match.
- Optional capacity evidence contains nullable nonnegative integer used/limit, a non-empty unit, source and observedAt. Zero is measured zero; null is unknown. Permit used greater than limit as an observation, not a schema error or dispatch decision. Preparation holds reuse owner and raw/normalized reason with source evidence; unassigned owner remains null. Preserve the existing hold fields at we:contracts/plateau-progress-view.schema.json:332-375.

Reuse the calendar-valid instant definition at we:contracts/plateau-progress-view.schema.json:1505 for new observations. Document source-key joins, provenance truth, time ordering, freshness assessment, count arithmetic and identity deduplication as consumer responsibilities; a declarative shape cannot prove them. This follows we:docs/agent/platform-decisions.md:1165 (#surface-contract-not-computation) and :143 (#constellation-placement). Keep source-local freshness, unknown raw codes and separate count units.

## MVP

Deliver exactly the schema, named examples and declarative tests in scope. Extend descriptions in the JSON schema itself. Named examples cover build, prepare, standalone Codex, Gemini/agy, fix, ci-heal and review; cardless and unmatched work; two repos/authors; parent-child linkage; requested/reported mismatch; explicit unknown attribution; overlap, preparation and capacity holds. These are synthetic conformance vectors, not evidence of live producer coverage. The family and hold acceptance baseline is we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md:73-89.

Keep the existing corpus unchanged and validate all old snapshots, including optional health evidence. The shared example loop at we:contracts/plateau-progress-view.test.ts:11 is this contract's conformance demonstration. No package, product runtime, shared agent documentation or rendered page changes.

Per-repo delivery: retain the existing split in we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md:25-42. This card supplies an independently usable WE contract. Plateau #xukxoy9 then adopts types/relay/browser acceptance before #xk7jz9n run discovery and #xv8d25t hold collection; #xowscy1 integrates counts, rendering and publisher proof. This applies the operator's contract-first per-repo ruling at we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:20, without claiming mixed-repo atomic delivery. Do not add Plateau paths to this card's machine scope.

Scope budget: three implementation paths, one contract area; adding this card as bookkeeping yields four paths/two areas. Re-probe and re-slice if dependency drift expands that budget. The all-configured-repos/all-authors goal, visible unmatched work, 120-second baseline and existing action/fork flows stay assigned to the parent/consumer slices; no dispatch policy, launcher registration, paid probe or display-driven GitHub call enters this contract slice.

## Test plan

In we:contracts/plateau-progress-view.test.ts:7 use the existing Ajv validator and named fixture loop. Write negative mutations before schema changes and observe their failure against today's permissive extension behavior. Then add the schema and fixtures until they pass.

1. Every populated example validates; all old schema-1/2 and health examples still validate. Missing new fields and explicit nulls both validate. Parent/child and cardless runs preserve existing required identity fields.
2. Reject wrong primitive/object types, empty required strings, missing nested evidence members, unknown nested keys and a requested-only shape substituted for reported evidence. Assert the relevant instance path/keyword, not just rejection somewhere in the snapshot.
3. Reject negative/fractional/string/boolean capacity counts and malformed timestamps, including invalid calendar days. Accept null, zero, used above limit, and valid leap days. Reuse the mutation approach at we:contracts/plateau-progress-view.test.ts:116-150.
4. Reject bare/absolute/traversal file evidence and malformed counterpart/source shapes. Accept a safe repo-qualified relative reference and explicitly unknown overlap details. Preserve raw unknown reasons and an unassigned preparer.
5. Retain negative-count, unsupported-major and source-freshness regressions at we:contracts/plateau-progress-view.test.ts:15-45. Assert new evidence remains distinct when requested and reported provider/model disagree; do not claim the schema proves the actual executing model.

## Proof plan

During implementation, capture the red-before/green-after targeted mutations and exact failing schema paths. Run `npx vitest run we:contracts/plateau-progress-view.test.ts` (remove the WE prefix to execute from this checkout), `npm run check:standards`, and `node we:scripts/verify-lane.mjs`. Record exit codes, fixture/test totals and any limitation here. Independently load both JSON artifacts with Ajv and validate the full named corpus without loading Plateau or a UI. This proves only the hand-off shapes and compatibility.

The downstream split owns live discovery, liveness/dedup, source-time joins, relay/browser acceptance, 120-second observation and phone proof; its assigned test paths are in we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md:27-31. Do not mark this contract's passing fixtures as deployed product proof.

Preparation verification (2026-10-02): `node we:scripts/verify-lane.mjs` exited 0. For this card-only diff it selected related tests (none found, exit 0) and `npm run check:standards` (0 errors, 5,215 warnings). `git diff --check` passed. The Ajv premise probe above was observational; implementation test-first and runtime proof remain future work. Preparation stamp applied with `node we:scripts/backlog.mjs prepare-stamp x74eqth`.

## Follow-ups

- Reconcile prerequisite and consumer revisions before building; keep the independently useful contract deliverable separate from runtime rollout.
- Arbitrary custom-log registration/heartbeat remains a producer follow-up; default-root discovery must retain partial coverage (we:backlog/4624-show-actual-executors-and-standalone-jobs-in-plateau-running.md:73).
- Testing lesson: new evidence can reuse the strict timestamp and nested-object mutation coverage already present; legacy timestamp shapes need not be tightened as a side effect. Record further verification lessons here, never in shared agent documentation.
