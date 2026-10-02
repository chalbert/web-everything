---
bornAs: x9nxx8n
kind: story
size: 8
parent: "2676"
status: open
dateOpened: "2026-07-27"
preparedDate: "2026-10-01"
preparedAgainstSha: "43692f76491c8d2620cef8ca03ba73a5f820d235"
tags: []
crossRef: { url: /backlog/2709-feature-tracking-screen-case-taxonomy-to-webcases/, label: "Same job, already scoped & in-flight as #2709 (build-slices #2716 landed, #2717 open) — see Prep finding" }
scope:
  - "plateau-app:src/wip/progress-case-taxonomy.ts"
  - "plateau-app:src/wip/progress-case-taxonomy.test.ts"
  - "plateau-app:src/wip/progress-view.webcases.ts"
  - "plateau-app:src/wip/progress-view.webcases.test.ts"
  - "plateau-app:src/wip/progress-view.fixtures.ts"
  - "plateau-app:src/wip/wip-source.test.ts"
  - "plateau-app:src/wip/wip-mount.test.ts"
---

# Auto case-taxonomy → webcases, incl. error + latency families

Productize automatic case enumeration and a completeness critic, using the Plateau progress view as this slice's screen. Produce stable, screen-qualified case codes, parseable assertions, explicit rendered/spec flags, and a conformance-tested webcases registry. Preserve the original operator requirement: “use the web-case lens — plan for integration into webcases, same rigor identifying all variation and use cases, maybe even error and latency states.” This is the bounded progress-view application of the design-studio goal, not a replacement of that goal with a hand-written happy-path test list.

## Progress

Preparation refreshed 2026-10-01 against WE HEAD `43692f76491c8d2620cef8ca03ba73a5f820d235` and Plateau primary HEAD `1888d29aa5b82b48a09683d8017c9886eaef2f5e`. Plateau citations below use the WE-relative sibling locator `we:../plateau-app/`; frontmatter uses the canonical product scope identity required for dispatch. The lane-adjacent Plateau copy is older (`29db1bb1df050b7134c7aa03c241a737f83a454e`); do not take its timing constants as the primary baseline. These are source observations, not deployed-page measurements.

- **Old premise/scope:** the August note called this the same work as #2709/#2717, said the feature-tracker conformance test did not exist, and recommended not preparing it. **Correction:** that suite exists and checks the 115-case registry, stable codes, assertions and render flags (we:../plateau-app/src/feature-tracker/feature-tracking.webcases.test.ts:26-83). Its generated WEB CASE/assert parser is an existing pattern (we:../plateau-app/src/feature-tracker/feature-tracking.webcases.ts:236-269), not evidence that progress-view automation is delivered. The preserved crossRef is historical context; its “in-flight” label is not current delivery evidence. Other frontmatter is intentionally unchanged.
- **Corrected scope:** the operator requested a progress-view slice. Enumerate and critique that screen's case inventory, then automatically graduate it; do not rebuild the feature tracker or implement the progress UI. The parent still calls for a product loop (we:backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-comm.md:29-39). The current WIP source accepts schema 1 only (we:../plateau-app/src/wip/wip-source.ts:43-58), so schema-2 targets must remain explicitly spec-only until the consumer ships.
- **Contract is already present:** both major branches are declared (we:contracts/plateau-progress-view.schema.json:5-11); freshness distinguishes stale/unavailable/partial and unknown timestamps (same file:63-107); measures distinguish unknown from observed zero and prohibit summing units (same file:109-148). Existing validation checks examples, invalid versions, missing freshness, compatibility and human-action examples (we:contracts/plateau-progress-view.test.ts:10-82). These are contract checks, not proof of the current renderer.
- **Concrete runtime evidence:** parsing distinguishes never-published, failed HTTP, malformed payload and worker-clock age (we:../plateau-app/src/wip/wip-source.ts:43-58). Primary cadence/staleness are 120,000/600,000 ms (same file:26-27), with stale strictly above the threshold. Mounting starts loading, handles live/presence messages and polling fallback, and preserves the last snapshot on a failed poll (we:../plateau-app/src/wip/wip-view.ts:495-552). Existing source/mount tests supply reusable seams (we:../plateau-app/src/wip/wip-source.test.ts:6-37; we:../plateau-app/src/wip/wip-mount.test.ts:24-44).

## Design

All new product paths below are **proposed**, not claims of existing modules. Keep collection, classification, relay changes and UI delivery outside this taxonomy slice. In particular, the contract assigns those computations to the product (we:contracts/plateau-progress-view.schema.json:1500); schema acceptance alone cannot prove their semantics.

1. Add a declarative progress inventory in we:../plateau-app/src/wip/progress-view.fixtures.ts. Each requirement has a permanent requirement key, family, applicable schema, fixture or transition sequence, expected observation, source citation and explicit exclusions. Record the consumed WE contract revision. Reuse named WE examples as read-only inputs through a configured WE root; fail clearly when unavailable or incompatible. Do not duplicate the schema or rely on a developer-specific absolute location.
2. Add a pure enumerator and completeness critic in we:../plateau-app/src/wip/progress-case-taxonomy.ts. Given the declared requirements, enumerate their explicit valid variants and required interaction cases in stable order. The critic reports uncovered requirements, missing error/latency families, duplicate codes, impossible combinations, missing evidence and malformed assertions. Its coverage ledger must be checked against an independently authored requirement-key checklist, not a count computed from its own output. An unexplained exclusion fails graduation. “Complete” means complete against that reviewed screen/contract inventory, never proof of every possible runtime state or discovery of arbitrary screens from source code.
3. Automatically build the exports in we:../plateau-app/src/wip/progress-view.webcases.ts from that inventory, using the existing WEB CASE/two-plane assertion pattern (we:../plateau-app/src/feature-tracker/feature-tracking.webcases.ts:236-269). Proposed IDs use `PV-<family><number>` with explicitly assigned stable numbers, not positions renumbered on insertion. Each entry carries title, description, fixture/requirement references, a parseable state assertion plus fault/wait assertion where applicable, and `rendered: yes | spec`. Repeated generation must produce identical output. This generator/critic is the automation deliverable; no separate manual registry to keep in sync.
4. A current `yes` entry needs a renderer/source test mapping with a real assertion. Target schema-2 cases stay `spec`, with a reason and consumer owner #4620; do not cast them into schema-1 inputs, silently skip them or count them as passing UI coverage. Freeze the initial spec-only set after review; later promotions need observed consumer evidence. Newly discovered requirements need an explicit inventory review, not silent allow-list growth. Schema-1 regressions and schema-2 intended semantics are separate assertions when they differ: today's attention grouping includes pending review/red CI (we:../plateau-app/src/wip/wip-model.ts:11-21), while the contract excludes those alone from human actions (we:contracts/plateau-progress-view.schema.json:503).

Minimum family inventory to enumerate and review:

| Family | Cases and grounding |
| --- | --- |
| Screen/compatibility | Initial loading, never published, live, stale, empty observed data, schema 1 with missing progress sections, schema 2 target and unsupported major. Current parsing: we:../plateau-app/src/wip/wip-source.ts:43-58; compatibility contract: we:contracts/plateau-progress-view.schema.json:1144. |
| Error | HTTP/auth-shaped non-JSON failure, malformed envelope, missing freshness, one failed source, failure before first success versus after last good data, retry/recovery. Source/mount branches: we:../plateau-app/src/wip/wip-source.ts:46-54 and we:../plateau-app/src/wip/wip-view.ts:538-552; degraded-source effects: we:../plateau-app/src/wip/wip-model.ts:79-100. |
| Latency/loading | Unresolved initial fetch, delayed refresh retaining data, threshold minus/exact/plus one millisecond, old source with fresh publisher heartbeat, missing trend baseline/cold history. Current threshold: we:../plateau-app/src/wip/wip-source.ts:26-27,58; independent source ages: we:contracts/plateau-progress-view.schema.json:107; baseline rejection: we:contracts/plateau-progress-view.test.ts:47-50. |
| Progress semantics | Unknown versus zero versus partial tally, logical work versus jobs, incomplete row coverage, unknown run codes, system-owned hold versus human action, human pending versus actionable, conflicting policy text. Contract: we:contracts/plateau-progress-view.schema.json:148,183,327,503,858,1411-1447. |
| Concurrency/transport | Live snapshot/presence updates, socket loss to polling, abort/hidden-page handling; target older sequence within a publisher boot versus a new publisher identity. Current branches: we:../plateau-app/src/wip/wip-view.ts:509-550,580-595; target identity/ordering: we:contracts/plateau-progress-view.schema.json:1500. |
| Presentation | Full description wrapping at 320/390 px, keyboard/disclosure state, readable freshness/partial labels, status not conveyed by colour alone. Treat new layout expectations as spec-only until observed. Requested layout/accessibility: we:docs/agent/plateau-progress-view.md:69; current repaint/disclosure state: we:../plateau-app/src/wip/wip-view.ts:495-507,555-567. |

### Delivery boundary and #4289 split

The predicted implementation scope is **Plateau only**, including both new conformance tests and extensions to existing source/mount tests. WE's existing schema/examples/test are read dependencies, not product-runtime edit targets. This follows we:docs/agent/platform-decisions.md:143-165 (`#constellation-placement`) and we:docs/agent/platform-decisions.md:5518-5526 (`#conveyor-multi-repo-model`). This preparation changes only the WE card.

If enumeration reveals a missing normative contract vector, propose two deliveries before dispatch: **WE predecessor** touching we:contracts/plateau-progress-view.examples.json and we:contracts/plateau-progress-view.test.ts (schema file only for an explicitly reviewed contract change), with independently validated examples; **Plateau successor** retaining this card's product scope and depending on that predecessor. Consume its landed revision before building. This is the same contract-first seam as the #4289 ruling (we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:20,46-53); do not dispatch an unsupported mixed scope or create an empty WE story. No such new contract change is required by this plan. Schema-2 renderer promotions follow #4620; the registry can ship earlier with honest spec-only cases.

## MVP

- One progress-view requirement inventory, automatic enumeration, completeness diagnostics and deterministic WEB CASE registry generation. Error and latency cases are mandatory, including their interaction with absent versus retained data.
- Stable PV codes, parseable state/fault/wait assertions, contract revision and requirement provenance on every case. A reviewed coverage report lists included and excluded variants and every unrendered target.
- Executable conformance of every registry entry; source/mount evidence for current rendered entries; explicit spec allow-list for future consumer work. No hard-coded “115 cases” requirement borrowed from the feature tracker.
- No progress UI implementation, schema-2 publisher rollout, new agent/provider integration, generic screen-discovery engine, or design-studio intake/ratification UI. Those are separate product slices; this slice retains a pure callable enumeration seam for their later use.

## Test plan

- **Capability (Red today: new generator/critic absent):** In proposed we:../plateau-app/src/wip/progress-case-taxonomy.test.ts, exercise the enumerator/critic with missing error and latency requirements, an omitted inventory key, duplicate/reassigned IDs, incompatible schema/fixture combinations, invalid assertion syntax and unexplained exclusions. Verify deterministic output under reordered inputs and ID preservation when adding an unrelated case. Negative tests must fail for the specific missing requirement, not just a changed count.
- **Capability (Red today: new progress registry absent):** In proposed we:../plateau-app/src/wip/progress-view.webcases.test.ts, independently check all required families, unique PV codes, parser round trips, one-to-one requirement/fixture mappings, exact spec allow-list and executable evidence mappings for every `yes`. Validate positive snapshots against the pinned contract; invalid-payload cases explicitly expect rejection, never masquerade as positive examples. Verify named examples retain their unknown/partial/human-action expectations (we:contracts/plateau-progress-view.test.ts:53-82).
- **Preservation (GREEN today for the cited current branches; mutation proof required):** Extend we:../plateau-app/src/wip/wip-source.test.ts and we:../plateau-app/src/wip/wip-mount.test.ts with shared registry fixtures. Use injected promises and fake time for loading, retained-data error, retry recovery and exact stale boundary. Assert observable DOM/data behavior, not only fixture equality. Mutation proof: change the stale comparison from `>` to `>=`, then separately clear the retained snapshot on failure; each corresponding assertion must fail. Existing test seams are cited in Progress. Keep intended schema-2 assertions out of schema-1 execution until #4620 supplies the consumer.

Run the four scoped product suites, the existing WIP view/live/model regression suites, and Plateau's configured verification gate. Run WE's existing contract suite when validating the consumed examples. Rendering flags are evidence claims: registry parsing is not browser proof.

## Proof plan

1. Run the generator twice against a recorded contract SHA and fixed inventory; retain the identical output digest, family counts, uncovered-requirement report and spec-only list. Deliberately remove one error and one latency requirement mapping: the critic must name both omissions and reject graduation; restore and rerun green.
2. Exercise the mounted current WIP surface with controlled delayed success, never-published, failure after success, stale boundary and recovery. Retain case-code-labelled assertions and screenshots for the states labelled rendered. Use the existing source/mount seam (we:../plateau-app/src/wip/wip-view.ts:538-552), without changing production behavior to make the taxonomy pass.
3. At 320/390 px, inspect real browser output for every presentation case claimed `yes`, including keyboard disclosure/focus and full-text accessibility. Any unimplemented expectation remains `spec`; later #4620 consumer work must supply its own browser evidence before promotion. Do not claim a future schema-2 UI from WE example validation.
4. For this card-only preparation, run the requested prepare stamp, card check, standards gate and lane verifier, and inspect the diff to confirm only this card changed. Record actual results below; no implementation or deployment claim follows from preparation checks.

## Follow-ups

- Attach this pure enumeration/critic seam to the parent design-studio product loop later; automated arbitrary-screen discovery or AI committee orchestration needs its own scoped design. Parent scope: we:backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-comm.md:31-39.
- Promote schema-2 spec cases only as #4620 delivers its consumer; preserve the explicit distinction between registry conformance and renderer conformance. Current schema-1 guard evidence: we:../plateau-app/src/wip/wip-source.ts:43.
- Testing lesson: primary and lane-adjacent Plateau checkouts can differ. Pin the consumer SHA and inspect real constants before writing timing fixtures; do not copy comments or assumed thresholds. Keep this lesson here, not in shared agent documentation.
- The standards gate also asks for explicit `locus: plateau-app`; confirm that metadata alongside the stale crossRef label separately when bookkeeping edits are authorized; this preparation preserves non-scope/stamp frontmatter as required by we:skills-src/conveyor/prepare-item-worker-brief.md:9.

## Preparation verification

- `node we:scripts/backlog.mjs prepare-stamp 2693` succeeded on 2026-10-01; status remains open.
- `node we:scripts/check-backlog-item.mjs 2693` passed with no warnings after classifying the test cases and naming their mutation proofs.
- `npm run check:standards` passed with zero errors; the final lane run reported 5,003 repository warnings.
- `node we:scripts/verify-lane.mjs` passed: the card-only diff selected no related Vitest tests, then passed the standards gate. This is preparation validation, not execution of the proposed product suites.
- `git diff --check` passed; only this card is modified. No implementation, commit, push or PR was made.
