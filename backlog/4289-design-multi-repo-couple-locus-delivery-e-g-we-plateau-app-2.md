---
bornAs: x83eb25
kind: decision
status: open
dateOpened: "2026-09-27"
preparedDate: "2026-09-30"
preparedAgainstSha: "1ef20904e5391d5a16ef4c07133b6502c08c44c5"
relatedTo: ["4620", "2662"]
relatedReport: reports/2026-09-30-builder-launch-misread-root-causes.md
tags: []
---

# Prepare multi-repo delivery: split #4620 at its contract seam, preserve coupled delivery

**Proposed disposition — awaiting operator confirmation, not ruled:** use option **(a) for #4620**, with a validated WE contract predecessor and a Plateau consumer successor. Preserve coupled delivery as a supported approach; do not turn the wrapper's missing capability into a permanent ban. Prepare/scaffold must diagnose an unsupported mixed scope and propose a valid decomposition before dispatch.

## Supported approaches and recommendation

**Standing test:** (a), (b), and (c) can coexist: separate stories can use the same per-repo lane/gate/PR primitives as a coupled coordinator. This is **supported approaches + a forced admission invariant**, not three mutually exclusive architectural forks or a speculative go/no-go gate. There are consequently no artificial `Fork N` headings. The operator can confirm this disposition and the concrete #4620 decomposition without re-ruling the existing couple drain. Classification method: we:docs/agent/backlog-workflow.md:580 and :584.

| Approach | Cost estimate (planning only) | Merit / risk | What it unblocks |
| --- | --- | --- | --- |
| **(a) Per-repo cards with `blockedBy`; recommended for #4620** | Low orchestration change: prepare/scaffold diagnosis, decomposition and early admission check; two delivery cycles. Estimates, not measured effort. | Each intermediate commit must be useful and valid alone. Bad splits create paper progress or hide an incompatible transition. Distinct contract acceptance and product acceptance make partial completion honest. | #4620 through two currently supported single-locus builds; other additive contract-first changes with a real independent deliverable. |
| (b) Coupled mechanical delivery | High orchestration work: multi-lane ownership, provider permissions, reports and gates per repo, paired PR production, failure/resume state and live graduation. | Preserves one logical outcome across inseparable edits. Ordered PR merges still have a partial-landing window; sandbox access alone does not solve completion ownership. | Genuine inseparable mixed-repo stories, including #2662 if its design cannot be usefully decomposed. |
| (c) Explicit existing couple producer outside this wrapper | Medium operator coordination; reuse manifest, PR and drain machinery, with explicit lane ownership and per-repo verification. Not a newly proven automatic build path. | Avoids inventing a second landing protocol. Manual coordination can omit a sibling gate or mismatch refs; must retain existing manifests and drain checks. | A deliberately supervised coupled change before (b) is exercised end-to-end. Does not make a mixed-scope card eligible for this wrapper. |

**Recommendation: (a) for the live slice; support (b) as a separately prioritized wrapper capability and retain (c) as the explicit existing transport route. Reject “split every mixed-repo card forever.”** This recommendation rests on the independently consumable contract and compatible schema transition, not merely lower cost. Cost is shown because the operator requested it; it is not an argument that coordinated delivery is architecturally wrong.

**Forced admission invariant, proposed:** a mechanical build must have an executable lane/gate/PR ownership plan covering its declared scope before dispatch. An unsupported mixed scope yields a typed capability refusal and a concrete next action, never a detached worker that cannot start. Do not weaken the wrapper refusal, relabel the card's `locus`, or omit real scope entries to make it pass. Evidence: we:scripts/operations/deliver-item-wrapper.mjs:371 and :737; observed refusal in we:reports/2026-09-30-builder-launch-misread-root-causes.md, “Failure 2.” The admission/terminal-settlement fixes already filed by that report remain distinct from this delivery-shape preparation.

Skeptic: **SURVIVES-WITH-AMENDMENT** — independent attack rejected a permanent split mandate and a false validation gate; required independently useful contract validation, distinguished contract precedence from WE-last bookkeeping, and rejected cross-repo atomicity claims. Those amendments are incorporated below.

Screen: **clear** — fresh-context review found neither an implementation/standard boundary confusion nor prioritization disguised as a design fork; independent contract utility and complete scope ownership remain merit differences even with zero implementation cost. No ratification implied.

## Concrete #4620 decomposition to approve

**Should the split happen now as part of this decision? Yes: approve and author it at this decision's ratification, before another build attempt; do not wait for coupled-wrapper implementation. This preparation does not mutate #4620 or create children.** IDs below are symbolic proposals, not allocated backlog IDs.

Source for the complete existing scope and acceptance: we:backlog/4620-bring-standing-rules-and-ordered-priorities-into-the-live-pl.md:8, :29, :58 and :65. If the source filename changes, resolve by #4620; the numbered card is the identity.

| Proposed card | Scope / edge | Independent acceptance and proof |
| --- | --- | --- |
| Contract predecessor, new story, proposed size 2, pinned | Exactly we:contracts/plateau-progress-view.schema.json and we:contracts/plateau-progress-view.examples.json, plus a proposed we:contracts/plateau-progress-view.test.ts declarative validation harness. At creation, `blockedBy: ["4289"]`; dispatch only after ratification lands. | Publish schema 2 with named positive examples (partial history, stale cache, missing trend baseline, conflicting plan, cold history, pending review/red CI without human action). Validate examples; reject negative counts, unknown major and absent source freshness. A consumer can validate a snapshot independently of the UI. This usable conformance artifact is the incremental value; two unvalidated JSON files are not sufficient. |
| Consumer successor, retain #4620, re-estimate at preparation (currently size 5) | All and only the existing non-WE entries of #4620's scope, unchanged; remove its two WE file entries. Add `blockedBy: ["<contract-card-id>"]`, replacing the symbolic ID when scaffolded. Keep `locus: plateau-app`. | Consume the landed schema/examples at a recorded revision; preserve schema 1 and project missing sections as unknown; deploy accepting relay/client before schema-2 publisher. Keep every existing overview, full-text wrapping, freshness, partial-history, no-extra-GitHub-call, relay and phone-path proof in #4620. |

This is a **cross-item dependency**, not reversal of an intra-couple merge order. Land the WE contract story completely first; the later product story may still need WE backlog bookkeeping through the existing wrapper. A scope naming one code repo does not imply only one checkout is touched by orchestration (we:scripts/operations/deliver-item-wrapper.mjs:408, :421 and :1224).

The preparation/scaffold follow-up should count normalized repo identities using the same resolver, show the offending scopes, and propose predecessor/successor scopes plus the dependency edge. It must apply the split-safety test (we:docs/agent/backlog-workflow.md:1118): independently valuable story or bounded task under a parent, no cycles, valid intermediate state. If that test fails, retain the mixed card with a named coupled-delivery next action; never manufacture empty stories to satisfy the wrapper. Existing mixed cards may remain representable in the backlog; it is **unsupported dispatch eligibility**, not the existence of multi-repo work, that is refused.

## Placement: does #4620's contract belong in WE?

**Yes for the proposed declarative schema and conformance examples, under the current statute; no for product collection, computation, relay, or UI.** This is a derived classification, not a new ownership fork. The literal rule assigns code that defines a contract/types/protocol/conformance vectors to WE; its narrow tooling exception permits checking WE's own declarative artifacts (we:docs/agent/platform-decisions.md:143, `#constellation-placement`, especially :146 and :160). A product consumer does not make a pure contract runtime implementation. Existing we:contracts/backlog.ts:3 is a concrete type-only contract consumed by the console and foreign adapters, not proof that arbitrary product logic belongs in WE.

Apply that test to the full proposal, not a narrowed version: we:docs/agent/plateau-progress-view.md:94 defines identity, sequence, source freshness/completeness, runs, holds, actions, deliveries and policy; #4620 selects a schema-2 subset at its line 29. The schema/examples can specify observable wire validity, unknown-versus-zero and compatibility. Collector scheduling, local-drain history reading, Toronto bucketing implementation, operator-plan parsing, action classification implementation and section rendering remain product behavior. The proposed WE test checks declarative examples, not a running Plateau implementation. Do not introduce callbacks, reducers or producer adapters in WE under the name “contract.”

The design explicitly calls this an **operational contract proposal, not a ratified browser standard** (we:docs/agent/plateau-progress-view.md:9). Keeping it in WE does not ratify its entire future envelope or mint a generic progress standard. The `#surface-contract-not-computation` anchor (we:docs/agent/platform-decisions.md:1165) supports keeping algorithms out of a contract; it does **not independently authorize** standardizing every product policy. Any new normative semantics beyond #4620's documented subset require their own design review.

## What coupled delivery (b) would require

These are a proposed implementation acceptance envelope, not implemented behavior or a competing standards API:

1. **Acquire and own one lane per edited repo.** Record repo, lane, base/head SHA and lease owner under one attempt; acquire in a stable repo order, release only owned leases on partial acquisition failure. The current wrapper has one optional implementation lane and one report/gate flow (we:scripts/operations/deliver-item-wrapper.mjs:399, :420, :463 and :510); merely deleting the refusal cannot generalize that state.
2. **Give the worker bounded access to both lanes.** Preserve primary-checkout denies and git-write separation; prove each provider can write its two acquired lanes but not either primary or an unrelated lane. The original card's assertion that Codex can only write one cwd is stale: `extraLanes` already grants the WE lane for a single product build (we:scripts/operations/deliver-item-wrapper.mjs:1224–1248). This is reusable infrastructure, not proof that multi-repo build reporting, verification or PR production works.
3. **One PR per changed repository, linked by the existing manifest.** Use the canonical manifest writer and PR-body carrier, not a purported single PR across repositories. The writer's current contract is we:scripts/lane-manifest-write.mjs:3–18 and :105; the old committed-root-manifest description is historical. Each repo runs its own verification and required CI against its candidate SHA; a green WE check cannot substitute for Plateau CI. Existing profile/gate policy at we:docs/agent/platform-decisions.md:5511 (`#conveyor-multi-repo-model`) explicitly governs fixes; applying that ownership principle to the new build coordinator is a proposal, not evidence it is already wired.
4. **Dependency-safe drain ordering.** Reuse existing impl-first/WE-last carrier order and strictest-member review holds (we:scripts/lib/review-escalation.mjs:1002; we:scripts/lane-drain.mjs:421). If a product truly requires a new WE contract already on main, extract the additive contract predecessor first. Do not silently invert couple ordering to satisfy that dependency. For two implementation repos, record their dependency order before the WE completion carrier. Cycles require a compatible staged transition, not an arbitrary ordering.
5. **Resume and rollback are explicit, not transactional promises.** Before any merge, a failed gate parks the whole couple. After one side lands, retain exact landed SHAs and the unresolved remainder; never mark the item complete or rebuild an already-landed side blindly. Existing drain behavior stops and reports earlier landed repos on failure (we:scripts/lane-drain.mjs:421–444); it does not undo them. Proposed recovery: repair forward when the intermediate version is safe; if it is unsafe, stop activation and prepare a compensating revert PR in the landed repo, with that repo's CI/review and the same drain authority. No force-reset or automatic claim of atomic rollback. For #4620 specifically, keep the publisher on schema 1 until accepting consumers are deployed.
6. **Graduate through a real two-repo exercise.** Demonstrate normal paired landing, second-lane exhaustion, one red CI, crash/resume and second-merge failure with safe compensation; prove no false item resolution or foreign-lease release. Existing unit primitives are not that end-to-end evidence. This follows we:docs/agent/prototype-based-dev.md and the observed preflight failure, without claiming such a trial ran in this preparation.

## Context, known occurrences and evidence

This reuses existing research rather than inventing a new standard/research topic: we:reports/2026-07-02-deferred-merge-queue-substrate.md:55 documents additive expand/consumer/contract staging, and :49 records the limits of the chosen transport. Those are historical survey findings, not freshly verified claims about external services. Current in-tree observations below ground this recommendation.

| Evidence | Observation and implication |
| --- | --- |
| we:scripts/operations/deliver-item-wrapper.mjs:373–380 and :737–743 | Any two distinct scope repos, including WE, yield `multiRepo`; refusal occurs before acquisition at :408. The wording “more than one non-we repo” and old provisional card pointer are misleading. |
| Read-only probe, 2026-09-30, importing that real resolver and parsing #4620's scope | Original: `multiRepo:true`, keys WE + plateau-app. Filtering WE entries: `multiRepo:false`, profile WE. Remaining entries: `multiRepo:false`, profile plateau-app. This proves locus admissibility only, not complete build readiness or successful delivery. |
| we:reports/2026-09-30-builder-launch-misread-root-causes.md, Failure 2 | Historical live #4620 wrapper refusal; separate terminal-settlement/ghost-run defects. This prep did not launch or retry a worker. |
| we:backlog/2662-webcases-viewer-durable-source-registry-add-a-source-carved-.md:10 | Earlier real mixed-scope case: WE backlog contract plus Plateau source registry. The occurrence demonstrates demand; it is not proof that #2662's coupled build shipped or that its independent blocker is cleared. |
| we:scripts/lane-manifest-write.mjs:9 and :15; we:scripts/readiness/couple-plan.mjs:66–98 | Existing manifest/paired-opening route for option (c), with pinned impl tip and safe fallback. Existing transport is broader than this mechanical builder's admission capability. |
| we:scripts/lane-drain.mjs:421–444 | Stop-on-failure and reporting of already-landed repos. Ordered completion is not cross-repo atomicity. |
| `git log --oneline --` for #4289: `1ebb14c50` | The card was JIT-numbered from `4289` to #4289; the wrapper still cites its provisional identity. |

Statute overlap: the proposed admission rule composes with we:docs/agent/platform-decisions.md:2869 (`#pr-flow-rollout-mechanism`, deferred-merge rider), retaining custom drain authority and coupled ordering, and with :5511 (`#conveyor-multi-repo-model`), treating refusal as missing capability rather than a forbidden repo. Neither citation proves this wrapper already builds a couple. No standing agent document is changed by this preparation.

Seven-question classification: (1) operational delivery policy, not a new plug/block/intent; (2) no vendor protocol mint; (3) no intent axis; (4) split and coupled approaches coexist, while declared-scope admission is an invariant; (5) provider permission/IO adaptation is implementation; (6) support both coherent delivery shapes without claiming an unimplemented capability; (7) the seam is per-repo contract/consumer delivery, not an intent composition. The placement test above is separately derived from the full documented wire contract.

## Follow-ups after operator confirmation

- Author the concrete #4620 predecessor/edge/scope split at ratification, with the independent conformance acceptance above. Keep #4620 pinned; repeat story preparation and stamp against the landed contract revision. Preserve full consumer scope and tests.
- Add prepare/scaffold mixed-scope diagnosis and scope-safe decomposition proposals. Predicted touch-set: we:scripts/backlog/scaffold.mjs, we:scripts/readiness/ and corresponding tests. Coordinate with the already-filed admission/settlement story in the incident report; do not duplicate its terminal-state work.
- Coupled-wrapper capability: predicted touch-set we:scripts/operations/deliver-item-wrapper.mjs, we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs, we:scripts/readiness/lane-manifest.mjs and we:scripts/readiness/couple-plan.mjs plus their tests, narrowed after design. Keep actual implementation under its owning operational tooling boundary; this card does not relocate legacy machinery or authorize runtime in a standards contract.
- Testing lesson: a pure locus probe proves routing only. Real lease ownership, paired CI, partial merge recovery and deployed relay/client/publisher compatibility need their own observed proofs. Record them on the implementing cards, not shared agent docs.
- Metadata integration: `relatedReport` is unprefixed because the report loader joins the value literally (we:src/_data/backlog.js:338) and the checker only resolves an unqualified path (we:scripts/check-standards.mjs:1339), which conflicts with the `we:` path rule; a normalization fix is filed separately.

## Done when (preparation only)

Options, costs, risks, unblocks, placement, concrete split, independent skeptic/screen and proposed implementation proof are recorded here; `status` stays open and `preparedDate` is stamped by the prepare command. Ratification, child creation, runtime work and landing remain outside this session. Required verification results are recorded below.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Verification (2026-09-30)

- Real resolver probe: the mixed #4620 scope is refused; each proposed repo partition resolves to its expected profile. No build was dispatched.
- `node we:scripts/check-backlog-item.mjs 4289`: clean after stamping. Locus-prefix lint and `git diff --check`: passed.
- `npm run check:health`: exited 0, with 2,010 repository-wide flags; no #4289 entry in the generated audit. This is not a claim that the repository health backlog is clean.
- Required `node we:scripts/verify-lane.mjs`: selected the changed card, then failed before tests with `EPERM` writing its verification marker under we:.git/. The session's Git metadata is read-only.
- `npm run check:standards`: failed before the checker ran with `EPERM` creating the host-shared admission lock outside the writable checkout. Full verification remains outstanding in a permitted environment. No marker, admission lock, test, or permission safeguard was bypassed or weakened.
- Preparation stamp: `2026-09-30`, written by `node we:scripts/backlog.mjs prepare-stamp 4289`; item remains open. The local preparation hold is released at this review-only handoff because this session is explicitly forbidden to commit, push or open a PR. No implementation, child card, #4620 edit or shared agent-doc edit was made.
