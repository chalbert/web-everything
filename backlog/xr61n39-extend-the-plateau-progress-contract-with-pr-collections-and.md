---
kind: story
size: 3
parent: "4623"
status: resolved
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts"]
dateOpened: "2026-10-01"
dateResolved: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "fff15e8125add8c05a28a86a32f914cc0bb15ed5"
tags: []
---

# Extend the Plateau progress contract with PR collections and waiting chains

Validate author-independent PR collections, evidence-backed waiting chains and snapshot-bound cached pages as a WE-only contract increment. Preserve schema-1 and existing schema-2 examples so Plateau consumers can roll out after the contract.

## Progress

Preparation inspected WE HEAD `fff15e8125add8c05a28a86a32f914cc0bb15ed5` and the requested local plateau-app checkout at `ec375ab945e8794b10b0850c0f52bee3cac86507`. Read the worker brief from local main at we:skills-src/conveyor/prepare-item-worker-brief.md:1. These are source observations, not a deployed-product probe.

- **Old premise:** schema-2 exists, with arithmetic delegation described in the test. **Correction:** Ajv compilation and snapshot iteration are at we:contracts/plateau-progress-view.test.ts:7–12; the arithmetic/source-join/temporal responsibility statement is actually we:contracts/plateau-progress-view.schema.json:4. Existing collection metadata already permits nullable totals and requires included/completeness/source (we:contracts/plateau-progress-view.schema.json:150–183), but only runs/holds/actions have declared collection entries (we:contracts/plateau-progress-view.schema.json:1297–1315). Permissive additional properties are not validation of a PR extension.
- **Compatibility drift:** preserve the newer optional health section too (we:contracts/plateau-progress-view.schema.json:1481–1503; we:contracts/plateau-progress-view.test.ts:107). The unchanged examples include schema-1 fallback and pending-stop health evidence (we:contracts/plateau-progress-view.examples.json:1541,2857). The original test-plan phrase “Red today expected” was not an observed failure: baseline `npx vitest run we:contracts/plateau-progress-view.test.ts` (execute without the locus prefix) passed **591 tests** during preparation. New capability tests still need to be authored and demonstrated failing during implementation.
- **Plateau seam:** current cached PR reading returns only a measure and freshness, not PR rows (we:../plateau-app/src/wip/progress-read.ts:66–78). Current progress types declare runs/holds/actions coverage and no independent PR array (we:../plateau-app/src/wip/types.ts:264–275); the model emits those collections and a cached PR count (we:../plateau-app/src/wip/wip-model.ts:359–377). The relay already checks schema-2 identity and source joins (we:../plateau-app/wip-relay.js:760–782). Thus this is an additive contract, not initial schema creation or a completed consumer rollout.
- **Old scope → corrected scope:** retain all three WE paths, including the conformance test; no Plateau implementation path belongs in this story. The parent already filed separate collection, enrichment, transport and UI successors with their tests (we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md:112–122). This preparation changes only this card and does not alter its goal or a ratified decision.

### Implementation proof (2026-10-02)

- Source checkout: `e8ffa79c46f8e76fcbfb3e3aca60c3956a992098`. Before schema edits, the nine added capability regressions in we:contracts/plateau-progress-view.test.ts actually failed: six malformed/missing-coverage cases were accepted and three standalone page definitions were absent. The other **759 tests passed** (768 total), superseding preparation’s older 591-test baseline.
- Added strictly validated optional PR rows, paired paged coverage, waiting evidence and standalone request/response/restart definitions in we:contracts/plateau-progress-view.schema.json. Nullable facts require reasons; structured evidence is closed and shared files require safe repo-qualified relative references. The existing non-paging collection definition is unchanged. Shape validation and fixture-only arithmetic, source joins, temporal/head and paging checks remain explicitly separate from Plateau runtime computation.
- Named fixtures in we:contracts/plateau-progress-view.examples.json: `pr-complete-cross-repo`, `pr-empty`, `pr-partial-known`, `pr-unknown-total-pages`, and `pr-restart-{old-snapshot,publisher-restart,invalid-cursor}`. They cover cardless/null-author rows, equal numbers across repos, old-head CI, PR/build overlap, expired/stale holders, unknown wait starts/queue positions, measured/unknown ETA, three-page traversal and replacement snapshots. All **15 pre-existing examples** were compared structurally against the source SHA and are unchanged, including schema 1, optional health and the intervening provenance extension.
- After: focused `npx vitest run we:contracts/plateau-progress-view.test.ts` (locus removed for execution) passed **1,265 tests**. Deliberate mutations reject malformed nested fields, unexplained unknowns, hostile paths/transcript fields, false readiness/completeness, incorrect counts, duplicate identities, absent source joins, expired active claims, invalid ETA samples, changed rows, cursor cycles and incompatible restarts. The exhausted partial cache still has `total: null`, `cached: 3`, `complete: false`.
- Upstream re-probe: local Plateau HEAD `a497ad18d04c64d3622bc549824918da632218c5` still declares only runs/holds/actions collection coverage at we:../plateau-app/src/wip/types.ts:268; we:../plateau-app/src/wip/progress-read.ts:70–78 returns a measure/source, not PR rows. No consumer rollout is claimed.
- Independence: the conformance test imports only Vitest, Ajv and the two scoped JSON artifacts; the successful run needed no Plateau process, sibling import, credentials, server or GitHub calls. Free-text secret detection and runtime ETA/classification/transport are not claimed by these schema checks. No helper files or shared agent docs were created or changed.
- Verification: full `npm run check:standards` passed with **0 errors, 5,248 warnings**. Initial `node we:scripts/verify-lane.mjs` (locus removed) passed both the contract suite and the additional operation-run regression suite (**1,261 tests** before the final 19 boundary cases), plus its scoped standards gate (**0 errors**). Final rerun after the 19 boundary cases and this card’s proof entry: `node we:scripts/verify-lane.mjs` returned **green / exit 0**; full `npm run check:standards` again returned **0 errors, 5,248 warnings / exit 0**. `git diff --check` also passed.

## Design

Placement follows we:docs/agent/platform-decisions.md:143 (#constellation-placement) and we:docs/agent/platform-decisions.md:1165 (#surface-contract-not-computation): WE defines observable data and conformance; Plateau computes classifications, queue interpretation, ETA, caching and transport. Required waiting-chain content and existing classification policy are recorded at we:docs/agent/plateau-progress-view.md:83–92,138. This increment describes that surface without selecting a new scheduler or ETA algorithm.

Add optional schema-2 PR rows and matching coverage metadata. Absence means unavailable, never an empty collection; a supplied empty array means observed empty membership with its own coverage. Validate supplied fields rather than relying on the envelope's permissive extension handling. Retain all existing required sections and health fixtures. Keep schema 1 and old schema 2 valid.

Each row carries full repository slug plus positive PR number, URL, full description, nullable author, draft flag, head SHA, CI/review evidence with its observed head SHA, all wait reasons, primary wait, handler, wait-since and source references. Keep cardless PRs and equal numbers from different repos distinct. Unknown author/evidence/time must carry an explanatory reason; missing CI cannot certify green and old-head evidence cannot certify current readiness. Preserve raw evidence without turning primary wait into a merge authorization. Classification precedence remains the existing product policy cited above.

A waiting chain carries current owner/reason; nullable observed queue position; blockers identifying a PR or build/card, repo-qualified shared file and observation time; holder kind/identity/claimedAt/liveness; ordered conditional next steps; and nullable ETA with sample count, sample window, method and uncertainty. Explicit unknown values with reasons support staged enrichment. Observation time is not wait-start or claim-start time; expired leases cannot certify active workers. Contract examples express these distinctions; inference and calculations stay in Plateau.

Collection metadata distinguishes unknown universe total (`null`), known cached membership count, included row count, completeness and source freshness. Define page request/response/restart objects under schema definitions, compiled explicitly by the conformance harness; do not add page messages to the root snapshot union. A request binds collection, snapshot identity and opaque cursor; a response echoes that identity with rows, counts, coverage and next cursor. A restart result identifies why continuation is unavailable and the replacement snapshot when known. Include first/next/final-page, old snapshot, publisher restart and invalid-cursor vectors. Membership stays fixed for one snapshot; an exhausted partial cache never certifies a complete universe. Preserve the old non-paging collection semantics at we:contracts/plateau-progress-view.schema.json:183 by giving the new paged collection its own definition.

Keep every top-level example compatible with the existing `description`/`snapshot` harness (we:contracts/plateau-progress-view.test.ts:10–12). Attach page request/response exchanges to named snapshot examples and explicitly validate those exchanges against the new definitions. Schema checks cover shape, bounds, discriminants, timestamp syntax and safe reference forms; fixture conformance checks cover arithmetic, row identity uniqueness, source joins, head matching and cross-message snapshot/cursor consistency. Document this boundary in schema descriptions; a test helper is not a shipped product validator.

Structured evidence must use safe repo-qualified relative file references, never absolute host/home paths, traversal or transcript payload fields. Fixtures contain sanitized evidence and full synthetic descriptions. Schema rejection can constrain structured evidence; do not claim it can prove arbitrary free-text descriptions contain no secrets. Producer redaction remains a separately tested Plateau responsibility, consistent with we:docs/agent/plateau-progress-view.md:132.

## MVP

1. Extend we:contracts/plateau-progress-view.schema.json with optional PR collection, waiting-chain and standalone page definitions plus explicit compatibility and invariant descriptions.
2. Extend we:contracts/plateau-progress-view.examples.json with named complete/partial/unknown cases, cross-repo duplicate numbers, null author, cardless PR, head mismatch, PR/build overlap, expired holder, known/unknown ETA, and page/restart exchanges. Keep every existing example intact.
3. Extend we:contracts/plateau-progress-view.test.ts to validate all new definitions and fixtures, and exercise the cross-field invariants with deliberate invalid mutations. No runtime imports, IO collectors, transport handlers, browser surface or scheduling changes.

Budget: **3 implementation/test paths, 1 area** (we:contracts/), plus this card's eventual close-out. Frontmatter scope is the complete implementation touch set, including tests.

**Per-repo split:** the #4289 operator ruling chose a contract predecessor for an independently useful additive transition, not a permanent ban on coupled delivery (we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18–20). Retain this WE-only predecessor. Plateau successors already filed under #4623 are #x6jc6u7 (collection/classification), #xacsn2d (waiting evidence/ETA), #xrxb9uc (cached pages), and #xnwxew9 (phone UI and browser proof), with the dependency DAG and complete per-repo test scopes at we:backlog/4623-extend-plateau-fleet-to-every-author-and-repo-with-explicit.md:112–122. This card's deliverable is standalone validated contract data; each successor must pass Plateau's own gate. No mixed-repo build or extra card creation is needed here.

## Test plan

Run `npx vitest run we:contracts/plateau-progress-view.test.ts` from WE, removing the locus prefix for execution. Before changing schema, add failing capability cases and record their actual failures; the existing 591 passing tests are baseline evidence only.

- Accept all legacy/schema-2/health fixtures unchanged, and new absent/empty/partial/complete PR collections with independent freshness. Preserve null author and cardless rows; distinguish identical PR numbers in different repos.
- Reject malformed identities, negative/nonintegral counts and durations, invalid timestamps, unsupported major versions, malformed supplied collections/chains/pages, missing freshness, and unexplained unknowns. Test old-head evidence as retained history that cannot establish current readiness.
- Through fixture-level conformance checks, reject included/row-length mismatch, included above known total or cached membership, duplicate repo/PR identity, absent source joins, false completeness and incompatible snapshot/cursor exchanges. Assert unknown total remains distinct from cached count even on the final page.
- Cover multiple blockers, repo-qualified overlap files, stale/expired holders, unknown start times, conditional next-step order, and measured versus unknown ETA without implementing estimation or classification algorithms in WE.
- Reject hostile structured references (absolute paths, home paths and traversal) and transcript fields; accept sanitized repo-qualified evidence. Use synthetic free text and state the limits of schema-level redaction checks.
- Validate page definitions directly and every fixture exchange; request/response pairs must not accidentally pass only because the snapshot envelope tolerates unknown properties. Tests require no live Plateau process or external data.

## Proof plan

Implementation proof is the focused suite showing new capabilities fail before the schema increment and pass after it, with all legacy fixtures retained. Record exact source SHA, named fixtures and test totals. Demonstrate that schema/examples and the conformance suite validate independently of a Plateau checkout, server, credentials or GitHub calls; imports stay within the three scoped artifacts plus Ajv/Vitest.

Run `npm run check:standards` and `node we:scripts/verify-lane.mjs` (remove the locus prefix when executing) against the final card/contract diff and record results. This story does not claim live Fleet rendering, cached page serving, correct runtime ETA or consumer deployment: successor Plateau adapter/relay/browser tests provide that evidence at the split boundary above.

## Follow-ups

- Consumers should reuse these named fixtures and add malformed-wire, stale-head, source-join, no-extra-polling and snapshot-restart tests at their own seams; schema acceptance alone does not enforce runtime arithmetic or transport isolation (existing relay source checks: we:../plateau-app/wip-relay.js:777–782).
- Re-probe upstream types and the three WE artifacts before implementation; preserve optional health and any intervening compatible extensions. Keep testing lessons here rather than editing shared agent documentation.
- Richer author, durable queue observations and ETA samples may arrive through producer enrichment; keep unknown-with-reason valid until then. No new GitHub polling, dispatch, approval, merge behavior or fabricated evidence is authorized by this contract slice.
