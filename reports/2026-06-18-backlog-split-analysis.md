# Backlog split analysis — 2026-06-18

Focused runs (appended in order): `/split 904`, `/slice 753`, `/split 894`, `/split 818`, `/slice 934`, `/split 725`, `/split 725` (2nd pass — webvalidation residual, could-not-split), `/split 940`, `/split 972`, `/slice 1002` (plugs test-coverage epic — partial split: 3 cut now, rest deferred behind the measurement slice), `/slice 1003` (webanalytics build epic — partial split: 3 cut now, composition-seam slice deferred behind unbuilt webtraces/webevents impl), `/slice 1008` (triage-roadmap "epic of epics" — **rule broadened mid-session** to recognise *sub-epic slices*; now **could-split (partial)**: 11 sub-epics carve-able, webtraces deferred to #992).

## Candidate

**#904** — *Close the 10 block contract-impl drift gaps in FUI + flip
`BLOCK_IMPL_DRIFT_ENFORCED` + add export-shape arm* · `workItem: story` · `size: 13` ·
`parent: "170"` · `status: open`.

The #659 drift gate (`validateBlockImplConformance`, [we:check-standards-rules.mjs:1234](../scripts/check-standards-rules.mjs#L1234))
WARNs on 10 WE block contracts whose `implementedBy` resolves to nothing in `../fui:blocks/`.
904's own claim-time investigation already established the impls were **never built** (not moved),
so the deliverable is **building 10 FUI block impls**, then **flipping the gate to ERROR**, then a
**second gate arm** comparing each block's declared CEM/export surface to the impl's actual exports.

## Work-investigation pass (read the real tree)

- **Gate** is `locus: webeverything`: a flip of `export const BLOCK_IMPL_DRIFT_ENFORCED = false`
  ([we:check-standards-rules.mjs:1232](../scripts/check-standards-rules.mjs#L1232)) — pure, one line, plus
  the export-shape arm is a new function beside it. The fs walk feeding it lives in `we:check-standards.mjs`.
- **The 10 block builds are `locus: frontierui`.** Each WE contract names its target dir under
  `../fui:blocks/…`; none exist today (`ls` confirms 31 dirs, none of the 10). Each is an
  independently-deliverable custom-element / module build.
- **All governing decisions are RESOLVED** — no buried fork in any slice:
  #626 (block mints), #629/#630/#631/#590/#618 (web-editing → rich-text-editor),
  #634/#650/#651 (workflow → workflow-engine/wizard), #653 (CEM → props-table),
  #452 (collection-operations standalone). #812 (apps consuming moved impls) is resolved too.
- **Composed FUI deps already exist:** `wizard` composes `blocks/stepper` ✓;
  `collection-operations` reuses `blocks/renderers/data-table` ✓ + hands totals to
  `blocks/renderers/pagination` ✓. So no slice is blocked on an unbuilt dependency.
- **Two intra-set edges:** `code-view` composes `data-transfer`'s copy-out half →
  `code-view blockedBy data-transfer`; `wizard` wires its orchestration through the engine →
  `wizard blockedBy workflow-engine`.

## Could split — #904 → 12 slices

| # | Slice | workItem / size | locus | blockedBy | Batchable now |
|---|-------|-----------------|-------|-----------|---------------|
| S1 | Build `data-transfer` FUI impl (drop-zone: DnD+paste+file → `receive`/`reject`, `accepts`, a11y picker, copy-out `emit`) | story · 5 | frontierui | — | ✅ |
| S2 | Build `code-view` FUI impl (Custom Highlight API tokenizer + copy affordance + library-highlighter adapter seam) | story · 5 | frontierui | S1 | after S1 |
| S3 | Build `collection-operations` FUI impl (headless coordinator; reuse data-table `applyPipeline`, window page, emit `collection-operations-change`) | story · 3 | frontierui | — | ✅ |
| S4 | Build `draft-persistence` FUI impl (CustomStorageStrategy IDB/localStorage/memory + LWW co-edit + BroadcastChannel presence) | story · 5 | frontierui | — | ✅ |
| S5 | Build `props-table` FUI impl (render CEM as sortable attrs/props/events/slots/parts table) | story · 3 | frontierui | — | ✅ |
| S6 | Build `reorderable-list` FUI impl (pointer+keyboard reorder, `moveBefore`, live-region, commit strategy) | story · 5 | frontierui | — | ✅ |
| S7 | Build `story-canvas` FUI impl (render one WebCase in an isolated style/script frame; interaction scripts) | story · 5 | frontierui | — | ✅ |
| S8 | Build `workflow-engine` FUI impl (dependency-free SCXML-style interpreter + registry + XState adapter) | story · 8 | frontierui | — | ⚠ further /slice |
| S9 | Build `wizard` FUI impl (`<wizard-flow>`; compose Stepper, map engine transition stream → step status, `back()`) | story · 5 | frontierui | S8 | after S8 |
| S10 | Build `rich-text-editor` FUI impl (CustomEditorEngineRegistry; contenteditable+InputEvent default; compose text-formatting; sanitizer; Highlight decorations; PM/Lexical/Slate/Quill adapters) | story · 8 | frontierui | — | ⚠ further /slice |
| S11 | Flip `BLOCK_IMPL_DRIFT_ENFORCED=true` (drift now hard-fails — the #726 block analogue) | task | webeverything | S1–S10 | gated on all 10 |
| S12 | Add export-shape arm — parse each resolved impl's actual exports vs declared CEM surface; deeper content-equality | story · 5 | webeverything | S1–S10 | gated on all 10 |

**DAG (roots run in parallel):**

```
data-transfer(S1) ─→ code-view(S2) ┐
workflow-engine(S8) ─→ wizard(S9)  │
collection-operations(S3) ─────────┤
draft-persistence(S4) ─────────────┼─→ flip gate (S11)
props-table(S5) ───────────────────┤        ↘
reorderable-list(S6) ──────────────┤   export-shape arm (S12)
story-canvas(S7) ──────────────────┤
rich-text-editor(S10) ─────────────┘
```

- **8 independent roots** (S1, S3, S4, S5, S6, S7, S8, S10) proceed in any order — strong parallelism.
- **Incremental delivery:** every block build independently flips one drift WARN to clean, and leaves
  a valid demoable state (each is a real FUI block with its own fixture). No partial-protocol seam.
- **Batchable now:** S1, S3, S4, S5, S6, S7 (six `size ≤ 5` roots). S2/S9 batch once their one
  blocker lands. S11/S12 batch once all 10 impls exist.

### Two slices that need a further /slice (not a blocker to this split)

S8 `workflow-engine` and S10 `rich-text-editor` re-estimate to **size 8** — past the batch ceiling.
They are still independently-deliverable stories, but their internal seams **cannot be drawn yet**:
the FUI impl surface doesn't exist, so there's no code to cite a seam against (investigation-pass
condition 3). They land as `size·8` stories flagged **future /slice once a foundational core lands**
(e.g. engine-core vs XState adapter; editor-core vs the 4 engine adapters). Carrying them whole is
correct — slicing them now would be guessing seams from prose.

## Could not split

None — every slice cleared the rubric. (S8/S10 split *partially* — sliced out of 904 cleanly, but
each is itself a future split candidate as noted above.)

## Structural note for approval — 904's `parent: "170"`

904 currently sets `parent: "170"`, but **#170 is the *plugs-runtime* dedup epic** (its body and its
existing #A/#B/#C children are entirely about `plugs/` byte-drift). 904 is *block-impl* drift — a
thematic analogue (the gate cites "#170/#659") but **not** within #170's plugs scope. The skill's
"already has a parent" edge case (keep 904 a story, add siblings under the parent) would dump 11
FUI-block-build items into the plugs epic — wrong scoping.

**Recommendation:** treat the block-backfill as its own epic. Convert **904 → a storied epic in its
own right** (umbrella: "FUI block-impl backfill + drift enforcement"), **drop `parent: "170"`**
(optionally keep a `relatedItem: 170` cross-link for the drift-family lineage), and roll S1–S12 under
**904**. This matches 904's own body ("re-homed conceptually to FUI… should be /sliced into per-block
build items"). ~85% confidence; the residual is whether you'd rather preserve the #170 parent link as
a loose grouping despite the scope mismatch.

---

# Focused run: `/split 753` — polyglot adapter panel

**Verdict: COULD SPLIT** (5 slices).

## Candidate

**#753** — *Polyglot adapter panel — generate the component across frameworks/languages, live-test it,
link to authoring your own* · `workItem: story` · `size: 13` · `parent: "746"` · `locus: frontierui` ·
`status: open` · `blockedBy: [843, 851, 855, 892]` (**all four resolved**).

Resized 8→13 in batch-2026-06-18 with an explicit `/slice` instruction. The body's own closing verdict
already names the decomposition; this pass verifies each proposed slice against the real tree.

## Work-investigation pass (read the real tree, both repos)

| Substrate | State | Citation |
|---|---|---|
| Forward generator (CEM→React/Vue wrapper source) | **exists, pure fn** `generateWrapper(decl, target)`, `TARGETS=['react','vue']` | `fui:tools/gen-wrapper/genWrapper.mjs:207,26` |
| CEM with real `customElement`+`tagName` decls | **exists** (#843 landed the tagName values) | `we:scripts/gen-cem.mjs` (#843, resolved) |
| Incumbent-ingest adapter (incumbent→CEM→WE block) | **exists** (WE-side, headless + CLI) | `we:scripts/ingest-adapter/ingestComponent.mjs`, `we:scripts/ingest-adapter/cli.mjs` (#851, resolved) |
| Behavioral wrapper-conformance vectors + runner | **exists** | `fui:wrapper-conformance/runner.ts` (#891, resolved) |
| Cross-language conformance suite (gate verdict) | **exists** | `we:blocks/renderers/module-service/conformance` (#506, resolved) |
| Workbench shell + panel system (theme/trait/inspector/anatomy/share) | **exists, rich** | `fui:workbench/mount.ts`, `fui:workbench/registry.ts` |
| **Live code-execution sandbox** (mounts + runs generated React/Vue) | **does NOT exist** — the workbench iframe is a *distribution* shell, not a code sandbox; the embed SDK renders the component, not generated wrapper code | `fui:workbench/registry.ts:4`, `fui:embed/` |

**Conclusion:** generation, ingest, and conformance substrates are all built and resolved; the panel work
is *consume + display + execute* wiring over them. The only genuinely new, non-trivial sub-build is the
live-test sandbox (executing generated framework code in-browser). Seams fall cleanly along the body's
five named pieces.

## Could split — #753 → 5 slices

Edge case (*Executing a split* → "already has a parent"): #753 already sets `parent: 746`, so it is **not**
converted to a nested epic. It stays a `story` re-scoped to its **core slice (a)** and re-sized; (b)–(e)
are added as **siblings under #746**. (Contrast the #904 run above, where the parent link itself was
mis-scoped — here `parent: 746` is correct: #746 *is* the Block Explorer workbench epic and already lists
#753 as its slice 7.)

| Slice | What it adds | Home | `workItem`/`size` | blockedBy |
|---|---|---|---|---|
| **(a) #753** (kept, re-scoped) — consume-mode forward output tabs | Per-target tabs (React/Vue) showing `generateWrapper(decl,target)` source for the current block's CEM decl; new workbench panel | `fui:workbench/` (new panel builder + `fui:workbench/registry.ts` wiring) | `story·3` | — (substrate resolved) |
| **(b)** live-test sandbox | Embedded iframe/shadow sandbox that transpiles + mounts the generated wrapper and renders it live (the body's flagged "non-trivial sub-build"); the in-browser transpile approach (esbuild-wasm / Babel-standalone) is a builder impl choice, not a fork | `fui:workbench/` (new sandbox module) | `story·5` | #753 |
| **(c)** per-target conformance badges | Pass/fail badge per target tab, consuming the #891 wrapper-conformance runner + #506 gate verdict | `fui:workbench/` (badge UI) | `story·3` | #753 |
| **(d)** create-your-own-adapter doc + scaffold | Doc page + scaffold template entry for authoring a new target generator (mostly doc per the body) | FUI docs + scaffold template | `story·2` | #753 |
| **(e)** reverse-ingest paste demo | Paste an incumbent (e.g. MUI button) → run the #851 ingest adapter → show neutral CEM → re-emit as a WE block; panel UI is FUI, the adapter is the resolved WE substrate (vendored FUI-side per #855/#892) | `fui:workbench/` (paste panel) | `story·5` | — (independent of #753) |

### Slice DAG

```
#753 (a) ──┬── (b) live-test sandbox
           ├── (c) conformance badges
           └── (d) create-your-own-adapter doc

(e) reverse-ingest ── (independent root)
```

Two independent roots — **#753 (a)** and **(e)** — proceed in parallel; (b)/(c)/(d) hang off (a). Each
slice ships a valid, independently-demoable panel/doc state, so the chain also delivers incrementally.

### Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — every design fork is resolved: substrate (#811), WE→FUI handoff
   (#855 B2), generator re-home (#892), tagName values (#843), ingest adapter (#851). No buried decision.
2. **≥2 nameable slices, real home** ✓ — 5 slices, each a FUI workbench panel or doc.
3. **Slices land ≤5 / task** ✓ — 3/5/3/2/5; each `file:line`-grounded above.
4. **Clean acyclic DAG, ≥2 independent** ✓ — (a) and (e) are independent roots; incremental delivery.
5. **No coherence loss; each demoable** ✓ — (a) shows generated source, (b) renders it live, (c) badges
   it, (d) is a reachable doc, (e) round-trips an incumbent — each valid standalone.

### Notes carried into the slices (flagged, not buried)

- **Slice (e) ingest-adapter availability.** The #851 ingest adapter still lives **WE-side**
  (`we:scripts/ingest-adapter/`) and was **not** re-homed to FUI (unlike `genWrapper`, which #892 moved). For
  the FUI panel to run it, it must be vendored/re-homed FUI-side — the mechanical #892-analog, folded into
  slice (e)'s scope (hence `size·5`), explicitly so it is not a hidden seam. **Settled by precedent, not an
  open fork:** the #855 (B2) contracts-only ruling + #892 establish that generation/ingest *tooling* is
  FUI-side (only the CEM contract crosses WE→FUI), so the one coherent answer is "vendor the adapter
  FUI-side." *No `type:decision` card filed* — the fork-existence test fails (the alternative, "WE publishes
  ingest as a standard / runtime crosses the boundary," is ruled out by #855).
- **Author-mode (#818)** remains the separate, demand-gated follow-on (`blockedBy: 753`); its appetite-probe
  gate is exactly slice (a) (consume-mode). The `blockedBy: 753` edge stays coherent after the re-scope.

## Could not split

None — #753 splits cleanly.

---

# Focused run: `/split 894`

## Candidate

**#894** — *Relocate the whole trait-enforcer (manifest contract + 5 plugins) out of WE to FUI* ·
`workItem: story` · `size: 13` · `blockedBy: ["905"]` · `status: open`.

Per the ratified scope **#905-A**: move the **5 bundler plugins** + **`composedTraitSet`** to FUI; **keep
`we:traitManifestContract.ts`** (neutral SoT) **and the `we:plugs/webbehaviors/` protocol surface** in WE;
swap WE's vite config to the empty `virtual:trait-manifest` `resolve.alias`. The item's own
batch-2026-06-18 claim note re-sized it **5 → 13** on discovering FUI's side is not a stub but a **295-line
divergent reimplementation** with its own passing test suite — so the real job is a **cross-repo
divergent-implementation reconciliation**, not a file move.

## Work-investigation pass (read the real tree)

- **The contract is a clean neutral SoT, stays in WE.** [we:traitManifestContract.ts:35-162](../tools/trait-enforcer/traitManifestContract.ts#L35)
  is pure types + consts + regex-source, **zero imports** — the #463 polyglot-readable definition. WE
  consumer [we:traitServePath.ts:28-31](../blocks/renderers/module-service/traitServePath.ts#L28) imports its
  `TraitManifest`/`TraitManifestEntry` *types* (the MaaS serve-path). WE may not import FUI (#239) → the
  contract is correctly WE-resident and is **not part of the move**.
- **FUI's vite-plugin is a divergent inline-typed fork, not a stub.** [fui:vite-plugin.ts:50-65](../../fui:tools/trait-enforcer/vite-plugin.ts#L50)
  defines `TraitMapEntry`/`TraitMap` + `normalizeEntry` **inline** (imports only `fs`/`path`/`vite`) — it
  does **not** consume the WE contract. FUI has **only** `fui:tools/trait-enforcer/vite-plugin.ts` + `fui:tools/trait-enforcer/virtual.d.ts`; it lacks
  rollup/webpack/esbuild/parcel + `composedTraitSet`. So the move must (a) **converge** FUI's fork onto the
  WE contract and (b) **add** the 4 missing wrappers.
- **The 4 sibling plugins are thin wrappers over the vite-plugin core.** rollup/webpack/esbuild/parcel each
  import the scan-and-emit core from `fui:tools/trait-enforcer/vite-plugin.ts`; `composedTraitSet` imports `TraitMap` *type*
  from the contract. So they can only move **after** FUI's vite-plugin is the converged, contract-driven
  core they import from.
- **Test collision is real.** Both repos ship `we:tools/trait-enforcer/__tests__/trait-enforcer.test.ts` (and the `fui:` copy); FUI also has
  `fui:tools/trait-enforcer/__tests__/chunk-isolation.build.test.ts`. WE's suite (`multi-bundler`, `cross-bundler-conformance`,
  `composedTraitSet`, `traitManifestContract`) must be reconciled against FUI's on move.
- **WE config swap is mechanical and FUI-independent.** [we:vite.config.mts:96](../vite.config.mts#L96)
  `traitEnforcer({traitMap:{}})` → copy the vitest leg's existing empty `resolve.alias`; WE's traitMap is
  empty by design so the runtime is byte-identical.

## Could not split — #894 is atomic

The implied decomposition is a **forced linear cross-repo chain**:

```
S1 wire @webeverything/trait-manifest-contract alias (#804-2a)   [no consumer yet]
   └─→ S2 converge FUI vite-plugin onto the WE contract SoT (preserve scanner; FUI tests green)
          └─→ S3 move 4 wrappers + composedTraitSet + tests (reconcile collisions)
                 └─→ S4 WE teardown: drop traitEnforcer(), swap alias, delete moved files, dual-repo verify
```

| Rubric condition | Verdict |
|---|---|
| (1) Volume, not uncertainty | ✓ — #905-A resolved the scope; no buried fork. |
| (2) ≥2 nameable slices, real home | ✓ — seams nameable (S1–S4). |
| (3) Slices land ≤5 / task | ⚠ — only if sub-sliced as above; but see (4)/(5). |
| **(4) Clean DAG, ≥2 independent** | ✗ — a **rigid chain**: one weak root (S1) whose alias has **no consumer until S2** (dead config — "a registry with no consumer"), then S2→S3→S4 strictly serial. No genuine parallelism; nothing user-usable until the chain completes. |
| **(5) Every slice leaves a valid demoable state** | ✗ — the heart is a **single delicate divergent-impl reconciliation**: S2 must preserve FUI's 295-line scanner behavior exactly (its tests must stay green) while re-typing it onto the WE contract, and S3's wrapper move + test-collision reconcile only makes sense once S2's converged core exists. Carving it leaves FUI's scanner half-overwritten between slices — the exact "careless overwrite breaking FUI's scanner" the item's own re-size note guards against. |

**Conclusion:** could-not-split. The item was already **deliberately re-sized 5 → 13** in
batch-2026-06-18 with precisely this reasoning ("not a clean file relocation; a cross-repo divergent-
implementation reconciliation … a focused single-item job (≈13), not a batchable·5"). Slicing scatters one
coherent, risk-bearing reconciliation across children that gain nothing over single-passing it.

**Unblocking action (marginal, not required):** the one genuinely-separable piece is landing
`@webeverything/trait-manifest-contract` as a standalone **type-only contracts package** — but that is the
scope of **epic #872** (contract-distribution package end-state), not this item. If #872's package work is
tackled, the alias rides *that* epic and #894's core shrinks ~13 → ~8; absent #872, S1 is dead config with
no consumer and peeling it off buys nothing. **Recommendation: leave #894 whole and single-pass it via
`/next` once #905's leg is worked** (it's already `blockedBy: 905`, now resolved → unblocked).

## Could not split — summary table

| #NNN | Title | Failed condition | Unblocking action |
|---|---|---|---|
| #894 | Relocate trait-enforcer to FUI | (4) forced linear chain, no independence + (5) delicate single reconciliation, no valid intermediate | None required — genuinely atomic; single-pass it. (Marginal: land `@webeverything/trait-manifest-contract` under epic #872 to shave the alias off.) |

---

# `/split 818` — author-mode emit (idiomatic React/Vue/Svelte/Angular source)

Focused run: `/split 818`.

## Candidate

**#818** — *Author-mode emit — start on the declarative `<component>` subset (bidir transform);
dedicated emit IR (C) deferred* · `workItem: story` · `size: 13` · `parent: "746"` ·
`blockedBy: ["753"]` · `relatedProject: webdocs` · `status: open`.

Per #811 Fork 2 the near-term scope is **subset-first**: emit idiomatic native React/Vue/Svelte/Angular
component source by serializing the subset that already round-trips through the WE declarative
`<component>` form; the dedicated emit-purpose IR (Option C) is an explicitly-deferred, case-informed
follow-on. The item is **DEMAND-GATED** — "build only after #753's consume-mode probe ships *and appetite
for idiomatic source is shown*."

## Work-investigation pass (read the real tree)

| What the body implies | What the tree actually shows |
|---|---|
| A subset-emit substrate to slice per framework | `generateComponentSource(ir)` ([we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135)) emits **only the WE declarative `<component>` form**; `ComponentIR` ([we:upgraderEngine.ts:38](../blocks/renderers/upgrader/upgraderEngine.ts#L38)) is **ingest-focused, unidirectional**. No per-framework author-mode serializer exists. |
| Per-framework emit is fresh greenfield work | The React-ish/native forms are **already shipped** via the transform core: `ServeForm = 'declarative' \| 'wc-class' \| 'html' \| 'jsx' \| 'functional'` ([we:moduleService.ts:33](../blocks/renderers/module-service/moduleService.ts#L33)), `serve(definition, opts)` ([we:moduleService.ts:142](../blocks/renderers/module-service/moduleService.ts#L142)) — "every other form … is one `serve(definition, { form })` away, with no parallel generator" (we:upgraderEngine.ts:133). |
| Vue/Svelte/Angular are nameable slices | **Zero code.** `ServeForm` has no `vue`/`svelte`/`angular` member; the consume-mode emitter map is React/Vue only (`EMITTERS = { react, vue }`, [we:genWrapper.mjs:198](../scripts/gen-wrapper/genWrapper.mjs#L198)) and is a *different axis* (CEM→wrapper, not author-mode source). The body itself flags these idioms as the unknown "wall." |
| Blocker is open | **#753 resolved 2026-06-18** (graduated to `fui:fui:workbench/mount.ts`) → the consume-mode probe shipped today. The *appetite* half of the demand gate is **not yet shown**. |

**Net:** the only groundable seam is a thin wiring slice onto the **already-built** `serve()` forms
(jsx/functional/wc-class = the React-ish + native-WC targets). The genuinely-new targets the item exists
for — idiomatic **Vue/Svelte/Angular** source — have **no code to point at**, and the body explicitly says
their binding idioms are an under-specified wall discovered *by building*, which is also the evidence base
for the deferred Option-C IR call. Those are hypotheses, not slices.

## Verdict — could NOT split

| Rubric condition | Verdict |
|---|---|
| (1) Volume, not uncertainty | ✗-adjacent — the size is largely **discovery uncertainty**: how far flat-declarative stretches per framework is explicitly unknown until built, and that discovery is what feeds the deferred Option-C emit-IR decision. |
| (2) ≥2 nameable slices, real home | ✗ — only **one** slice is groundable (wire panel onto existing `serve()` forms). Vue/Svelte/Angular emitters can't be cited in the real tree — no `ServeForm` member, no emitter, body calls them an unknown wall. |
| (3) Slices land ≤5 / task, files grounded | ✗ — the per-framework slices' "named files" don't exist; they'd be authored from the body (the forbidden "straight from the body" guess). |
| (4) Clean DAG, ≥2 independent | ✗ — the honest shape is **one groundable foundation → three un-specifiable emitters** that all share the same unknown (the IR/binding-idiom wall). No real independence; nothing to parallelise. |
| (5) Every slice leaves valid demoable state | n/a — fails earlier; the foundation slice alone *would* demo (an output-tabs mode over `serve()` forms), but a single demoable slice is a re-scope, not a split. |

**Conclusion:** could-not-split. The subset emit it could ship *today* (React-ish/native forms) is already
one `serve(definition,{form})` call away — so it isn't ≥2 slices' worth of new work — and the work the item
*exists* for (Vue/Svelte/Angular idiomatic source) is un-investigable until the foundation lands and reveals
where the flat-declarative subset stops stretching. Slicing now would manufacture three hypothesis cards the
batch would choke on. It is also **demand-gated with the appetite signal not yet shown** (#753 only resolved
today), so even the foundation shouldn't be scoped until appetite is confirmed.

**Unblocking action.** Land the **foundational slice first** as a re-scoped standalone `story·3`
(*not* a split): "author-mode emit — wire a panel/output-tabs mode onto the existing
`serve(definition,{form})` forms (jsx/functional/wc-class) for the declarative-`<component>` subset, with
'flag, don't fake' subset-boundary detection." It is fully groundable in [we:moduleService.ts:142](../blocks/renderers/module-service/moduleService.ts#L142)
/ [we:moduleService.ts:33](../blocks/renderers/module-service/moduleService.ts#L33) / [we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135).
Its shipped artifact + the cases it accumulates then (a) **expose the real Vue/Svelte/Angular emitter seams**
so each becomes a groundable, independent, batchable per-framework slice, and (b) supply the evidence base
for the deferred **Option-C emit-IR** decision — which should be filed as its **own parked `type:decision`
card** rather than left as an inline forward-pointer in #818's body
([[feedback_decisions_are_workitems_not_plan_mode]]). Gate the foundation on the DEMAND signal (#753
appetite) per the item's existing note.

## Could not split — summary table

| #NNN | Title | Failed condition | Unblocking action |
|---|---|---|---|
| #818 | Author-mode emit (subset-first) | (2)/(3) only one groundable slice — Vue/Svelte/Angular emitters un-citable (no code, body's own "wall") + (4) one foundation → three un-specifiable emitters, no independence + demand-gated (appetite not shown) | Land the foundation first (re-scope #818 to a `story·3`: wire output-tabs onto existing `serve(){form}` forms + subset-boundary detection). Its cases expose the per-framework seams → then they split. File the deferred Option-C emit-IR as its own parked `type:decision` card. |

---

# Focused run: `/slice 934` — WE-docs chrome composes real WE traits

## Candidate

**#934** — *WE-docs chrome composes real WE traits instead of hand-rolled behavior* ·
`workItem: epic` · `size: 13` · `parent: "777"` · `blockedBy: ["932"]` (**resolved 2026-06-18**) ·
`locus: frontierui` · `relatedProject: webdocs` · `status: open`. **Unsliced epic (kind b)** — no
child names it as `parent`; rubric (1) settled at the parent level (#932 ruled boot-the-registry &
compose, Fork 1 = A). The body proposes 7 "likely slices, draw at slice time"; this pass verifies
each against the real frontierui tree.

## Work-investigation pass (read the real tree, both repos)

| Body's claim | What the tree actually shows |
|---|---|
| `nav:section` uses bare `document.querySelector` → inert in shadow root | ✓ confirmed — [fui:blocks/navigation/NavSectionBehavior.ts:47](../../fui:blocks/navigation/NavSectionBehavior.ts#L47) `return document.querySelector(selector)` |
| `nav:list` has the same shadow problem (audit it) | ✗ **already shadow-safe** — [fui:blocks/navigation/NavListBehavior.ts:105-115](../../fui:blocks/navigation/NavListBehavior.ts#L105) scopes to `this.target.querySelectorAll`; the slice shrinks to "fix nav:section + confirm nav:list" |
| disclosure-nav hand-rolls sibling-exclusive / outside-click / responsive / Escape | ✓ confirmed — [fui:blocks/disclosure-nav/DisclosureNav.ts:110-163](../../fui:blocks/disclosure-nav/DisclosureNav.ts#L110) `wireDisclosure()`: desktop-gate click (l.123), `closeAll` sibling-exclusive (l.120), Escape+refocus (l.132), outside click/focus via `composedPath` (l.146) |
| these behaviors are NOT in nav:section/nav:list (a real new trait) | ✓ confirmed — nav:section = per-section disclosure, nav:list = roving list; **sibling-exclusive + outside-dismiss + responsive gating is a genuine new coordinator** → the epic is *not* a pure rebuild |
| sectioned-nav hand-rolls its accordion toggle | ✓ confirmed — [fui:blocks/sectioned-nav/SectionedNav.ts:56-91](../../fui:blocks/sectioned-nav/SectionedNav.ts#L56) per-section click toggle (l.73) + Escape (l.80), **no** sibling exclusivity → maps to `nav:section` alone, no coordinator needed |
| mode-C chrome path has no registry boot | ✓ confirmed — [fui:embed/chrome-in-document.ts:102-133](../../fui:embed/chrome-in-document.ts#L102) `mountInDocument(root: ShadowRoot)` builds nav imperatively (l.106), injects CSS, **no `registry.upgrade(root)`** |
| `CustomAttributeRegistry.upgrade(shadowRoot)` exists | ✓ confirmed — [fui:plugs/webbehaviors/CustomAttributeRegistry.ts:267](../../fui:plugs/webbehaviors/CustomAttributeRegistry.ts#L267) `upgrade(root: RootNode)`, `downgrade` at l.279; `RootNode = Document \| DocumentFragment \| ShadowRoot` |
| #931 regression guards exist | ✓ confirmed — unit [fui:DisclosureNav.test.ts:63](../../fui:blocks/__tests__/unit/disclosure-nav/DisclosureNav.test.ts#L63), [fui:SectionedNav.test.ts:45](../../fui:blocks/__tests__/unit/sectioned-nav/SectionedNav.test.ts#L45), integration [fui:chrome-in-document.test.ts:85](../../fui:embed/__tests__/chrome-in-document.test.ts#L85), e2e [fui:navigation.spec.ts:94](../../fui:plugs/__tests__/e2e/navigation.spec.ts#L94) |
| navigation intent: "coordinate with the unfinished intent→conformance gap, don't fake a tie" | ✓ confirmed the gap is real — [we:webtraits/intentProfileResolver.ts](../webtraits/intentProfileResolver.ts) is **build-time only** (trait inclusion/delivery); **no runtime conformance gate** exists. So "reconcile the intent" has nothing real to bind to. |

**Net:** six of the seven body slices are groundable to real `file:line` seams. The seventh (intent
reconcile) buries an open question the body itself flags — it goes to *could-not-split*.

## Could split — #934 → 6 slices

| # | Slice | workItem / size | blockedBy | Batchable now |
|---|-------|-----------------|-----------|---------------|
| **A** | **Shadow-scope `nav:section`** — `controlledElement` lookup `document.querySelector` → `this.target.getRootNode()`-scoped ([fui:NavSectionBehavior.ts:47](../../fui:blocks/navigation/NavSectionBehavior.ts#L47)); confirm `nav:list` already scoped (it is). Precondition: without it the trait is inert in a mode-C mount. | task | — | ✅ |
| **B** | **Build the horizontal-menu coordinator trait** — new webbehaviors trait capturing what nav:section/nav:list lack: sibling-exclusive open, outside click/focus dismiss, responsive desktop-only gating, Escape→collapse+refocus (the [wireDisclosure](../../fui:blocks/disclosure-nav/DisclosureNav.ts#L110) behaviors). Own unit test + demo fixture. | story · 5 | A | after A |
| **C** | **Boot the registry in the mode-C chrome path** — instantiate a lean shared-per-page `CustomAttributeRegistry` (#932 lifecycle ruling), register chrome traits, `upgrade(root)` on mount / `downgrade` on teardown in [fui:chrome-in-document.ts:102](../../fui:embed/chrome-in-document.ts#L102). Inert no-op until trait DOM lands (valid state). | story · 2 | — | ✅ |
| **D** | **Rebuild `disclosure-nav` as a trait-composing template** — emit `<button nav:section=…>` + coordinator-trait markup + keep the presentational horizontal/responsive CSS; delete `wireDisclosure()` ([fui:DisclosureNav.ts:110-163](../../fui:blocks/disclosure-nav/DisclosureNav.ts#L110)). Behavior now flows through the registry. | story · 3 | A, B, C | after A+B+C |
| **E** | **Rebuild `sectioned-nav` as a trait-composing template** — retire the hand-rolled per-section toggle ([fui:SectionedNav.ts:56-91](../../fui:blocks/sectioned-nav/SectionedNav.ts#L56)) onto `nav:section` (no coordinator — vertical accordion has no sibling-exclusivity). | story · 2 | A, C | after A+C |
| **F** | **Update the #931 regression guards** — assert trait composition (`nav:section` present + registry upgraded), not just collapsed-by-default DOM, across the 4 test files above; keep the Playwright behavior checks (open/Escape/outside-click). | task | D, E | after D+E |

### Slice DAG

```
A (shadow-scope nav:section) ─┬─→ B (coordinator trait) ─┐
                              │                          ├─→ D (rebuild disclosure-nav) ─┐
C (boot registry) ────────────┼──────────────────────────┘                              ├─→ F (guards)
                              └─→ E (rebuild sectioned-nav) ───────────────────────────┘
```

- **Two independent roots** — **A** and **C** proceed in parallel (rubric 4 ✓).
- **Incremental delivery:** A is a standalone trait bugfix; C boots an inert-but-valid registry; B
  ships a tested standalone trait; D/E each flip one block from hand-rolled to composed (each leaves
  the chrome working); F hardens the guards. Every slice leaves a valid, demoable state (rubric 5 ✓).
- **Batchable now:** A, C (the two roots). B batches after A; E after A+C; D after A+B+C; F after D+E.

### Rubric check (all five hold for the 6 slices)

1. **Volume, not uncertainty** ✓ — #932 settled the boot/compose/lifecycle forks; no slice re-decides
   a seam. (The one slice that *would* bury a fork — intent reconcile — is excluded below.)
2. **≥2 nameable slices, real home** ✓ — 6 slices, each a FUI block/trait/embed/test file cited above.
3. **Slices land ≤5 / task** ✓ — task/5/2/3/2/task; B (the coordinator trait) is the only `5` and is
   atomic (splitting its 4 behaviors leaves a half-trait → rubric 5).
4. **Clean acyclic DAG, ≥2 independent** ✓ — A and C are parallel roots; incremental delivery besides.
5. **No coherence loss; each demoable** ✓ — see incremental-delivery note; the DAG ordering (D needs
   A+B+C) is exactly what prevents a "dead chrome nav" intermediate.

## Could not split — slice (g) navigation-intent reconcile

| #NNN | Slice | Failed condition | Unblocking action |
|---|---|---|---|
| #934 (g) | Reconcile the `navigation` intent — declare/compose it meaningfully | **(1) buries a fork + (3) un-groundable** — WE's intent→conformance is build-time only ([we:intentProfileResolver.ts](../webtraits/intentProfileResolver.ts)); **no runtime conformance gate exists**, so "compose the intent meaningfully" either fakes a tie (forbidden by the body's own note) or silently expands into *building a runtime intent-conformance gate* (a separate epic). No real code to cite a seam against. | File a parked `type:decision` card: *"what does navigation-intent reconciliation mean without a runtime conformance gate — build the gate, or rule intent-reconcile out of #934's scope?"* ([[feedback_decisions_are_workitems_not_plan_mode]]). **#934's `Done when` does not require it** — it's cleanly droppable from the epic, so the 6 slices above fully deliver the epic without it. |

## Net

**#934 splits into 6 batchable slices (A–F); slice (g) is could-not-split** and should become its own
parked decision card rather than a buried fork in the epic body. Confidence ~85% on the A–F seams (all
file:line-grounded); the residual is slice B's exact size (5 if the coordinator needs a new behavior
class; could land 3 if it extends nav:section) and whether sectioned-nav (E) shares the chrome's
registry or mounts elsewhere (it currently isn't in `fui:chrome-in-document.ts`, so E's registry boot may
need its own small wiring — noted, not buried).

---

# Focused run: `/split 725` — port WE-only plug domains into FUI

## Candidate

**#725** — *Port WE-only plug domains (webguards, webvalidation) + their subsystems into Frontier UI* ·
`workItem: story` · `size: 13` · `parent: "170"` · `locus: frontierui` ·
`blockedBy: [649, 730, 814, 817, 893]` (**all five resolved**) · `status: open`.

Re-sized 8→13 in batch-2026-06-18 with an explicit "ideally `/slice`d into the contract-split (WE-side)
and the impl-port (FUI-side)" note. This pass traced the real closure before drawing seams — and the
body's framing is now **stale**: the contract-split already landed in the blockers, so the residual is
a single-direction FUI-side port that splits along a different (and cleaner) seam.

## Work-investigation pass (read the real tree, both repos)

| Body's framing | What the tree actually shows |
|---|---|
| #725 must "modify WE standard files" (split `we:validation-generation/service.ts`, move `crossField`/`adapters/*`/`serviceHandler`) | **Already done by #814/#893.** `@webeverything/contracts/{guard,validity-merge,validator-resolution}` ([we:contracts/package.json](../contracts/package.json)) + `@webeverything/validation-generation/*` (curated subpaths — `crossField`/`adapters/*`/`serviceHandler` excluded by omission, [we:validation-generation/package.json](../validation-generation/package.json)) + `@webeverything/capability-manifest` all exist; `we:validation-generation/service.ts` already split (wire types only). The WE-side carve is **complete**. |
| The port still touches WE (high cross-repo blast radius) | **No WE deletion in #725.** The only WE-internal consumers of the runtime halves are the WE plugs themselves (`plugs/webguards/*`, `plugs/webvalidation/*`) + `validation-generation`'s own wiring (grep). Deleting the WE copies is **#449's** job (the vendor-delete #725 gates). #725 is **purely additive on the FUI side**. |
| Closure is one ~3,400-LOC lump | **Splits along the two plug domains — disjoint file sets.** `webguards → guard/` only (4 runtime files + `plugs/webguards/` 2 = 6); `webvalidation → validity-merge/ + validator-resolution/ + validation-generation/ + capability-manifest/` (18 runtime files + `plugs/webvalidation/` 6 = 24). The two share no source. |
| — | **FUI aliases already wired** ([fui:vite.config.mts:212-230](../../fui:vite.config.mts#L212-L230)); FUI has a `plugs/` dir but **neither** `webguards` nor `webvalidation`, and lacks all five runtime subsystem dirs. So the port is a clean additive copy + the alias wiring already exists. |
| — | **The validation domain is atomic.** `we:validation-generation/provider.ts` imports `validity-merge/provider` + `validator-resolution/provider` ([we:validation-generation/provider.ts](../validation-generation/provider.ts)) and `we:plugs/webvalidation/index.ts` consumes all four subsystems — splitting inside it leaves a half-wired, non-demoable plug (rubric 5). So validation stays one slice. |

## Could split — #725 → 3 slices

**Edge case (parent exists):** #725 already sets `parent: 170`, so per *Executing a split* it is **not**
converted to a nested epic. It stays a `story`, re-sized `13 → 5`, scope narrowed to its **core slice**
(the `webvalidation` domain — the bulk: 4 of 5 subsystems, 24 files); the other two become **siblings
under #170**. (`#170` is the plugs-runtime dedup epic — correct scope here, unlike the #904 run above.)

| Slice | What it ports into FUI | Home | `workItem`/`size` | blockedBy |
|---|---|---|---|---|
| **#725** (kept, re-scoped) — `webvalidation` domain | runtime halves of `validity-merge/`, `validator-resolution/`, `validation-generation/` (incl. `crossField`/`adapters/*`/`serviceHandler`), `capability-manifest` consumption + `plugs/webvalidation/*` + bootstrap; wired via `@webeverything/{contracts/{validity-merge,validator-resolution},validation-generation/*,capability-manifest}`; FUI build + vitest green | `fui:` (new `validity-merge/`,`validator-resolution/`,`validation-generation/` dirs + `plugs/webvalidation/`) | `story·5` | — |
| **(new sibling)** — `webguards` domain | `guard/{provider,registry,index,accessControl}` + `plugs/webguards/*` + bootstrap; wired via `@webeverything/contracts/guard`; FUI build + vitest green | `fui:` (new `guard/` dir + `plugs/webguards/`) | `story·3` | — |
| **(new sibling)** — dual-mode test backfill + #636 gate flip | author webguards+webvalidation **unplugged+plugged** test suites in FUI (hand-off from #637); flip `PLUG_UNPLUGGED_TEST_ENFORCED=true` (#636) | `fui:plugs/__tests__/` + gate | `task` | #725, webguards sibling |

### Slice DAG

```
#725 (webvalidation port) ──┐
                            ├─→ dual-mode test backfill + #636 flip
webguards port ─────────────┘
```

Two independent roots — **#725** and **webguards port** — proceed in parallel (disjoint files); the
test-backfill (which flips the #636 gate, the last gate-promotion the whole #170 chain waits on) hangs
off both.

### Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — #730/#817 placement forks all resolved; the body confirms "Blockers
   all resolved." No buried decision in any slice.
2. **≥2 nameable slices, real home** ✓ — webvalidation (story, #725 retained), webguards (story),
   test-backfill (task). Each file-grounded above.
3. **Slices land ≤5 / task** ✓ — 5 / 3 / task. The heaviest (webvalidation·5) is atomic — can't go
   lower without a half-wired state — and is mechanical copy + alias-rewire over a pre-existing contract
   surface (the pattern #637 already proved on the other four domains).
4. **Clean acyclic DAG, ≥2 independent** ✓ — webguards ∥ webvalidation (disjoint files); test-backfill
   delivers incrementally after both.
5. **No coherence loss; each demoable** ✓ — each port leaves FUI with a working plug; WE stays valid
   throughout (additive only); the backfill hardens coverage + flips the gate.

## Could not split

None — #725 splits cleanly.

## Net

**#725 splits into 3 slices** (`+2` items): #725 re-sized `13 → 5` as the webvalidation port (stays a
story under #170, **not** converted to an epic — it has a parent), plus a `webguards`-port `story·3`
and a dual-mode-test-backfill `task`, both siblings under #170. Confidence ~85%; the residual is
whether webvalidation·5 holds or creeps toward 8 once the 24-file copy + cross-import rewire is underway
(it's mechanical and the alias surface pre-exists, so 5 is the honest estimate). The `webguards` root +
re-scoped #725 are batchable immediately.

---

# Focused run (2nd pass): `/split 725` — the webvalidation-only residual, post 5→13 re-size

> The first `/split 725` section above split the *original* #725 ("webguards **+** webvalidation +
> subsystems") into three: `webguards` port (#950, story·3), dual-mode test backfill (#951, task), and
> #725 re-scoped to **webvalidation-only** and re-sized 13 → 5. A later pre-flight (commit `378fb61`)
> re-sized that residual **5 → 13** on finding it's a ~22-file #170-class migration, dropping it from the
> batch pool. This pass asks: can the **webvalidation-only residual** itself be sliced further?

## Candidate

**#725** — *Port the `webvalidation` plug domain + its subsystems into Frontier UI* · `story · 13` ·
`status: open` · `parent: 170` · `locus: frontierui`. Blockers (#649/#730/#814/#817/#893) **all
resolved**; no open fork remains.

## Work-investigation pass (read the real tree, both repos)

The residual is now a **single-repo, purely-additive FUI port** — the WE-side contract carve already
landed and is verified on disk:

- WE contract files exist (`contracts/{validity-merge,validator-resolution,guard}.ts`, dated Jun 17) and
  the placement forks that produced them are all resolved: **#730/#814/#817/#893** (each story·3,
  `resolved`). So #725 **no longer touches WE standard files** — the "two-repo blast radius" that
  justified the 5→13 bump is largely stale; the top digest itself says "**Purely additive on the FUI
  side**."
- FUI already carries the `@webeverything/*` vite aliases for the contract surface
  ([fui:vite.config.mts:212-230](../../fui:vite.config.mts#L212)): `capability-manifest` whole
  plane + `validation-generation/{provider,registry,fieldError,cel,service}` + `contracts/{validity-merge,
  validator-resolution,guard}`. The impl halves (`crossField`, `adapters/*`, `serviceHandler`) are the
  ones that port DOWN.
- FUI carries **none** of `validity-merge/`, `validator-resolution/`, `validation-generation/`,
  `plugs/webvalidation/` yet — confirmed absent. Genuinely additive.

The import closure, traced from the plug sources (not the body):

- The whole domain hangs off **one barrel**, [we:plugs/webvalidation/index.ts](../plugs/webvalidation/index.ts),
  which re-exports from **all** subsystems at once: `validator-resolution/{provider,registry}`
  (`:34`,`:40`), `validity-merge/{provider,registry}` (`:52`,`:57`), `capability-manifest/provider`
  (`:82`) + `/guard` (`:173`), and `validation-generation/{provider,cel,crossField,registry,fieldError,
  adapters,service,serviceHandler}` (`:107`–`:167`).
- The five plug files under `plugs/webvalidation/` (751 LOC) each import the strategy planes:
  `CustomValidityMergeRegistry`/`ValidityMergeField`/`applyMergedValidity` → `validity-merge/{provider,
  registry}`; `CustomValidatorResolutionRegistry`/`AsyncValidatorField` → `validator-resolution/*`.
- Subsystem impl volume to port: `validity-merge` impl (~250 LOC), `validator-resolution` impl (~250),
  `validation-generation` impl-half `crossField`+`adapters/*`+`serviceHandler` (743 LOC), the 6
  `plugs/webvalidation/*` files (751 LOC), + bootstrap wiring. ≈ 22 files.

## Verdict — could NOT split (the residual is atomic)

The earlier pass already extracted **everything cleanly extractable** from the original #725 — the
disjoint `webguards` domain (#950) and the cross-cutting test backfill (#951). What remains is **one
coherent plug-domain port** that does not decompose further without quality loss:

| Tried seam | Why it fails the rubric |
|---|---|
| One slice **per subsystem** (validity-merge ∥ validator-resolution ∥ validation-generation) | Each ported subsystem alone is a **registry with no consumer** until the plug barrel wires it → **rubric 5 fail** (no valid/demoable state — DoD needs a fixture-demo, and the plug is the only consumer). And FUI gains nothing usable from a lone strategy plane → **rubric 4 fail** (no real independence, no incremental delivery). |
| Split the barrel: **form-validity runtime** (validity-merge + validator-resolution + their 5 plug files) vs **validation-generation + capability-manifest** consumption | The two halves share **one file** — `we:plugs/webvalidation/index.ts` re-exports both at `:34-57` and `:107-173`. Landing it half-built leaves the `webvalidation` plug in a partial-export state whose dual-mode test (exercises the full barrel) can't pass → **rubric 5 fail**; and both slices edit the same index → not independent (**rubric 4**). Truly separating them means **splitting `webvalidation` into two plug domains** — a plug-taxonomy **design fork**, which is *not* a mechanical slice → **rubric 1 fail** (can't split away a decision). |
| Port files (slice 1) then wire bootstrap (slice 2) | Files without wiring = dead code; bootstrap-only without files = nothing to wire. Same single-deliverable, no demoable intermediate → **rubric 5 fail**. |

**Precedent confirms atomicity:** the sibling `webguards` port (**#950**) handles the analogous "port the
whole plug domain + its runtime subsystem in one focused pass" as a single `story·3`. #725 is the same
shape with 3-4× the subsystems — so it's a *bigger* single story, not a *splittable* one.

**Unblocking action for a future split:** none worth taking. The only seam left (the
form-validity-runtime ÷ validation-generation cut) is unlocked **only** by a decision to split the
`webvalidation` plug into two plug domains — almost certainly not worth the taxonomy churn. Work #725 as
the **focused single-item session** its own body already prescribes.

**Sizing observation (not a split, flagged for the next claim):** the 5→13 bump leaned on "modifies WE
standard files / two-repo blast radius," but that contract carve has since landed (#814/#893/#817/#730 all
`resolved`), leaving #725 single-repo and purely additive over a pre-existing alias surface. ≈22 files of
mechanical copy + import-rewire is an honest **`story · 8`**, not `13`. A re-size 13 → 8 is defensible at
claim time (it would also make #725 batch-eligible again) — but that's a sizing call, outside this skill's
split mandate, so left untouched here.

## Net

**No split.** The webvalidation residual is atomic; the prior pass already harvested the two real seams
(#950, #951). Confidence **~85%** the residual won't sub-slice safely; the residual uncertainty is the
one taxonomy fork (split `webvalidation` into two plugs) I judged not worth opening. Zero backlog
mutation.

---

## Candidate

**#940** — *Rich-text-editor library engine adapters (ProseMirror/Lexical/Slate/Quill) — #923 deferred
slice* · `workItem: story` · `size: 13` · `locus: frontierui` · `blockedBy: ["923"]` · `status: open`.

#923 is **resolved** (graduatedTo `fui:blocks/rich-text-editor/RichTextEditorElement.ts`), so the blocker
is satisfied and the work is investigable now.

### Work-investigation pass — the real surface

The swappable seam #923 shipped is clean and engine-agnostic:

- `CustomEditorEngine { name; attach(ctx) → EditorEngineHandle }` and `EditorEngineHandle
  { getValue, setValue, format, destroy }` — `fui:blocks/rich-text-editor/editorEngine.ts:34` /
  `:22`. **The portable pivot is HTML** (`getValue()` returns `host.innerHTML`, `fui:editorEngine.ts:73`).
- A registry, `CustomEditorEngineRegistry` (`fui:editorEngine.ts:103`), pre-seeded with the native engine as
  default (`customEditorEngine`, `fui:editorEngine.ts:124`). Engine selection is the `engine=""` attribute on
  the element (`fui:RichTextEditorElement.ts:51`, `:77`); an unknown engine falls back to the default (`:78`).
- The native floor: `NativeContentEditableEngine` (`fui:editorEngine.ts:47`) — contenteditable + InputEvent +
  sanitize-on-paste. Dependency-free.

**Precedent for a single-library engine adapter** (#935 XState, in the parallel `workflow-engine` block):
`fui:blocks/workflow-engine/xstateAdapter.ts` (pure data transform, no library import) +
`fui:xstateRuntime.ts` (drives the real library) + `fui:blocks/workflow-engine/__tests__/xstateRuntime.test.ts`, with `xstate` declared
as an **optional peerDep + devDep** (`fui:package.json:31-37`, `:53`). Each rich-text engine adapter
mirrors this exactly: a new file implementing `CustomEditorEngine`, the library as an optional peer/dev
dep, a unit test.

**No editor demo exists yet** — neither `we:demos/*rich*|*editor*` nor `fui:demos/` has a rich-text page;
#923 graduated to the element + unit tests only. The body itself mandates a **Playwright e2e on the editor
demo** per engine (happy-dom can't do real selection/range/layout). So a demo page + e2e harness is a
genuine **shared fixture** the engine slices depend on — not optional polish.

So the split is **volume, not uncertainty** for three of the four libraries (each is an independent
`CustomEditorEngine` file behind the same seam, mapping the library doc-model ↔ HTML). The **Slate**
library carries a real buried fork (React) → that slice is could-not-split pending its own decision.

### Could split — #940 → storied epic

| Slice | size / type | Scope (named files, all `file:line`-cited above) | blockedBy | Batchable |
|---|---|---|---|---|
| **demo + Playwright e2e harness** (foundational shared fixture) | `task·2` | New FUI demo page exercising `<rich-text-editor>` with an `engine=""` switcher + a Playwright spec verifying real contenteditable selection/format on the native engine. The fixture every engine slice extends. | — | ✅ |
| **`quill` adapter** | `story·3` | `fui:blocks/rich-text-editor/engines/quill.ts` impl of `CustomEditorEngine` (HTML via `getSemanticHTML()` / `dangerouslyPasteHTML`); register on `customEditorEngine`; `quill` optional peerDep+devDep; unit test + add engine to demo switcher + e2e. Most self-contained (one package). | demo slice | ✅ |
| **`lexical` adapter** | `story·5` | `fui:blocks/rich-text-editor/engines/lexical.ts`; headless `createEditor` + `lexical`/`@lexical/html` (`$generateHtmlFromNodes` / `$generateNodesFromDOM`); optional deps; unit test + e2e. | demo slice | ✅ |
| **`prosemirror` adapter** | `story·5` | `fui:blocks/rich-text-editor/engines/prosemirror.ts`; schema + `DOMParser`/`DOMSerializer` from `prosemirror-model` (the multi-package one: model/state/view/schema-basic/keymap/commands as optional deps); unit test + e2e. | demo slice | ✅ |

**DAG:** demo-harness slice (unblocked) → `{ quill, lexical, prosemirror }` all proceed **in parallel**
once it lands. ≥2 independent (rubric 4 ✓). Each engine ships valid on its own (native floor + any other
registered engine keep working; new engine is opt-in via `engine=""`) → incremental delivery, no broken
intermediate state (rubric 5 ✓). Sizes re-estimated against the real surface (rubric 3 ✓).

### Could not split — the Slate slice (buried fork)

| Slice | Rubric condition failed | Unblocking action |
|---|---|---|
| **`slate` adapter** | **(1) Volume, not uncertainty** — Slate's editing surface is React-based (`slate-react`), so a Slate engine pulls **React** into FUI even as an optional dep. That's an unresolved design fork, not just more work — the same framework-runtime concern as the polyglot live-sandbox **#955 Fork B**. | **Resolve a new `type:decision` card** (Slate engine: React-optional-dep fork — options: headless `slate` core + non-React render / accept React-optional / drop Slate from the set), cross-referenced to #955. Once ratified, scaffold (or drop) the Slate build slice. Filed as its own card so the fork is de-buried from #940's body, per *Decisions Are Work Items*. |

### Proposed mutation (gated on "go")

- Convert **#940** `story` → **storied epic** (drop `size`, umbrella digest), keep `NNN` / `status:open`.
- Scaffold under `--parent=940`: **demo+e2e harness** (task·2, no blocker); **quill** (story·3),
  **lexical** (story·5), **prosemirror** (story·5) — each `--blocked-by=<demo NNN>`.
- Scaffold a **`type:decision` story·3** (Slate React fork), cross-referenced to #955; note in the epic
  body that the Slate build is deferred pending that decision.
- Numbers allocated at scaffold time (highest on disk = 958 → next free). Net flow: **+5 opened** (4
  build slices + 1 decision), #940 story → epic. Gate: `npm run check:standards`.

### Net

**Splittable.** Confidence **~85%** the quill/lexical/prosemirror seams are clean and independent
(grounded in the resolved #923 seam + the #935 XState precedent); residual is the demo-harness sizing
(task·2 may stretch if no FUI demo scaffold convention exists). The Slate slice is correctly *could-not-split*
pending the React fork — high confidence (~90%) that's a genuine decision, not just volume.

---

## #972 — Author and host FUI demos for the block families that have none (unsliced epic, kind b)

**Candidate kind:** unsliced epic (`workItem: epic`, 0 children, `parent: 970`, `blockedBy: 971`). Condition (1)
"size is volume not a fork" is settled at the parent level — the epic *is* the decision to decompose; each slice
must still satisfy (2)–(5) and bury no fork of its own.

### Work-investigation pass (real tree)

- `fui:src/_data/blocks.json` — **37** registered blocks; **11** carry `demoFile` (wired by #971), **26 do not**.
- `fui:src/block-pages.njk:42-43` — the per-block "Try it live" `<iframe src="/demos/{{ block.demoFile }}">`
  slot (resolved #971) renders **only when `demoFile` is present**. So each demo-less block today shows no slot.
- `fui:demos/` — the hosting surface (served `/demos/` on :3001); ~50 demo HTML/TS files + the `#813`
  `fui:demos/playground-harness.ts` pattern. None of the 26 demo-less blocks has a confirmed mapping (the ambiguous ones —
  view, type-ahead, app-shell, sectioned-nav, disclosure-nav, the bracket parsers — were deliberately left to #972
  by #971 rather than mis-wired, since a wrong iframe is a broken demo).

The 26 demo-less blocks fall into clean `category` (subsystem) clusters — exactly the "sub-slices per subsystem
cluster" the epic body anticipated. Because we **author a demo specifically for each block** (not match an existing
one), #971's wiring-ambiguity dissolves → no slice buries a fork (condition 1-within-slice ✓).

| category | demo-less blocks |
|---|---|
| webdocs | code-view, story-canvas, props-table |
| webworkflows | wizard, workflow-engine *(+ stepper, the webbehaviors multi-step sibling)* |
| webstates | draft-persistence, simple-store, audit-trail, lifecycle |
| webexpressions | handler-expression-parser, double-curly-bracket-parser, double-square-bracket-parser |
| webcomponents | transient-component, app-shell, button |
| webbehaviors | data-transfer, view, event-behaviors, master-detail, resource-loader, selection, stepper, tree-select, type-ahead, sectioned-nav, disclosure-nav |

### Could split — #972 stays an epic, 9 child slices

Each slice = author + host a runtime demo (`fui:demos/`, #813 real-element + playground-harness pattern) per block
in the cluster, then set `demoFile` on the `fui:src/_data/blocks.json` entry so #971's slot renders it.

| # | Slice | size / type | Blocks (demos authored) | blockedBy | Batchable |
|---|---|---|---|---|---|
| 1 | **webdocs demos** | `story·3` | code-view, story-canvas, props-table | — | ✅ |
| 2 | **workflow + stepping demos** | `story·3` | wizard, workflow-engine, stepper | — | ✅ |
| 3 | **webstates demos** | `story·5` | draft-persistence, simple-store, audit-trail, lifecycle | — | ✅ |
| 4 | **webexpressions parser demos** | `story·2` | handler-expression-parser, double-curly-bracket-parser, double-square-bracket-parser | — | ✅ |
| 5 | **webcomponents chrome demos** | `story·3` | transient-component, app-shell, button | — | ✅ |
| 6 | **droplist / selection family demos** | `story·3` | selection, tree-select, type-ahead | — | ✅ |
| 7 | **disclosure-nav demos** | `story·2` | sectioned-nav, disclosure-nav | — | ✅ |
| 8 | **view & event-behaviors demos** | `story·2` | view, event-behaviors | — | ✅ |
| 9 | **behavior-coordinator demos** | `story·3` | master-detail, resource-loader, data-transfer | — | ✅ |

**DAG:** all 9 slices depend only on the slot convention from **#971 (resolved)** — so they are mutually independent
and fully parallel (≥2 independent, rubric 4 ✓). Each slice authors complete, self-contained demos and wires them;
a finished slice immediately surfaces live demos on those block pages while the rest stay (validly) demo-less →
incremental delivery, no broken intermediate state (rubric 5 ✓). Sizes re-estimated against the real demo surface:
a single #813 demo ≈ `1–2`, so a 2-block cluster ≈ `2`, a 3-block ≈ `3`, a 4-block ≈ `5` (rubric 3 ✓; the #973
completeness gate stays out of #972 and only flips once every block carries `demoFile`).

### Could not split — none

No cluster buries an unresolved fork (authoring removes #971's matching ambiguity); no slice exceeds `size·5`; no
forced linear chain. All five conditions hold for every slice.

### Proposed mutation (gated on "go")

- **#972 stays an epic** (kind b — no story→epic conversion); confirm no residual `size` (it has none), keep `NNN`
  / `status:open`; refresh digest to umbrella framing.
- Scaffold **9 stories** `--parent=972` (no `--blocked-by` — #971 is resolved): sizes 3/3/5/2/3/3/2/2/2... per table.
- Numbers allocated at scaffold time (highest on disk → next free). Net flow: **+9 opened**, #972 epic left in place.
- Gate: `npm run check:standards` green + backlog count rises by 9.

### Net

**Splittable.** Confidence **~85%** — the per-subsystem seams are real and grounded in `fui:src/_data/blocks.json` + the existing
`demos/` surface; residual is per-cluster sizing (the webstates `·5` slice and any block whose demo needs a
non-trivial harness — e.g. the text-node parsers — may run hot). No buried forks; all 9 slices independently
batchable and demoable.

---

## `/slice 1002` — plugs test-coverage, spec-conformance & integration stress audit (unsliced epic, kind b)

**Candidate:** **#1002** — `workItem: epic` · `size: 13` · `status: open` · 0 children (no item names it as
`parent`) → **unsliced epic**. Condition (1) "size is volume not a fork" is settled at the parent level; each
slice must still satisfy (2)–(5) and bury no fork of its own. The body proposes two slicing axes (per-plug, or
per-dimension A/B/C + D-early) and names **webvalidation as the highest-priority first slice**, but says
explicitly: *"Slice when claimed — don't pre-decompose."*

### Work-investigation pass (read the real tree, both mirrors)

| Body's framing | What the tree actually shows |
|---|---|
| Snapshot measured "on the `frontierui` mirror"; WE mirror "needs its own measurement as part of workstream A" | ✓ **and the divergence is material.** WE `we:plugs/` already carries real tests the FUI snapshot doesn't reflect: e.g. **webvalidation has 6 WE unit test files** (`we:plugs/webvalidation/__tests__/`) but **0 in FUI** — the body's "0/0" is the FUI number. webguards: 2 WE / 1 FUI. So the per-plug WE gap is genuinely **unknown until the WE mirror is measured** — pre-cutting per-plug slices off the FUI snapshot would be cutting against a stale map. |
| e2e is "per-plug `we:plugs/__tests__/e2e/` specs", several plugs have none | ✓ confirmed — e2e lives in **one shared dir** `we:plugs/__tests__/e2e/` with per-plug-named specs. **No dedicated e2e** for: `webvalidation`, `webguards`, `webdirectives`, `webregistries`; `webexpressions` has only `we:plugs/__tests__/e2e/text-interpolation.spec.ts`. |
| webvalidation is 0/0 (highest priority) | ✓ in FUI (`fui:plugs/webvalidation` — src exists, **0 test files**); WE has unit but **no dedicated webvalidation e2e** in either mirror. Gap is **known without measurement** → safely cuttable now. |
| Workstream D — author `we:docs/agent/plugs-testing-strategy.md` | ✓ **does not exist** (confirmed absent). Foundational: it codifies the per-plug bar + integration invariants. |
| Workstream C — assert `Node.*` statics survive every patch; third-party DOM libs instantiate under full bootstrap (#960 class) | ✓ **no such test exists.** `grep` finds only `we:plugs/webcomponents/__tests__/unit/Node.cloneNode.patch.test.ts` (a different patch concern); no Node-statics-survival test, no third-party-lib-under-bootstrap test. Concrete and groundable now. |
| Both mirrors duplicated (#170/#649) | ✓ — the `plugs` dir exists in WE and FUI; coverage work lands in both (or rides the reconcile). |

**Net:** three pieces are **groundable now without the measurement** (D, webvalidation, the #960-class stress
harness); the **other ~9 per-plug coverage+e2e slices** are **not** — their precise scope (which mode is thin,
which e2e lane is missing, the exact bar) is unknown until **D's WE-mirror measurement** lands, and the FUI
snapshot is proven stale for the WE side. Cutting them now is the forbidden "slices straight from a (stale) body."

### Could split — #1002 → 3 slices now (+ deferred per-plug wave)

| # | Slice | workItem / size | Scope (named, file-grounded) | blockedBy | Batchable now |
|---|-------|-----------------|------------------------------|-----------|---------------|
| **D** | **Testing-strategy doc + WE-mirror coverage measurement** (foundational) | `story·3` | Author `we:docs/agent/plugs-testing-strategy.md` (unit happy-dom vs e2e real-browser layering · plugged-vs-unplugged per layer · per-plug coverage bar · patch-interaction invariants · new-plug checklist) **and** measure the WE `we:plugs/` per-plug coverage (both modes), producing the per-plug gap table the FUI snapshot lacks. This artifact defines the bar **and exposes the per-plug seams** for the deferred wave. | — | ✅ |
| **V** | **webvalidation to the bar — both mirrors** (the named first per-plug slice) | `story·3` | Add FUI `fui:plugs/webvalidation/__tests__/` unit suite (FUI is 0; mirror the 6 WE units), add a dedicated `we:plugs/__tests__/e2e/webvalidation.spec.ts` (absent in both mirrors) exercising the plugged `<validity-merge-field>`/`<async-validator-field>` through `we:plugs/bootstrap.ts`, and plugged↔unplugged parity. Files: `we:plugs/webvalidation/` (index, CustomValidityMergeRegistry, ValidityMergeField, CustomValidatorResolutionRegistry, AsyncValidatorField, applyMergedValidity). | — | ✅ |
| **C** | **Patch-interaction stress harness (#960 class)** — cross-cutting | `story·3` | New integration suite asserting global invariants survive the **full plugged bootstrap**: `Node.*` static constants (`TEXT_NODE`/`ELEMENT_NODE`/…) intact after every patch (the exact #960 regression); a third-party DOM lib (Parchment/Quill-class) still instantiates under `we:plugs/bootstrap.ts`; plugged↔unplugged parity where behavior must be identical. One coherent cross-plug slice (not per-plug). | — | ✅ |

**DAG — three independent parallel roots, no edges:**

```
D (strategy doc + WE measurement) ──┐
V (webvalidation, both mirrors) ─────┤   (all three independent, batchable now)
C (#960-class stress harness) ───────┘
            │
            └── D's measurement artifact ──→ [deferred] re-/slice the remaining ~9 per-plug
                                              coverage+e2e slices against MEASURED gaps
```

- **Three independent roots** (rubric 4 ✓✓ — strong parallelism, not a forced chain). V and C are deliberately
  **not** blocked on D: webvalidation FUI=0 and the #960 invariants are both unambiguous without the bar; their
  digests note "align to the bar D codifies" so a stricter bar is light follow-up, not rework that gates them.
- **Each leaves a valid, demoable state** (rubric 5 ✓): D ships a reference doc + a measured table; V ships a
  green webvalidation suite (unit+e2e, both modes); C ships a passing stress harness that would have caught #960.
- **Sizes** (rubric 3 ✓): each `≤3`, named files `file:line`-citable above; no buried fork in any of the three.

### Could not split (yet) — the remaining per-plug coverage+e2e wave

| Scope | Failed condition | Unblocking action |
|---|---|---|
| The other **~9 per-plug slices** (webcomponents, webexpressions, webinjectors, webcontexts, webstates, webbehaviors, webguards, webregistries, webdirectives, core) — coverage-to-bar + missing dedicated e2e per domain | **(3) investigation-depth** — precise per-plug scope (which mode is thin, which e2e lane is missing, the exact bar) is **unknown until D's WE-mirror measurement lands**; the FUI snapshot is proven stale for the WE side (webvalidation 6 WE vs body's "0"). Cutting now = guessing seams from a stale map. | **Land slice D first** — its measured per-plug gap table exposes the real seams; then **re-run `/slice 1002`** to cut the per-plug wave against measured gaps. This is exactly the epic body's own directive ("WE mirror needs its own measurement"; "slice when claimed — don't pre-decompose"). webguards additionally coordinates with the #725/#950 WE→FUI port (avoid double-build) — a second reason to defer it. |

This is a deliberate **partial split**: harvest the 3 cleanly-groundable slices now (a foundational measurement
root that unblocks the rest, the named priority slice, and the cross-cutting stress harness), and leave the
volume-but-unmeasured per-plug wave to a measured re-slice rather than manufacture 9 stale hypothesis cards.

### Proposed mutation (gated on "go")

- **#1002 stays an epic** (kind b — no story→epic conversion); it carries no residual `size` to drop *(note: it
  currently has `size: 13`; an epic with sized children errors `check:standards`, so this **must** be removed on
  scaffold)*; refresh digest to umbrella framing; keep `NNN` / `status:open`.
- Scaffold **3 stories** `--parent=1002`, **no `--blocked-by`** (three independent roots): D `story·3`, V `story·3`,
  C `story·3`. Numbers allocated at scaffold time (highest on disk = 1007 → next free 1008+).
- **Net flow: +3 opened**, #1002 left an epic. Gate: `npm run check:standards` green + backlog count rises by 3.
- The deferred per-plug wave is **not** scaffolded now — it re-slices after D lands.

### Net

**Partial split — 3 slices now, the per-plug wave deferred behind the measurement.** Confidence **~85%** the
three cut seams are clean and independent (D/V/C all file:line-grounded, the WE/FUI divergence + missing-e2e +
absent-#960-test all confirmed on disk). Residual: whether V should soft-block on D (judged not — FUI=0 is
unambiguous) and the exact per-plug count the measurement will expose (the deferred wave is ~9–11, re-sliced
against real numbers, not guessed here).

---

## `/slice 1003` — Web Analytics: CustomTracker contract + reference adapter ecosystem (unsliced epic, kind b)

**Candidate:** **#1003** — `workItem: epic` · `status: open` · `relatedProject: webanalytics` · 0 children (no
item names it as `parent`) → **unsliced epic**. Condition (1) "size is volume not a fork" is settled at the
parent level (the epic body confirms *"no design decision is outstanding — this is a pure build"*); each slice
must still satisfy (2)–(5) and bury no fork of its own. The body anticipates **4 slices** (contract · reference
adapters · composition seams · conformance demo); this pass verifies each against the real tree.

### Work-investigation pass (read the real tree, both repos)

| Body's framing | What the tree actually shows |
|---|---|
| Vocabulary fixed; `CustomTracker` shape documented | ✓ — `we:src/_data/analytics.json` carries `events` + `tracker` entries; `tracker` already lists `identify/track/page/`**`group`** (the B2B superset). `we:src/_includes/project-webanalytics.njk` fixes the Segment Spec vocabulary; the `analytics-vocabulary` protocol is registered (`we:src/_data/protocols.json`, `ownedByProject: webanalytics`). |
| Minor shape inconsistency | The spec njk `AnalyticsBackend` omits `group()` and orders `page(category?, name?, …)`; `we:src/_data/analytics.json` `CustomTracker` includes `group()` and orders `page(name?, category?, …)`. **Canonicalization, not a fork** — the body already settled it (*"group() is the superset… one canonical contract"*); align `page()` arg order to Segment's actual analytics SDK (`page([category],[name],[properties])`). |
| Zero impl confirmed | ✓ — no `analytics`/`CustomTracker`/`AnalyticsBackend` under `plugs/` or `blocks/` in either repo. Greenfield build. |
| Canonical plug layout to model | The **`guard/`** domain is the exact precedent: type-only contract `we:guard/contract.ts:1-76` (compile-erased, the `@webeverything/contracts/guard` half) + runtime `we:guard/provider.ts` (native-first default, → FUI) + swap registry `we:guard/registry.ts` + wiring `we:guard/index.ts`; the swappable registry pattern is `we:plugs/webguards/CustomGuardRegistry.ts:41-62` (`define`/`resolve(key?)` with a default key). DI resolution: `Injector.consume(name, importMeta)` walks the provider chain (`we:plugs/webinjectors/Injector.ts`), keyed off `ProviderTypeMap` (`we:plugs/webinjectors/InjectorRoot.ts:48-58`). |
| Demo surface | Demos are an HTML/TS/CSS triplet under `demos/` + a `we:src/_data/demos.json` entry (e.g. `demos/data-table-demo.*`); the dev-server serves `/demos/` on :3000. A conformance demo swapping the resolved backend is groundable here. |
| **Composition seams (Web Traces / Web Events)** | ✗ **no surface to integrate against.** `we:src/_includes/project-webtraces.njk` and `we:src/_includes/project-webevents.njk` are **spec-only njk** — there is **no `plugs/webtraces`, no `plugs/webevents`** runtime impl (confirmed absent in both repos). "Trace-ID correlation" / "subscribe to typed events" has nothing real to bind to. |

**Net:** three of the four body slices are groundable now (the contract+registry+default foundation, the vendor
reference adapters, the conformance demo). The **composition-seams** slice is **could-not-split** — its two
dependencies (webtraces, webevents) are spec-only with no runtime impl, so the work can't be investigated to a
citable seam (work-investigation condition 3). It is also **not on the graduation gate** — the epic graduates
webanalytics `draft → poc/active` *"once a reference adapter ships,"* i.e. on slices A+B+D — so dropping the
composition slice from this split costs nothing.

### Could split — #1003 → 3 slices now (+ deferred composition seam)

| # | Slice | workItem / size | locus | Scope (named, file-grounded) | blockedBy | Batchable now |
|---|-------|-----------------|-------|------------------------------|-----------|---------------|
| **A** | **Canonical `CustomTracker` contract + registry + DI + no-op default + conformance vector** (foundational) | `story·3` | webeverything | Following the `guard/` precedent: a type-only contract module (modeled on `we:guard/contract.ts`) for `CustomTracker`/`CustomAnalyticsEvent`/`CustomAnalyticsOptions` (identify/track/page/group, `page()` aligned to Segment) → the `@webeverything/contracts` half; `CustomTrackerRegistry` mirroring `we:plugs/webguards/CustomGuardRegistry.ts:41-62` (`define`/`resolve(key?)`); add `customTrackers` to `ProviderTypeMap` (`we:plugs/webinjectors/InjectorRoot.ts:48-58`); a runtime **no-op/self-hosted default** provider (the native-first floor, like `we:guard/provider.ts`) + a conformance vector asserting identify/track/page/group route through the resolved backend. Leaves a demoable state (default adapter + green vector), **not** a registry with no consumer. | — | ✅ |
| **B** | **Reference vendor adapters** (FUI impl) | `story·3` | frontierui | `AnalyticsBackend`/`CustomTracker` impls resolving through the injector — **Segment** (near-verbatim; the contract *is* the Segment analytics SDK shape), **Mixpanel**, **GA4** (each maps identify/track/page/group → the vendor SDK; vendor SDKs are optional peer/dev deps, the #935 XState-adapter pattern). Per WE=contracts the vendor wrappers are impl → FUI; only the contract crosses the seam. | A | after A |
| **D** | **Conformance demo** (swap-the-backend) | `story·3` | webeverything | `demos/analytics-conformance-demo.{html,ts,css}` + `we:src/_data/demos.json` entry: **one call site**, swap the resolved backend via the registry, assert the same `track()`/`identify()`/`page()` calls route to each backend — using in-demo **recording stub** adapters (honest for a browser demo: real GA4/Mixpanel need network + credentials). Proves the contract+injector swap mechanic, the core conformance claim. | A | after A |

**DAG — one foundation, two independent leaves:**

```
A (contract + registry + DI + default + vector) ──┬─→ B (vendor reference adapters, FUI)
                                                   └─→ D (conformance demo, recording stubs)

[deferred] composition seams (Web Traces ID-correlation + Web Events subscription)
           ── blocked on unbuilt plugs/webtraces + plugs/webevents impl
```

- **B and D proceed independently** once A lands (rubric 4 ✓ — ≥2 parallel, not a forced chain). D uses in-demo
  recording stubs so it needs only the contract+registry (A), **not** the real vendor adapters (B) — deliberately
  decoupled.
- **Incremental delivery / every slice demoable** (rubric 5 ✓): A ships the contract + a working no-op default +
  a green vector (valid standalone); B ships swappable real adapters with their own tests; D ships a live-browser
  swap demo. No partial-protocol intermediate.
- **Sizes** (rubric 3 ✓): each `≤3`, named files `file:line`-citable via the `guard/` precedent; no buried fork
  (the body settled `group()`-superset + Segment vocabulary; `page()` arg order is a mechanical canonicalization).

### Could not split (yet) — the composition-seams slice

| Scope | Failed condition | Unblocking action |
|---|---|---|
| **Composition seams** — Trace-ID correlation with Web Traces + optional Web Events subscription (adapters instrument off typed events instead of sprinkled `track()`) | **(3) investigation-depth** — `webtraces` and `webevents` are **spec-only njk** (`we:src/_includes/project-webtraces.njk`/`we:src/_includes/project-webevents.njk`); **no `plugs/webtraces`, no `plugs/webevents`** runtime impl exists to correlate trace-IDs against or subscribe to. No code to cite a seam against → proposing it now is "slices straight from the body." | **Land the webtraces + webevents plug impls first** — their runtime surfaces then expose the real correlation/subscription seams; **re-run `/slice 1003`** (or file the composition work as a follow-up `story` `blockedBy` those two) once they exist. **Not on #1003's graduation gate** (graduates on a reference adapter shipping = A+B+D), so it is cleanly droppable from this split. |

This is a deliberate **partial split**: harvest the 3 groundable slices that carry webanalytics to graduation
now, and defer the composition seam behind its genuinely-unbuilt dependencies rather than manufacture a
hypothesis card the batch would choke on.

### Proposed mutation (gated on "go")

- **#1003 stays an epic** (kind b — no story→epic conversion); it carries **no `size`** (confirmed — nothing to
  drop); refresh digest to umbrella framing; keep `NNN` / `status:open`.
- Scaffold **3 stories** `--parent=1003`: **A** `story·3` (no blocker, `locus: webeverything`); **B** `story·3`
  (`--blocked-by=<A>`, `locus: frontierui`); **D** `story·3` (`--blocked-by=<A>`, `locus: webeverything`).
  Numbers allocated at scaffold time (highest on disk = 1003 → next free 1004+).
- **Net flow: +3 opened**, #1003 left an epic. Gate: `npm run check:standards` green + backlog count rises by 3.
- The composition-seams slice is **not** scaffolded now — it re-slices once webtraces/webevents ship impl.

### Net

**Partial split — 3 slices now (A foundation → B adapters ∥ D demo), composition seam deferred.** Confidence
**~85%** the three seams are clean and independent (all grounded in the `guard/` contract+registry+default
precedent + the #935 optional-dep adapter pattern; zero impl confirmed). The composition deferral is high
confidence (~90%) — its webtraces/webevents dependencies are demonstrably spec-only with no runtime impl, and
it sits off the graduation gate.

---

# Focused run: `/slice 1008` — triage roadmap for the 12 designed-not-built standards

## Candidate

**#1008** — *Triage roadmap — implement the 12 designed-not-built standards (concept-to-built gap)* ·
`type: idea` · `workItem: epic` · `status: open` · no `size` · **no `parent`** · surfaced by #998
(parent #991). **Unsliced epic (kind b)** — no child names it as `parent` (confirmed by grep). Its body
enumerates **12 standards** that each have a *resolved design + written spec but zero impl and no owner*,
and explicitly states the carve strategy: "carving one per standard up front would just create 12
detail-less epics, so they're enumerated here and carved on demand (the materialization pattern: plan →
discrete homes → refine in place)."

## Work-investigation pass (read the real tree, both repos)

| Body's claim per row | What the tree actually shows |
|---|---|
| **9 rows are "pure build" / "impl epic"** (webreliability, webintl, webmanifests, webidentity, webnotifications, webrealtime, webprocess, webresources, webpolicy) | ✓ **zero impl surface** — `ls plugs/<x>` and `../frontierui/plugs/<x>` return nothing for all nine. Designed-not-built: there is **no code to cite a seam against**. |
| webpositioning "partial, not zero" — anchor-positioning built in FUI | ✓ confirmed — `fui:blocks/droplist/positioning/` exists (the native/js/resolve/types modules). Carve = *complete/surface the WE-side seam*, a reconciliation scope, not greenfield. |
| webreporting "partially built" — report-model has impl | report-model not located by a quick grep, but the body's point stands: its carve is *finish renderers + ingest/export adapters*, a reconciliation scope. |
| webtraces "design first" — mid-design under #992 | ✓ confirmed — `backlog/992-design-the-trace-replay-substrate-webtraces-webevents…` is the live design item; its **build epic is carved off #992's ruling, not from here** (the body says so). |

**Net:** every row is either (a) a *pure-build implementation epic* with **no impl surface to investigate**
(nine rows), (b) a *reconciliation/finish* epic against partial existing impl (webpositioning,
webreporting), or (c) *design-gated elsewhere* (webtraces → #992). **None is a size-≤3 task**, and the nine
greenfield rows can't be investigated to a `file:line` seam because the surface doesn't exist yet — drawing
slices now would be the forbidden "slice straight from the body" guess (investigation-pass condition 3).

> **Verdict revised (rule broadened, same session).** This run originally landed *could-not-split* by
> applying the leaf-only rubric (slices must be `≤3`/`task` + demoable) — the wrong rubric for a **roadmap
> / "epic of epics"** whose rows are each themselves implementation epics. The skill was broadened
> mid-session to recognise **sub-epic slices** (*backlog-workflow.md → Slice granularity* + rubric
> (3′)/(5′)): for a roadmap epic a slice **is** a sub-epic, carved one level down, each then a future
> `/slice` candidate. Under the corrected rubric #1008 is **could-split (partial)** — below.

## Verdict — could SPLIT (partial sub-epic split: 11 sub-epics now, webtraces deferred)

Each row evaluated as a candidate **child epic** (not a leaf task), under the sub-epic rubric:

| Rubric (sub-epic form) | Verdict |
|---|---|
| (1) No row buries an open fork | ✓ for 11; **webtraces ✗** (design open under #992 → carve off that, not here). **webreliability ✓ with a flag** — its recovery-handler registry has resolved design (#011/#028/#101/#503); the protocol-level `error-recovery` GAP becomes an internal design item in the sub-epic body, not a blocker to carving the umbrella. |
| (3′) Coherent independently-ownable scope + resolved lineage | ✓ — every row cites a real resolved lineage + a locatable standard (njk/spec); `file:line` impl-grounding correctly relaxed (pure-build seams get drawn when each sub-epic is itself `/slice`d). |
| (4) Clean DAG, ≥2 independent | ✓ — independent standards → 11 parallel sub-epic roots, no inter-edges. |
| (5′) Leaves a valid backlog state, refined in place | ✓ — each is a real home seeded with its lineage; the demoable test re-applies one level down at story-slice time. |

## Could split — #1008 → 11 sub-epics (kind b: #1008 stays an epic, no conversion)

| Sub-epic | Carve scope | `workItem` | blockedBy |
|---|---|---|---|
| webpositioning | **finish/surface** — complete the WE-side seam over FUI's built anchor-positioning (`fui:blocks/droplist/positioning/`) | epic | — |
| webreliability | recovery-handler registry (#011/#028/#101/#503); **body flags** protocol-level `error-recovery` needs its own design item before that slice | epic | — |
| webintl | Intl.* provider seam (#017 promotion) | epic | — |
| webmanifests | changelog-manifest contract + reader (#102) | epic | — |
| webidentity | credential-management provider (#012/#482/#483) | epic | — |
| webreporting | **finish** — renderers + ingest/export adapters over the existing report-model impl (#350/#431) | epic | — |
| webnotifications | push-delivery provider + notification intents (#456/#459/#460) | epic | — |
| webrealtime | transport-negotiation runtime (#458) | epic | — |
| webprocess | self-driven artefact contract runtime (#672/#690) | epic | — |
| webresources | pagination + delivery-transport (#061/#455) | epic | — |
| webpolicy | DMN engine + proof-of-compliance (#406/#407/#408) | epic | — |

**DAG:** 11 independent sub-epic roots (no inter-standard edges) — each independently prioritisable, each a
future `/slice` candidate once picked up and its contract scoped.

## Could not split (here) — webtraces

| Row | Failed condition | Unblocking action |
|---|---|---|
| webtraces | **(1)** design open — substrate mid-design under **#992** (trace/replay) | Build epic carves off **#992's** ruling, not #1008. When #992 resolves, scaffold the webtraces impl sub-epic then. |

## Proposed mutation (gated on "go")

- **#1008 stays an epic** (kind b — no story→epic conversion); carries no `size` (`type:idea` epic, none to
  drop); digest already umbrella-framed.
- Scaffold **11 sub-epics** `--workitem=epic --parent=1008` (no `--size`), each body seeded with its row's
  design lineage from the table (real future `/slice` candidates, not shells). Numbers allocated at scaffold.
- **webtraces not scaffolded** — deferred behind #992.
- **Net flow: +11 epics opened**, #1008 left open. Gate: `npm run check:standards` green + backlog count
  rises by 11. #1008 resolves once webtraces is carved (its condition: all 12 have homes).

## Net

**Could-split (partial) — 11 sub-epics now, webtraces deferred to #992.** Confidence **~85%**. Residual:
(a) whether you want **all 11** carved at once or only the rows with near-term build intent (all 11 = 11 new
open epics — each a legit future-work home, and epics don't pollute the `--select` story tiers, but it's 11
files); (b) webreliability's internal `error-recovery` design-gap is flagged in-body rather than split to a
separate `type:decision` card — promote it if you'd rather not carry it inline.

---

# Focused run: `/split 912` — polyglot live-test sandbox

**Verdict: COULD SPLIT** (3 slices, linear chain w/ incremental delivery).

## Candidate

**#912** — *Polyglot panel — live-test sandbox: execute the generated wrapper in an embedded sandbox* ·
`workItem: story` · `size: 13` · `parent: "746"` · `locus: frontierui` · `relatedProject: webdocs` ·
`blockedBy: [753, 955, 977]` (**all resolved**; #974 wrapper-serve protocol also resolved).

Re-sized 8→13 in batch-2026-06-18 with an explicit `/split 912` recommendation once #974 pinned the
endpoint to the *whole* `servePathIR` surface. The card states "**No design fork remains** — #955/#974
settled all of them; this is purely a size/decomposition re-scope." This pass verifies the seams.

## Work-investigation pass (read the real tree, both repos)

- **`servePathIR` is a frozen, fully-specified contract** — [we:servePathIR.ts:28-131](../blocks/renderers/module-service/servePathIR.ts#L28):
  `DEFAULT_BASE_PATH='/_maas/'`, `CACHE_POLICY`, `MAAS_HEADERS`, `HTTP_STATUS`, `MEDIA_TYPES`,
  `ServePathIR`, `SERVE_PATH` (`Object.freeze`). Every header/status/policy the endpoint must emit is an
  **already-defined constant** here → the endpoint *wires* the contract, it doesn't design it. (This is
  why the honest size is **5**, not the body's "5–8" feel — the "8" came from re-listing headers that
  are already constants to thread through.)
- **Producer exists** — [fui:tools/gen-wrapper/genWrapper.mjs](../../fui:tools/gen-wrapper/genWrapper.mjs)
  (`generateWrapper(decl,target)`, `EMITTERS={react,vue}`) is present FUI-side; the endpoint runs it +
  esbuild transpile.
- **No reusable module URL for an isolated frame** — [fui:workbench/registry.ts:143-159](../../fui:workbench/registry.ts#L143)
  registers blocks via bundled static `import('../blocks/…')`; the live-mount can't reuse the workbench
  loader, it must `import('/_maas/<block>.js?form=…')` — confirms the #955-A2 same-document mount needs
  the endpoint (slice A) first.
- **mount.ts is 947 lines** ([fui:workbench/mount.ts](../../fui:workbench/mount.ts)) — same-document mount
  (#955-A2) integrates host-side inspector/event/anatomy reads here.

## Could split — #912 → 3 slices

**Edge case (parent exists):** #912 sets `parent: 746` (#746 = the Block Explorer workbench epic, which
lists #912 as a slice). #912's scope is genuinely an umbrella of 3 substantial pieces, so the honest
shape is to **convert #912 → a storied epic nested under #746** and roll the 3 slices under #912 (rather
than the "keep as story + siblings under #746" path, which would dump endpoint/mount/e2e directly into
the parent workbench epic and lose the polyglot-sandbox grouping). Flagged for approval below.

| Slice | What it builds | Home | `workItem`/`size` | blockedBy |
|---|---|---|---|---|
| **A** FUI `/_maas/` wrapper-serve endpoint | Vite `configureServer` middleware conforming to `servePathIR` + `maas-versioning`: parse `<name>[@<pin>].js?form=react-wrapper\|vue-wrapper&target=…`, run `fui:tools/gen-wrapper/genWrapper.mjs` + esbuild, serve ESM with the 302 floating→pin ladder, content-hash identity, `ETag`/`X-MaaS-Integrity` (SRI), `X-MaaS-Producer`/`-Lossy`, `CACHE_POLICY` immutable/floating, 400/404/500 set. FUI implements its own handler conforming to the **type-only** WE contract (must NOT import WE's runtime `fetchHandler` — #855/#817). Conformance test against `servePathIR`. | `fui:` (new `_maas/` serve module + vite `configureServer`) | `story·5` | — |
| **B** Workbench same-doc live-test mount + react/vue devDeps | `fui:workbench/live-test/`: `await import('/_maas/<block>.js?form=react-wrapper')`, mount into the workbench document (no iframe/postMessage — #815/#955-A2), React error boundary + `window.onerror`/`unhandledrejection` runtime-error surfacing, wire into existing inspector/event/anatomy panels ([fui:workbench/mount.ts](../../fui:workbench/mount.ts)). Add `react`/`react-dom`/`vue` as workbench **devDeps** (never the shipped `@frontierui` bundle — framework-free, #955-B); Vite resolves the wrapper's bare `react` import from `node_modules`. | `fui:workbench/live-test/` + devDeps | `story·5` | A |
| **C** Playwright e2e for the live-test panel | Reuse the vendored runtime (no uncontrolled external network): mount a block's react-wrapper, assert it renders + a thrown error surfaces in the error panel. | `fui:` e2e | `task·2` | B |

### Slice DAG

```
A (/_maas/ endpoint) ──→ B (workbench live-test mount + devDeps) ──→ C (e2e)
```

Linear chain. Justified under rubric (4) by **incremental delivery**: A ships a standalone,
conformance-tested MaaS endpoint usable by *any* client (not just the workbench); B ships the live
preview; C adds regression coverage. Each leaves a valid demoable state.

### Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — #955 (A2 same-doc), #974 (servePathIR endpoint shape), #977
   (`react-wrapper`/`vue-wrapper` form values) settled every fork; card states no fork remains.
2. **≥2 nameable slices, real home** ✓ — 3 slices, distinct homes (FUI `_maas/` middleware /
   `workbench/live-test/` / FUI e2e), each file-grounded above.
3. **Slices land ≤5 / task** ✓ — A=5 (wires frozen constants + existing `genWrapper` through one
   middleware), B=5, C=task·2.
4. **Clean acyclic DAG, ≥2 independent OR incremental** ✓ — linear, but incremental delivery is
   genuinely valuable (A independently useful as a MaaS endpoint).
5. **No coherence loss; each demoable** ✓ — A's conformance test is its demo; B's live panel; C's e2e.
   The endpoint stays **one** slice (not split internally into core-serve vs versioning-ladder) precisely
   to keep `servePathIR` conformance coherent: the 302 floating→pin ladder is core to `SERVE_PATH`, and
   the workbench consumer issues *floating* requests, so a "pinned-only" half-endpoint would be a
   half-protocol (rubric 5 violation) that couldn't feed slice B.

## Could not split

None — #912 splits cleanly into A→B→C.

## Proposed mutation (gated on "go")

- Convert **#912** in place: `story` → **storied epic** nested under `parent: 746` (drop `size`, umbrella
  digest, keep `status: open`).
- Scaffold A (`story·5`, blockedBy none), B (`story·5`, blockedBy A), C (`task·2`, blockedBy B), all
  `--parent=912`, `locus:frontierui`. Numbers allocated at scaffold.
- **Net flow: +3 items**, #912 → epic. Gate: `npm run check:standards` green + backlog count +3.

## Net

**Could-split — 3 slices (A→B→C).** Confidence **~85%**. Residual: (a) whether you'd rather keep #912 a
re-sized story with A/B/C as siblings under #746 instead of nesting an epic under #746; (b) slice A's
size holding at 5 vs creeping to 8 once the full `maas-versioning` ladder is wired (the constants
pre-exist in `we:servePathIR.ts`, so 5 is the honest estimate). A is batchable immediately; B after A; C
after B.

---

# Focused run: `/split 449` — package `@frontierui/plugs`, delete `webeverything/plugs`, repoint WE + plateau-app

## Candidate

**#449** — *Package `frontierui/plugs` as `@frontierui/plugs`, delete `webeverything/plugs`, repoint WE +
plateau-app* · `workItem: story` · `size: 13` · `parent: "170"` · `locus: frontierui` ·
`blockedBy: ["725", "950"]` (**both resolved** — collision warnings now stale) · `status: open`.

Re-sized 8→13 in batch-2026-06-18 on two grounds: execution volume (the dedup spans three repos) and a
**forbidden mid-batch Vite restart** (wiring the package alias into WE's vite config restarts the user's
dev server). Direction is settled by **#606** (plugs is FUI's; WE consumes it as a no-leakage client) — so
the size is pure volume, no open fork. This pass traced the real surface in all three repos before drawing
seams.

## Work-investigation pass (read the real tree, three repos)

| Claim | What the tree actually shows |
|---|---|
| FUI plugs is the canonical source | ✓ `fui:plugs/` exists (137 files), but **`fui:plugs/package.json` is MISSING** — Scope §1 (dual `.`/`/bootstrap` exports) is greenfield. |
| WE has "61 runtime consumers" via aliases | **Corrected:** WE's per-package aliases (`@core`, `@webregistries`, … `@webexpressions`, `we:vite.config.mts:162-169`) have **0 importers** — every consumer imports via **relative `../plugs/` paths**: **42 `.ts` files** (`grep` confirmed). So repointing WE = wire one `@frontierui/plugs` alias + rewrite 42 relative imports, **not** retarget the 8 aliases. |
| `webeverything/plugs/` to delete | ✓ **156 files** under `we:plugs/`. |
| plateau-app composes via an alias | ✓ `plateau-app:tsconfig.json:16` (`@we/plugs/*` → `../webeverything/plugs/*`) + `plateau-app:vite.config.mts:120` (`@we/plugs` → `weRoot/plugs`) + `:126` (`virtual:trait-manifest` → `weRoot/plugs/webbehaviors/traitManifest`). Separate repo, own dev server (:4000) — **not** the WE server the batch-restart rule protects. |
| Package must expose only `.`/`/bootstrap` | **Sharpened:** WE consumes plugs by **subpath** (`@core`=core, `@webregistries`=webregistries, … 8 subpaths). So the package's `exports` map (slice A) must expose those subpaths too, or WE's alias retargets them into the package — i.e. **A's export surface is shaped by what WE/plateau consume**, making A genuinely foundational. |
| #726 carry-forward | ✓ #726 added unplugged tests at `we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` + `we:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts` and flipped `PLUG_UNPLUGGED_TEST_ENFORCED=true`. On delete these must relocate to the FUI canonical home → folds into the delete slice. (Scope §5's other 7 FU-only tests already live FUI-side — they stay.) |

**Net:** the repoint+delete is **not** one atom. The FUI package (greenfield, no restart, isolated repo)
peels off cleanly as the foundation; plateau-app is a third independent repo; and within WE the alias-wire
+ 42-import rewrite is a clean seam from the 156-file delete (the dead `plugs/` dir is harmless until
deleted). Four groundable slices.

## Could split — #449 → 4 slices

**Edge case (parent exists):** #449 already sets `parent: "170"` (the plugs-runtime dedup epic — correct
scope here, like the #725 run). So per *Executing a split* it is **not** converted to a nested epic. It
stays a `story`, re-sized `13 → 5`, narrowed to its **core slice** (the WE alias-wire + 42-import
repoint — the heart of "repoint WE to consume the package"). The other three become **siblings under
#170**.

| Slice | What it does | Home | `workItem`/`size` | blockedBy | Batchable now |
|---|---|---|---|---|---|
| **A** (new sibling) — package `@frontierui/plugs` | Add `fui:plugs/package.json`: `.` → unplugged library entry, `/bootstrap` → plugged POC entry, **plus the subpath exports WE/plateau consume** (`core`, `webregistries`, `webinjectors`, `webcomponents`, `webcontexts`, `webbehaviors`, `webstates`, `webexpressions`); keep FU-only `fui:globals.d.ts`/`we:virtual-trait-manifest.d.ts`/`we:webbehaviors/traitManifest.ts` off the public surface. FUI build + vitest + e2e green against the package entry. | `fui:plugs/` | `story·3` | — | ✅ (isolated FUI repo, no WE restart) |
| **#449** (kept, re-scoped) — repoint WE onto the package | Wire `@frontierui/plugs` (+ its subpaths) into `we:tsconfig.json` + `we:vite.config.mts` (the restart-forcing edit); rewrite the **42** relative `../plugs/` imports → `@frontierui/plugs/*`; retarget the `virtual:trait-manifest` alias. Old `we:plugs/` stays present-but-dead → valid intermediate. WE build + check:standards green; demos render against the package. | `webeverything` | `story·5` | A | ❌ (forces WE Vite restart → `/next`) |
| **C** (new sibling) — repoint plateau-app | Retarget `plateau-app:tsconfig.json:16` + `plateau-app:vite.config.mts:120,126` from `@we/plugs`/`weRoot/plugs` → `@frontierui/plugs`. plateau-app build green. Independent repo. | `plateau-app` | `story·2` | A | ⚠ (own :4000 server, not WE's — restarts plateau only) |
| **D** (new sibling) — delete `we:plugs/` + relocate #726 tests | Delete the 156 files under `we:plugs/`; relocate the two #726 unplugged tests to the FUI canonical home (`fui:plugs/webguards/` + `fui:plugs/webvalidation/`, adjusting `guard/`→`blocks/guard/` + `validity-merge/`/`validator-resolution/` import paths); verify **no** `../plugs/` or `@we/plugs/*` survives in any repo. All gates green. | `webeverything` (+ FUI test move) | `task` | #449 | ❌ (same WE session as #449) |

### Slice DAG

```
A (package @frontierui/plugs) ─┬─→ #449 (repoint WE) ──→ D (delete we:plugs/ + #726 tests)
                               └─→ C (repoint plateau-app)
```

- **After A, two roots run in parallel** — #449 (WE repoint) ∥ C (plateau-app repoint) are independent
  repos with disjoint files (rubric 4 ✓).
- **Incremental delivery:** A ships a consumable package (FUI green, nothing else touched); #449 puts WE on
  the package with the dead dir harmless; C puts plateau-app on the package; D is the bounded cleanup. Every
  slice leaves a valid, demoable state (rubric 5 ✓).
- **Batchability:** **A is batchable now** (isolated FUI, no WE-server restart — the real win of this
  split). #449 + D are *not* batchable (they wire/teardown WE's Vite alias → restart → a focused `/next`
  session). C restarts only plateau-app's own server, so it's batch-eligible **if** no plateau-app dev
  server is running (flagged, not assumed).

### Rubric check (all five hold)

1. **Volume, not uncertainty** ✓ — #606 settled the direction (plugs is FUI's, WE is a no-leakage client);
   no slice re-decides a seam.
2. **≥2 nameable slices, real home** ✓ — 4 slices across FUI / WE / plateau-app, each `file:line`-grounded
   above.
3. **Slices land ≤5 / task** ✓ — A·3, #449·5, C·2, D·task. The heaviest (#449·5) is the alias-wire +
   42-import rewrite — atomic (can't half-repoint) and mechanical over a pre-existing relative-import set.
4. **Clean acyclic DAG, ≥2 independent** ✓ — A → {#449, C}; #449 ∥ C after A (disjoint repos); D is bounded
   incremental cleanup.
5. **No coherence loss; each demoable** ✓ — splitting #449's repoint from D's delete leaves the dead
   `we:plugs/` present-but-unreferenced (valid), exactly the intermediate that lets #449 ship before the
   156-file teardown.

## Could not split

None — #449 splits cleanly into A → {#449, C} → D.

## Proposed mutation (gated on "go")

- **#449 stays a `story`** (it has `parent: "170"`): re-size `13 → 5`, narrow scope/digest to the **WE
  repoint core**, add `blockedBy: A`. **Not** converted to an epic (edge case — parent exists).
- Scaffold **A** (`story·3`, `--parent=170`, `locus:frontierui`, no blocker), **C** (`story·2`,
  `--parent=170`, `--blocked-by=A`, `locus:plateau-app`), **D** (`task`, `--parent=170`,
  `--blocked-by=449`, `locus:webeverything`). Numbers allocated at scaffold; #449's `blockedBy` updated to
  the new A number.
- **Net flow: +3 items**; #449 stays a (re-sized) story under #170. Gate: `npm run check:standards` green +
  backlog count +3.

## Net

**Could-split — 4 slices (A → {#449, C} → D), `+3` items.** Confidence **~85%**. The corrected mechanism
(WE imports via 42 relative paths, **not** the 8 aliases) is the load-bearing finding; the residual is
whether #449's repoint holds at `5` vs creeping to `8` once the 42-import rewrite + subpath-export wiring
is underway (mechanical over a pre-existing import set, so `5` is honest), and whether slice C counts as
batchable (depends on the user not running plateau-app's server). **A is batchable immediately** — the
foundational win; #449 + D want one focused `/next 449` Vite-restart session; C rides either.

---

# Paced sub-epic slicing — batch 1 of N (`/slice` the #1008 sub-epics, 3 at a time)

User opted to slice the #1008 implementation sub-epics into their contract→provider→demo trios (the
#1003 webanalytics precedent), **3 epics per batch, stop and wait between batches**. Each greenfield
epic → A (contract → @webeverything, story·3) + B (provider/runtime → FUI, story·5, blockedBy A) +
C (conformance demo, story·3, blockedBy A); B ∥ C after A.

## Batch 1 — #1018, #1019, #1020 (sliced)

| Epic | A contract | B provider | C demo | Notes |
|---|---|---|---|---|
| #1018 webpositioning | #1048 | #1049 (finish/surface over FUI runtime) | #1050 | B is finish-scope, not greenfield |
| #1019 webreliability | #1051 | #1052 (registry runtime) | #1053 | **error-recovery slice still HELD** behind decision #1032 — not scaffolded |
| #1020 webintl | #1054 | #1055 (Intl.* runtime) | #1056 | native-first default |

- **+9 stories opened**; 3 epic bodies updated (next-step → sliced-into). Gate green on all (the lone
  repo error is pre-existing report locus-prefix debt from concurrent runs, not these items).
- Each trio: B and C are independent roots after A → batchable once A lands.

## Remaining (paced, awaiting go)

- **Batch 2:** #1021 webmanifests, #1022 webidentity, **#1023 webreporting (INVESTIGATE-FIRST — substantial
  impl exists; may resolve or yield one small finish slice, not a blind trio)**.
- **Batch 3:** #1024 webnotifications, #1025 webrealtime, #1026 webprocess.
- **Batch 4:** #1027 webresources, #1028 webpolicy. (+ #1019 error-recovery slice once #1032 ratifies; webtraces stays deferred to #992.)

## Batch 2 — #1021, #1022, #1023 (sliced)

| Epic | A contract | B provider | C demo | Notes |
|---|---|---|---|---|
| #1021 webmanifests | #1057 | #1058 (reader runtime) | #1059 | trio |
| #1022 webidentity | #1060 | #1061 (Credential Mgmt API runtime) | #1062 | native-first |
| #1023 webreporting | — | — | **#1063 (single finish slice)** | **investigated → mostly built**: contract shipped, renderers #432 + producer-migration #435 resolved, ingest/export adapters complete; only gaps = no conformance demo + stale `status:concept`. One slice: demo + concept→poc relabel. |

- **+7 stories** (#1021/#1022 trios = 6; #1023 single = 1). 3 epic bodies updated.
- **#1023 is NOT a build trio** — the investigate-first call paid off: it's a finish/relabel, not a from-scratch build (the audit's "finish renderers+adapters" framing was stale; #432/#435 already landed them).
- Gate green on all batch-2 items (lone repo error is a concurrent session's #1033, not these).

## Remaining (paced, awaiting go)

- **Batch 3:** #1024 webnotifications, #1025 webrealtime, #1026 webprocess.
- **Batch 4:** #1027 webresources, #1028 webpolicy (+ #1019 error-recovery slice once #1032 ratifies; webtraces stays deferred to #992).

## Batch 3 — #1024, #1025, #1026 (sliced)

| Epic | A contract | B provider | C demo |
|---|---|---|---|
| #1024 webnotifications | #1064 | #1065 (push-delivery runtime) | #1066 |
| #1025 webrealtime | #1067 | #1068 (WS/SSE/WebTransport runtime) | #1069 |
| #1026 webprocess | #1070 | #1071 (artefact contract runtime) | #1072 |

- **+9 stories.** 3 epic bodies updated to sliced-into. Gate fully green (0 errors).

## Remaining (paced, awaiting go)

- **Batch 4 (final):** #1027 webresources, #1028 webpolicy (+ #1019 error-recovery slice once #1032 ratifies; webtraces stays deferred to #992).

## Batch 4 (final) — #1027, #1028 (sliced)

| Epic | A contract | B provider | C demo |
|---|---|---|---|
| #1027 webresources | #1074 | #1075 (pagination + delivery-transport runtime) | #1076 |
| #1028 webpolicy | #1077 | #1078 (DMN engine + proof-of-compliance runtime) | #1079 |

- **+6 stories.** 2 epic bodies updated. Gate green (0 errors).

## Full #1008 slice run — totals

10 of the 11 sub-epics sliced (webtraces never carved — deferred to #992):

- **9 greenfield/finish epics → contract/provider/demo trios** (#1018, #1020–#1022, #1024–#1028) = **27 stories** (one each: #1018's B is finish-scope).
- **#1019 webreliability → registry trio** (3 stories); its **error-recovery slice held** behind decision #1032.
- **#1023 webreporting → ONE finish slice** (#1063) — investigate-first found it mostly built (contract + #432 renderers + #435 producer-migration + ingest/export adapters all landed); only a conformance demo + concept→poc relabel remain.
- **Net opened across the whole #1008 program:** 11 sub-epics + 1 decision (#1032) + 31 slice stories.
- Every trio: B and C are independent roots after A → batchable once each A lands. The A-contract slices (all `story·3`, no blocker) are the immediately-batchable front.
