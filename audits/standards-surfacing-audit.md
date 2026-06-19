# Standards surfacing audit — concept→built gap (2026-06-18)

**Question that triggered this:** webtraces and webevents are named `status: concept` projects with no
owning backlog item. Are there others? This audit checks **every** `concept`/`draft`/`poc` standard for
(a) real implementation state and (b) whether an open backlog item owns its design/implementation — so the
gap between *written spec* and *tracked work* is visible and surfaced.

Method: cross-referenced [src/_data/projects.json](../src/_data/projects.json) +
[src/_data/protocols.json](../src/_data/protocols.json) status against implementation ground-truth
(`plugs/<name>/`, `blocks/`, `webtheme/` — ts files + tests) and backlog coverage (item titles, bodies,
`relatedProject`/`graduatedTo`/`parent` fields), with a four-agent verification fan-out. Reports + research
were also swept (172 reports, 126 topics) — see §4.

## 1. Implemented but mislabeled `concept` → status corrected this pass

These have real, tested implementations; the `concept` tag was stale. **Flipped to `poc`** in this pass:

| Standard | Evidence |
|---|---|
| webcontexts | `plugs/webcontexts/` — 9 ts, 5 tests, 1836 loc |
| webstates | `plugs/webstates/` — 6 ts, 3 tests, 1058 loc |
| webguards | `plugs/webguards/` — 4 ts, 2 tests |
| webworkflows | `blocks/workflow-engine/` (6 ts) + `blocks/wizard/`; design #634, impl #650/#691/#692 |
| webtheme | `webtheme/` — 6 ts (tokens/compile/schemes); design #364/#403/#404/#405 |

*(The initial probe only looked at `plugs/`; webworkflows + webtheme live under `blocks/`/`webtheme/` and
were missed until the fan-out caught them — a reminder that impl isn't only in `plugs/`.)*

**+3 more flipped after the row-11 backlog-health pass (§14):** the `check:health` D3 gate flagged
**webdocs** (85 resolved/47 graduated), **webtraits** (19/16), **webcases** (5/5) as `concept`-despite-shipped
— all flipped `concept`→`poc`, clearing D3 to 0. **8 status flips total this audit.**

## 2. Partial impl (contract stub only) — status to reconcile

A contract stub exists under `blocks/`, but no full runtime/provider — so neither `concept` nor `poc` is
clearly right. **Left as-is, flagged for a review item** rather than flipped blindly:

| Standard | Evidence | Resolved design |
|---|---|---|
| weblifecycle | `blocks/lifecycle/contract.ts` (1 ts) | #353 graduated `project:weblifecycle` |
| webaudit | `blocks/audit/contract.ts` (1 ts) | #357 graduated `project:webaudit` |
| webdecisions | `blocks/renderers/decision-trace/` (render fn) | #355 graduated `project:webdecisions` |

→ **Review item:** reconcile these three standards' status (complete the impl, or correctly label
contract-only).

## 3. Spec written, ZERO impl — the real surfacing gap

Spec `.njk` page exists; no plug/block impl. Split by whether design is done and whether an item owns it:

### 3a. DESIGNED-NOT-BUILT — resolved design exists, no impl, **no open owner**
The design call was made and a spec written, but nothing drives implementation. These need implementation
work **surfaced**:

| Standard | Resolved design (no open owner) |
|---|---|
| webtraces | substrate role in #093/#111/#407/#408 — *the [#140](../backlog/140-dev-surface-product-feature-matrix.md) trace/replay keystone* |
| webpositioning | #014/#467/#508 (anchor-positioning / responsive placement) |
| webreliability | #011/#028/#101/#503 (offline-retry / resumable transfer) |
| webintl | #017 project promotion |
| webmanifests | #102 changelog-manifest protocol |
| webidentity | #012/#482/#483 (credential-management protocol + thin intent) |
| webreporting | #350/#431 (report-model protocol) |
| webnotifications | #456/#459/#460 (push-delivery + notification intents) |
| webrealtime | #458 (transport-negotiation protocol) |
| webprocess | #672/#690 (self-driven artefact contract) |
| webresources | #061/#455 (pagination / delivery-transport) |
| webpolicy | #406/#407/#408 (DMN meta-schema + proof + enforcement seam) |

→ **Triage item:** sort these 12 into implementation epics (most are real, fundable standards now).

### 3b. Resolved epic but standard NOT built — delivery doubt
The owning epic is marked `resolved` yet the standard has zero implementation — the children may not have
covered the spec:

| Standard | Epic | Note |
|---|---|---|
| webcharts | #570 (resolved epic) + slices #571–574 | spec written, **no `plugs/`/`blocks/` impl** — did the slices deliver? |

→ **Review item:** verify webcharts #570's children covered the spec; surface remaining build.

### 3c. GAP — no design item at all
Spec page exists but no design item and no impl:

| Standard | Note |
|---|---|
| webevents | scoped event discrimination — pairs with webtraces as the trace/replay substrate |
| webportals | a **1322-line spec page** already, but no design item and no impl |
| webanalytics (draft) | spec page only; passing mentions, no owning item |

→ **Review items:** webportals (review spec, surface design+build); webanalytics (surface design+build);
webevents folded into the trace/replay substrate item.

### 3d. Spec-only but already OWNED (open item drives it) — no action
webtraits #715 · webdocs (#184/#428) · webcompliance #966 · webplugs #170/#642 · webcases #798 ·
webblocks #237 · webadapters (#232/#236/#978) · webintents · webresources(partial) ·
**webediting #940 (open epic)** — *child coverage to verify, see §3e.*

### 3e. Open epic — verify child coverage vs the doc (per directive)
| Standard | Epic | Note |
|---|---|---|
| webediting | #940 (open epic) + #618 (resolved epic) + #628–633 | confirm the children cover the full spec surface |

→ **Review item:** verify webediting's epics' children cover the doc; surface any missing slice.

## 4. Reports + research sweep — clean

172 reports + 126 research topics swept (four-agent fan-out). **No un-surfaced buildable proposals found** —
the repo's `relatedReport:` discipline means essentially every report/research topic is already cited by an
owning backlog item. The handful not cited by a topic-id were pure analysis/landscape with no actionable
proposal. No items needed.

## 5. Surfaced work items

Umbrella epic + review/triage children created from this audit — see the epic for the live list. Granularity
follows "review items for genuine doubt, one umbrella + lazy children for the clear-but-unfunded."

## 6. Coverage tracker (living)

How much of the WE constellation has been reviewed, and to what depth. Updated at each phase seam.

Depth scale: **L0** not reviewed · **L1** automated/heuristic pass (status+impl probe, grep cross-ref) ·
**L2** agent-verified ownership/coverage (fan-out) · **L3** conformance/quality depth (impl actually
complete & correct).

| # | Layer | Count | Depth | Confidence | Target | Phase |
|---|---|---:|:--:|:--:|:--:|---|
| 1 | Projects — concept/draft | 33 | L2 ✅ | med-high | L3 | done 2026-06-18 |
| 2 | Projects — implemented (poc + flipped) | 12 | L3 ✅ | med | L3 | done 2026-06-18 (§10) |
| 3 | Protocols (all concept/draft) | 32 | L2 ✅ | med-high | L2 | done 2026-06-18 (§7) |
| 4 | Plugs (runtime impls) | 51 | L2 ✅ | high | L2 | done 2026-06-18 (§11) |
| 5 | Blocks | 79 | L2 ✅ | med-high | L2 | done 2026-06-18 (§9) |
| 6 | Intents | 56 | L2 ✅ | med-high | L2 | done 2026-06-18 (§9) |
| 7 | Capabilities | 21 | L2 ✅ | high | L2 | done 2026-06-18 (§9) |
| 8 | Terms (glossary) | 194 | L1 ✅ | high | L1 | done 2026-06-19 (§14) |
| 9 | Reports | 173 | L2 deep ✅ | high | L2 | done 2026-06-18 (§13) |
| 10 | Research topics | 127 | L2 deep ✅ | high | L2 | done 2026-06-18 (§13) |
| 11 | Backlog items (full audit) | 1032 | L1 ✅ | high | L1 | done 2026-06-19 (§14) |
| 12 | "Already-owned" standards coverage | 10 | L2 ✅ | med-high | L2 | done 2026-06-18 (§8) |

## 7. Protocols layer (L2 — 2026-06-18)

All 32 `concept`/`draft` protocols verified by five-agent fan-out (parent project · impl state · backlog
ownership). **Key result: protocols mirror their parent projects and surfaced no new un-tracked work** —
every gap maps onto an existing #991 child or an already-owned item. No new items filed; two
reconciliations fed back into #998. Like the projects, **almost none have an open owner — design is
resolved, impl/ownership is the gap.**

Verdict split: **13 BUILT · 6 contract-stub/partial · 11 designed-not-built · 2 GAP.**

- **BUILT (13):** validation, change-tracking, storage (webstates) · guard (webguards) · workflow
  (webworkflows) · design-tokens (webtheme) · auto-define-strategy, render-strategy (webcomponents) ·
  provider-consumer-graph (webregistries) · mock-contract (webcases) · report-model (webreporting) ·
  custom-elements-manifest (webdocs, `we:scripts/gen-cem.mjs`) · **anchor-positioning (webpositioning — built
  in *frontierui* `fui:blocks/droplist/positioning/`)**.
- **Contract-stub / partial (6):** editor-engine (webediting → #996) · lifecycle, audit-trail,
  decision-record (weblifecycle/webaudit/webdecisions → #997) · policy-rule (webpolicy → #998) ·
  maas-versioning (webadapters, already-owned).
- **Designed-not-built (11):** typed-event (webevents → #992) · trace-observability (webtraces → #992) ·
  localization (webintl) · changelog-manifest, app-shell-compatibility, update-policy (webmanifests) ·
  credential-management (webidentity) · push-delivery (webnotifications) · transport-negotiation
  (webrealtime) · custom-chart-renderer (webcharts → #995) · self-driven-project-artefact-contract
  (webprocess) — all under the #998 triage.
- **GAP (2):** error-recovery (webreliability — no design, no impl; under #998) · analytics-vocabulary
  (webanalytics → #994, already filed).

**Reconciliations fed to #998** (these two are *partial*, not zero-impl as the project pass assumed):
- **webpositioning** — the anchor-positioning protocol is **built in frontierui**, so the standard has a
  cross-repo impl; remaining WE work is narrower than "build from scratch."
- **webreporting** — the report-model protocol has a real impl (3 ts); webreporting is **partially built**,
  not designed-not-built.

## 8. "Already-owned" standards — coverage verified (L2 — 2026-06-18)

§3d (phase 1) listed 10 standards as "already owned, no action" on **face value**. L2 verification (3-agent
fan-out reading each project spec page vs its owning items + impl) shows that assumption was **wrong for 6
of 8** checked (webediting/webresources already have their own items #996/#998). Only 2 are cleanly covered.
The recurring pattern: **impl exists, but the owning item is parked (a hosted-product question) or
off-topic, so the WE-layer spec-completeness work is untracked.** A parked *product* ≠ tracked *spec work*.

| Standard | Verdict | Finding | Action |
|---|---|---|---|
| webtraits | COVERED ✅ | 147 ts; spec complete; #715 active on cross-toolchain reach | none |
| webintents | COVERED ✅ | catalog live; 30 resolved items span the spec | none |
| webdocs | PARTIAL | product built (#424/#425/#427); Doc/Manifest/Cases **spec completeness un-owned**; #184/#428 parked | **#1005** |
| webcompliance | STALE | 10-ts PoC (gate/waiver/audit) **unowned & unlinked to spec**; only owner #966 parked | **#1006** |
| webblocks | STALE | 79 blocks/234 ts built; **no item owns the block protocol surface**; #237 blocked & off-topic | **#1007** |
| webadapters | PARTIAL | JSX/MaaS covered by 43 resolved; **Library Adapters (Floating UI, Mousetrap) un-owned** | noted ↓ |
| webcases | STALE | impl exists (4 ts); #798 parked decision; no active spec governance | noted ↓ |
| webplugs | PARTIAL | plugged/unplugged consumption-modes ownership thin; the "uncovered" plugs are actually built | noted ↓ |

**Lower-priority notes (not yet filed — surface on request):**
- **webadapters** — a Floating UI adapter (for webpositioning) and a Mousetrap adapter (keyboard shortcuts)
  are declared in the spec but have no owning build item.
- **webcases** — Mock Contract spec governance is parked (#798); impl mostly present, so low urgency.
- **webplugs** — the consumption-mode (plugged/unplugged) surface lacks an explicit owner; covered de-facto
  by the built plugs.

**Caveat:** several "STALE" verdicts are STALE *by design* — the hosted product is deliberately parked
(monetization soft-defer). The filed items (#1005–1007) target the **WE-layer spec/impl** work, which is a
separate, untracked concern; each asks to *assess* completion vs. formal-park, not to reverse a park.

## 9. Impl surface — blocks / intents / capabilities (L2 — 2026-06-18)

The implementation registries (rows 5–7). For these, draft/concept status is **not** debt by itself
(intents are an open system; blocks have an active demo/gap-sweep pipeline) — so the L2 question is "are the
incomplete ones **tracked by an owner**, or orphaned?" Four-agent fan-out over the 46 draft/concept blocks,
55 non-active intents, and 21 capabilities. **Result: near-total coverage — only 3 orphan blocks.**

| Layer | Count | Incomplete | Orphans (un-tracked) |
|---|---:|---:|---|
| Blocks | 79 | 46 draft/concept | **3** — keyboard-shortcuts, trusted-html-behavior, breakpoint-observer (→ #1015) |
| Intents | 56 | 55 non-active | **0** — 100% realized-by-a-block or owned (catalog is an open system by design) |
| Capabilities | 21 | — | **0** — all 21 backed by a resolver impl in the matrix (face + base-select cover all) |

- **Blocks:** 43/46 tracked (gap-sweep epic #315 children, per-block backlog items, or demos). The 3
  orphans have zero backlog refs, no demo, no graduation driver → **#1015** (give an owner+demo, fold into
  the sibling block, or retire the stub).
- **Intents & capabilities:** no action — the declared surface is fully realized or owned.

## 10. Conformance depth — implemented standards (L3 — 2026-06-18)

The deepest pass: not "does an impl exist" (rows 1–9 established yes) but **"is the impl complete & correct
vs its declared spec?"** Four-agent fan-out over the 12 implemented standards (7 poc + 5 flipped),
reading impl + tests + the project spec page for each.

**Two systemic findings:**
1. **0 of 12 have a conformance-vector suite** — only unit tests of the impl exist; nothing proves an impl
   meets the spec. This is the substrate #899's behavioral-conformance tool needs. → **#1016**.
2. **11 of 12 have spec-vs-impl gaps** — the common shape is "the DI registry + abstract-interface plane is
   built, but the full protocol / observable / SSR / member surface is missing." → triaged in **#1017**.

**Reframe:** `status: poc` is honest — these are *proof-of-concept* impls, not complete standards. The audit's
earlier "implemented" (rows 1–2) means *the skeleton exists*, NOT *the spec is fully realized*. **Caveat:**
L3 is the most subjective pass — some flagged "gaps" are **intentional layering** (members live in adapters
/ intents / other repos by design), not defects. #1017 sorts genuine-untracked from intentional.

| Standard | Tests | Verdict | Gap nature |
|---|---|---|---|
| webinjectors | 18 (3:1) | CONFORMANT | minor — `node.createElement()` spec'd, absent; cross-repo deferred |
| webregistries | 3 (~1.2:1) | GAPS | **genuine** — global patching API is TODO stubs; only 1 of ~10 registry types; downgrade/whenDefined incomplete |
| webcomponents | 3 (~1.5:1) | GAPS | **intentional** — Transient + Declarative Definition live in adapters (#854/#792) |
| webbehaviors | 4 (60%) | GAPS | **genuine** — missing `whenDefined`, ownerElement-vs-target naming, hyphen validation |
| webexpressions | 5 (83%) | GAPS | **genuine** — excludedElements, cloak removal, partial upgrade-trigger interception |
| webdirectives | 2 | THIN | **decide** — ~70% unimplemented (CustomComment subsystem, multi-template) — deferred vs build |
| webvalidation | 6 | GAPS | **genuine** — registry plane only; no L1 observable attrs/events, commitment policy, error-summary |
| webcontexts | 5 | GAPS | **genuine** — no claim/query protocol, strict-vs-flexible modes, SSR |
| webstates | 3 | GAPS | **genuine (biggest)** — change-tracking + storage protocols entirely absent (both concept) |
| webguards | 2 (~4:1 impl) | GAPS | **intentional** — protocol seam complete; entry/exit members are #178/#273/#338 |
| webworkflows | 1 (~1.3:1 impl) | GAPS | **intentional** — Flow Progress intent #657; async guard-delegation deferred |
| webtheme | 2 (~1:1) | GAPS | **genuine** — scheme runtime unproven, high-contrast missing, accent CSS not regression-tested |

**Reconciliation note:** #503 was recorded as resolving the webstates storage protocol, but the L3 pass found
**no storage-protocol impl** in `we:plugs/webstates/` (only the abstract CustomStore). Flagged in #1017 — either
the impl lives elsewhere or #503 didn't deliver. Genuine-completion candidates (for #1017 to file): webregistries,
webstates, webvalidation, webcontexts, webbehaviors, webexpressions, webtheme.

## 11. Plugs layer (L2 — 2026-06-18)

The plug runtime impls (row 4). `we:plugs/` has **10 standard plug dirs + `core`** (the gate's "51 plugs" /
67 ts count is individual modules within these). **No orphans, no new findings:**
- The 10 standard plugs (webregistries, webinjectors, webcomponents, webbehaviors, webexpressions,
  webdirectives, webvalidation, webcontexts, webstates, webguards) **are exactly the implemented standards
  already reviewed at L3 (§10)** — their completion gaps are captured in #1016/#1017.
- `we:plugs/core` is the **foundational base** (`CustomRegistry`, `Plug`, `Registry`, `HTMLRegistry`,
  `CloneHandlerRegistry`) consumed by all standard plugs and referenced by 19 backlog items — owned infra,
  not a standalone standard.

The plugs layer adds nothing beyond §10; it's the same surface viewed by directory instead of by project.

## 13. Deep reports + research pass (L2 — 2026-06-18)

§4 swept reports/research at **L1** (is the doc *cited* by a backlog item — shallow: a cited report can
still leave individual proposals un-surfaced). This **L2 deep pass** read all **173 reports + 127 research
topics in full** (10-agent fan-out) and checked **each proposal** against the backlog, not just the doc.

**Result: the corpus is ~85% surfaced — the `relatedReport:` discipline holds.** The deep read raised ~25
raw candidates, but verification showed **most were false positives**:
- **Stale** (the report's "unbuilt" is now built): lazy-traits `defineLazy` → #034/#032 (built).
- **Owning item missed by the agent:** `@domain` namespaces → #002; collection-operations-coordinator →
  #369/#452; validation-adherence tool → #005/#269; business-rule proof → #406/#093.
- **Already captured by L3 #1017:** change-tracking `CustomChangeStrategy` (webstates), validation adapter
  impls (webvalidation generation plane), injector `node.createElement` completion.
- **Reports named after their item** (recent 2026-06-18/19 batch): `…-933-…`, `…-949-…`, `…-979-…` are the
  item numbers — already surfaced.

**Verified genuinely net-new (small):** → **#1037**
- `configurable-loading-threshold` — a tunable loading intent dimension (0 backlog hits).
- `dom-less display:contents` provider-element pattern (existing hits are unrelated scoped-registration items).
- a `ui-configuration` standard (vague, low-value — confirm or discard).

**Takeaway:** the deep pass was worth running (it caught `configurable-loading-threshold`, which L1 missed),
but it largely **validated** that reports/research are well-tracked. No systemic surfacing gap here.

## 14. Terms + full-backlog (L1 — 2026-06-19)

The last two rows. Both are **continuously gated already**, so the "audit" is mostly confirming the gate.

**Terms (194)** — `we:src/_data/semantics.json`. All 194 carry a definition (0 missing; `check:standards`
also enforces no-duplicates). 26 are "defined-only" (not referenced elsewhere in `src/`), but those are
**vocabulary for not-yet-built features** (Change Strategy Registry, Conformance Level, Validity Pending) —
consistent with the §10 designed-not-built findings, not a terms defect. It's a reference glossary; no work
hides here. **No items.**

**Full backlog (1032 items)** — already audited continuously by `npm run check:health` →
`we:audits/backlog-health-audit.md` (757 flags across G1–G7/D1–D3). The "full audit" = reading that gate's
output:
- **G7 = 550 · G3 = 155** — the bulk, but **known tracked migration debt**: cite-the-statute-anchor (#885)
  and graduated-lineage (#619). INFO-level, not new.
- **D3 = 3 → 0** — *the one actionable find*: webdocs/webtraits/webcases were `concept`-despite-shipped;
  flipped to `poc` (folded into §1). Cleared.
- **G1 HIGH = 1** — #979 → #978 (open decision) lacks a `blockedBy` edge. Both are a **concurrent session's**
  in-flight MaaS items, so left for that session to lift (per the keep-the-DAG-honest rule at their claim).
- **D1 = 13** dead file refs · **G5 = 2** · **G2 = 2** — minor standing hygiene the gate already tracks.

**No new items** — the backlog's health is a live gate, and its one actionable signal (D3) is now resolved.
