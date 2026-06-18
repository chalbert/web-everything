# Backlog split analysis — 2026-06-12

Focused run: `/slice 398` (unsliced epic).

## Candidate

**#398 — Build the Web Docs product (FUI open primitives + plateau-app open-core service)** ·
`workItem: epic`, `parent: 089`, `status: open`, no children → **unsliced epic** (candidate kind b).
Already decided to decompose (reclassified story→epic 2026-06-12); the decomposition is the #091
ruling's four constellation layers. Rubric condition (1) is settled at the parent level — an epic *is*
the decision to decompose — so this is a slice-the-known-pieces run, not a should-we-split call.

Grounding: #091 ruling (RESOLVED 2026-06-12) maps Web Docs across the constellation —
standard→WE (exists), open primitives + ingestion adapters→FUI, served product + per-customer
conformance report→plateau-app, monetization = open-core by usage. #398 restates exactly this as the
build. Downstream #336 (dev-guide migration) is `blockedBy: 398` and needs the *product*, not the
decision.

## Could split — proposed slices

| # | Slice | Repo | workItem · size | Scope (one line) | blockedBy |
|---|---|---|---|---|---|
| **A** | `webdocs` generator impl | FUI | story · 5 | Serve-time generator: a `webmanifest`+`webcases` pair → a generated docs site; generalizes this repo's build-time `we:cases.js` loader to a hostable generator. Defines the `webcases` pivot the adapters target. | — |
| **B** | Self-host Web Docs UI primitives | FUI | story · 5 | The free, composable component floor to assemble a self-hosted docs UI — page shell + nav + the protocol/conformance panels (the "cancel and self-host always holds" floor). Reference impl = WE's own `/protocols/` + `capabilityMatrix` rendering. | — |
| **C** | Incumbent-ingestion adapters | FUI | story · 5 | Bottom-up adapters Storybook/Mintlify → the `webcases` pivot (lossy normalization-hub, per [[adapter-normalization-hub]]). Lets a non-WE customer onboard. Could later sub-split per-incumbent (Storybook·3, Mintlify·3). | A |
| **D** | plateau-app served site + per-customer conformance report | plateau-app | story · 5 | The tested, hosted product: serve one customer's generated site + their per-customer conformance/coverage dashboard (the parameterized-per-customer generalization of WE's static matrix). Open-core **free tier**. May later sub-split served-site vs. conformance-report. | A, B |

**DAG.** `A` and `B` are independent (≥2 parallel roots ✓). `C` needs the pivot from `A`. `D` needs the
generator `A` + the primitives `B`. Incremental delivery holds: `A` alone demos a generator over a
fixture; `B` alone demos a self-host UI shell; `A+B+D` is the served product. No half-a-protocol
intermediate — each slice leaves a fixture-demoable state.

```
A (generator) ─┐
               ├─→ D (served site + conformance report)   [→ E, gated]
B (primitives)─┘
A ─→ C (ingestion adapters)        (C independent of B/D)
```

## Could not split (cleanly) — 1 piece buries a decision

| Piece | Why it fails the rubric | Unblocking action |
|---|---|---|
| **Open-core usage tiering** (free→paid by usage) | **Rubric (1) — buried fork.** #091 ratified the *principle* (open-core by usage, "free tier → paid beyond a usage threshold") but left the *mechanics* unresolved: what is metered, where the paywall sits, and the billing/auth surface. That is an unresolved product/business fork, not volume — slicing it now just scatters the open call. It also can't ship before D exists. | Surface a **Tier-B decision** — "Web Docs open-core tiering mechanics: metered unit + threshold + billing/auth surface" — and resolve it (or `/prepare` it). Then it becomes a plateau-app build `blockedBy: D`. Tracked, not scaffolded as a build yet. |

## Net effect if approved

`+4` story slices (A–D) under epic #398 (epic left in place — already an epic, nothing to convert) ·
`+1` Tier-B decision item for the tiering mechanics · #398 stays `open` as the umbrella · #336 stays
`blockedBy: 398`. Slices A and B are immediately workable in parallel (FUI); none land ≤3, so these are
**single-pass `/next` stories, not `/batch` fodder** — C could be sub-split per-incumbent into two
batchable·3 stories if batchability is wanted.

---

## Second run — `/split 426` (per-incumbent sub-split)

**Candidate.** #426 — Incumbent-ingestion adapters (Storybook/Mintlify → `webcases` pivot) ·
`workItem: story`, `size: 5`, `parent: 398`, `blockedBy: 424`. Below the >8 sweep threshold, but a
**focused** run on the per-incumbent seam flagged in the first run. The two incumbents are distinct
source formats with no shared logic — splitting yields two batchable·3 stories from one single-pass·5.

**Rubric — all five hold.** (1) Volume, not a fork — the adapter direction (lossy normalization-hub)
is ruled; the only axis is "which incumbent format", pure volume. (2) Two nameable slices — Storybook
adapter, Mintlify adapter. (3) Each re-estimates to `size 3`, named scope (one source format →
`webcases`), batchable. (4) Independent — neither blocks the other; both `blockedBy: 424` (the pivot),
≥2 parallel ✓. (5) Each demoable alone — one incumbent export → a valid `webcases` fixture.

**Could split.** Per the *already-has-a-parent* edge case (don't nest an epic under #398), keep #426 as
a story re-scoped to its core slice and add the other as a sibling under #398:

| # | Slice | workItem · size | Scope | parent · blockedBy |
|---|---|---|---|---|
| **C1** | #426 re-scoped → **Storybook adapter** | story · 3 | Storybook (CSF/stories) → `webcases` pivot | 398 · 424 |
| **C2** | new sibling → **Mintlify adapter** | story · 3 | Mintlify (MDX/docs) → `webcases` pivot | 398 · 424 |

`+1` net (one new sibling; #426 re-scoped in place, not converted to an epic). Both batchable·3 and
independent → `/batch` can chain them once #424 lands. Further incumbents (Docusaurus, …) drop in later
as more size-3 siblings, no re-split needed.

---

## Third run — `/split 402` (Plateau platform-manager product)

**Candidate.** #402 — Plateau platform-manager product · `workItem: epic`, `size: 8`, `parent: 092`,
`status: open`. Unsliced epic. **Now unblocked:** its `blockedBy: 401` is satisfied — #401 (the WE
`provider-consumer-graph` protocol + `SeamContract`, graduated to `webregistries`) is **resolved**. The
#092 business ruling is also resolved. So this is pure build volume over an existing standard — no open
fork. The epic body enumerates five deliverables and #401 pins the graduated chain
(`graph-model → impact-analysis → governance-UI → platform-map`); the graph-model link is #401 (done),
the rest are this product.

**Rubric — all five hold.** (1) Volume, not a fork — #092 (model/business) ratified, #401 standard
authored; nothing to decide. (2) Five nameable slices, all plateau-app. (3) Each re-estimates to 3–5
with named scope. (4) The **aggregator is the root**; the four analyses/surfaces all depend only on it
and are mutually independent (≥2 parallel ✓); incremental delivery — the aggregated model alone is
demoable, each surface ships on its own. (5) Each leaves a valid fixture-demoable state — no
half-a-protocol intermediate.

**Could split** (children under epic #402 — parent #092 is a *story* anchor, not an epic, so #402 is a
proper storied umbrella; the resolved #401 edge is dropped from the slices and noted in the aggregator's
digest instead, per *keep the blocker DAG honest*):

| # | Slice | size | Scope | blockedBy |
|---|---|---|---|---|
| **A** | Cross-repo graph **aggregator** | story·5 | Consume #401's `provider-consumer-graph` + `SeamContract` across repos into one live aggregated model — the engine every surface reads. | — |
| **B** | **Impact analysis** | story·3 | "If I change X, who breaks?" — blast-radius traversal over the aggregated graph. | A |
| **C** | **Contract-drift detection** | story·3 | Cross-team: compare each provider tier vs the consumer's `consumerRequires` projection; flag subset-containment violations. | A |
| **D** | **Governance UI** | story·5 | Ownership/policy governance workflows over the model (who owns what, policy gates). | A |
| **E** | **Platform map** | story·3 | The live visual map of the provider-consumer platform graph. | A |

```
A (aggregator) ─┬─→ B (impact analysis)
                ├─→ C (contract-drift detection)
                ├─→ D (governance UI)
                └─→ E (platform map)
```

**Variant:** B + C are both seam-contract analyses — they could merge into one "graph analysis" slice
for a 4-way split if you'd rather not separate them. Proposed as 5 to stay faithful to the body's
distinct bullets (and each is an independent ≤3 story).

**Net effect:** `+5` slices (A–E) under #402; #402 → storied umbrella epic (drop `size: 8`, drop the
now-satisfied `blockedBy: 401`); `parent: 092` unchanged. A is workable immediately (the standard
exists); B/C/E are batchable·3 once A lands; D is single-pass·5.

---

## Fourth run — `/slice 350 351` (the Reporting + Compliance epics)

**Candidates.** #350 Web Reporting and #351 Web Compliance · both `workItem: epic`, `status: open`,
no children → unsliced epics. Both pre-decided to decompose and pre-fleshed (2026-06-12) into a
five-phase pipeline with the open forks ratified (Reporting = Project + one Protocol; Compliance =
Project + policy model emitting through Reporting's protocol; existing CI gates fold in as the seed
policy set). So this is a slice-the-known-phases run, not a should-we-split call.

**Rubric — all five hold for both.** (1) Volume, not a fork — the forks are ratified in the epic
bodies. (2) Five nameable phases each, every one with a real home (`webreporting` / `webcompliance`).
(3) Each phase re-estimates to size 2–3 with named scope. (4) Each epic has a single root (the model)
with the rest depending on it; incremental delivery — the model alone is a valid published Project +
Protocol page, each renderer/adapter/gate ships on its own. (5) No half-a-protocol intermediate — every
slice leaves a fixture-demoable state.

### #350 Web Reporting — could split

| # | Slice | size | Scope | blockedBy |
|---|---|---|---|---|
| **A** `#431` | report model + `webreporting` Project + Protocol | 3 | normalized schema (sources/sections/findings/severities/scores/series) authored as the protocol contract | — |
| **B** `#432` | v1 renderers — findings table + coverage matrix | 3 | two reusable views over the model, fixture-driven, auto-rendered | A |
| **C** `#433` | v1 ingest adapters — SARIF · JUnit · coverage | 3 | external format → report model (lossy normalization hub) | A |
| **D** `#434` | export adapters — model → SARIF/JUnit | 2 | interop out | A |
| **E** `#435` | producer migration | 3 | point `check:standards`/`app-conformance`/`readiness`/burndown/capability-manifest at the model + shared renderers | A, B |

```
A (model+protocol) ─┬─→ B (renderers) ─→ E (producer migration)
                    ├─→ C (ingest adapters)
                    └─→ D (export adapters)
```

### #351 Web Compliance — could split

| # | Slice | size | Scope | blockedBy |
|---|---|---|---|---|
| **A** `#436` | policy/rule model (extends platform-default) | 3 | which criteria enforced, severity, scope; policy-as-code, versioned, project extends baseline | — |
| **B** `#437` | compliance gates / CI runner | 3 | runners that fail CI on a violation; generalize benchmark `--strict` | A |
| **C** `#438` | waivers / exceptions | 2 | tracked, expiring, audited overrides | A, B |
| **D** `#439` | audit / evidence trail | 3 | what enforced/when/which version/result; **emits through #350's report model** | A, B, **#431** |
| **E** `#440` | retrofit existing gates as policies | 3 | `check:standards` + readiness re-expressed as declared severity-tagged policies | A, B |

```
A (policy model) ─┬─→ B (gates) ─┬─→ C (waivers)
                  │              ├─→ D (audit trail)  ←── also #431 (cross-epic: shared report model)
                  │              └─→ E (retrofit gates)
                  └──────────────┘
```

**The one cross-epic edge:** #439 (Compliance audit trail) `blockedBy #431` (Reporting's report model) —
the two projects share exactly one protocol, in Reporting, and Compliance's results ride it. Faithful to
the ratified "Compliance owns no protocol" leaning.

## Net effect

`+10` story slices · both epics → storied umbrellas (dropped `size: 8` + `childlessReason`, gained five
children each) · both stay `open`, still crossRef each other. Roots **#431** (report model) and **#436**
(policy model) are workable immediately, in parallel, in separate projects. The size-2/3 leaves are
`/batch` fodder once their root lands; #439 waits on #431 (cross-epic). `check:standards` green after the
scaffold (0 errors).

---

## Fifth run — `/split 170` (plugs runtime duplication)

**Candidate.** #170 — The plugs runtime is duplicated (and drifting) between WE and Frontier UI ·
`workItem: story`, `size: 13`, `status: open`. The frontmatter `size` is stale; the body's 06-11 note
kept `story·5`, the 06-12 re-measure bumped it to `8` and **explicitly recommended a re-scope into three
items before next pickup**. A prior session's assessment ("just fix the size, don't slice") read only the
06-11 note and missed that 06-12 conclusion — so this run re-measured the drift fresh.

**On-disk drift re-measured this run** (`webeverything/plugs/` vs `frontierui/plugs/`, excl. tests):
**15 drifted · 38 identical · 9 WE-only · 3 FU-only**. Directionality (`<`=WE-unique, `>`=FU-unique):

- **FU ahead (merge UP into WE):** `we:CustomAttributeRegistry.ts` 362→892 (FU+541 / WE+11 — asymmetric
  merge; #221/#280/#222/#226 visibility-gating + lazy fetch-on-view) · `we:Node.injectors.patch.ts` (FU+14) ·
  `webbehaviors/index` (FU+5) · `webexpressions/index` (FU+2 cloneHandlers) · `HTMLInjector` (FU+1).
- **Bidirectional (true merge, but tiny):** `webcontexts/CustomContext` (FU+24/WE+9) ·
  `Node.contexts.patch` (FU+9/WE+4) · `CustomTextNodeRegistry` (FU+6/WE+2) · `core/CustomRegistry`
  (FU+2 GetterValue / WE+2 `entries()`) · `CustomTextNodeParser` · `UndeterminedTextNode` (1/side).
- **WE ahead (reach FU via the alias — no work):** `webregistries/CustomElementRegistry` (WE+42) ·
  `webinjectors/Injector` (WE+44) · `webinjectors/index` (WE+13, #278 declarative-injector exports) ·
  9 WE-only files: `webvalidation/*`×6, `webguards/*`×2, `we:declarativeInjector.ts`.
- **bootstrap.ts** — bidirectional: WE has validation/guards registration; FU has trait-manifest (#116).
- **3 FU-only** (`fui:globals.d.ts`, `we:virtual-trait-manifest.d.ts`, `we:traitManifest.ts`) — stay FU-local
  (only `we:traitManifest.ts` rides up if slice B needs it).

**Rubric — all five hold.** (1) Volume, not a fork — the strategy fork (alias vs sync) is **resolved**
(2026-06-11: FU imports `@we/plugs/*`, WE single-source); the residual trait-manifest build-portability is
*wiring* (FU's 3-way `virtual:trait-manifest` resolution is the template), not an open call. (2) Three
nameable slices, real homes. (3) A=5, B=3, C=task — none buries a fork, all named files. (4) A ∥ B both
block C; ≥2 independent roots; incremental delivery (A and B each land value in WE before C dedups).
(5) Each demoable: A = gating attrs in WE (merge-up only, FU copy untouched → drift resolved); B = WE
boots with empty manifest; C = FU de-duplicated and building on WE's tree.

### Could split

| # | Slice | type · size | Scope | blockedBy |
|---|---|---|---|---|
| **A** | Merge FU's attribute-lifecycle + runtime advances **up into WE** | story · 5 | Adopt FU's `we:CustomAttributeRegistry.ts` (visibility-gating + lazy fetch-on-view, #221/#280/#222/#226) preserving WE's 11 unique lines; fold the FU-ahead/bidirectional reconciles across `webbehaviors/index`, `webexpressions/*` (incl. cloneHandlers), `webcontexts/*`, `core/CustomRegistry` (GetterValue ← / `entries()` →), `Node.injectors.patch`+`HTMLInjector`. WE becomes the runtime superset. | — |
| **B** | Bring trait-manifest lazy-loading into WE's bootstrap, build-portably | story · 3 | Move `we:traitManifest.ts`(+`.d.ts`) up; wire `we:bootstrap.ts` `registerTraits(virtual:trait-manifest)` with the tsc ambient stub + vitest empty-alias (FU's 3-way pattern). WE bootstrap = superset incl. #116. | — |
| **C** | Wire `@we/plugs/*` alias in Frontier UI + delete the vendored tree | task · 3 | Point FU at `@we/plugs/*`; delete `frontierui/plugs/`. WE-ahead files reach FU via the alias — **no copy-down** (folds in the body's old step (b), which would have been throwaway). Verify FU build + tests green. | A, B |

```
A (merge FU runtime up) ─┐
                         ├─→ C (alias FU + delete vendored tree)
B (trait-manifest up)  ──┘
```

**Batchable:** B (story·3) + C (task) are batch-eligible; A (story·5) is above the batch ceiling — run it
standalone via `/next`, then `/batch` B+C behind it.

### Could not split

None — the candidate splits.

**Correction vs the body's (a)/(b)/(c):** the 06-12 note's step (b) "flow WE's files down to FU" is
**redundant under the resolved alias strategy** — once C deletes FU's tree and aliases to WE, the WE-only
files reach FU automatically; copying them down first is work C immediately deletes. (b) is folded into C.

**Net effect if approved:** `+3` (A/B/C) under epic #170; #170 `story → storied epic` (drop `size`, refresh
digest to umbrella, keep `open`, keep NNN). #165/#167 (`plugs/` lifecycle items) benefit — once C lands,
their fixes reach FU automatically.
