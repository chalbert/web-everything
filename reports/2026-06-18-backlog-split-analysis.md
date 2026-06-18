# Backlog split analysis — 2026-06-18

Focused runs (appended in order): `/split 904`, `/slice 753`, `/split 894`, `/split 818`, `/slice 934`, `/split 725`, `/split 725` (2nd pass — webvalidation residual, could-not-split), `/split 940`.

## Candidate

**#904** — *Close the 10 block contract-impl drift gaps in FUI + flip
`BLOCK_IMPL_DRIFT_ENFORCED` + add export-shape arm* · `workItem: story` · `size: 13` ·
`parent: "170"` · `status: open`.

The #659 drift gate (`validateBlockImplConformance`, [we:check-standards-rules.mjs:1234](../scripts/check-standards-rules.mjs#L1234))
WARNs on 10 WE block contracts whose `implementedBy` resolves to nothing in `../frontierui/blocks/`.
904's own claim-time investigation already established the impls were **never built** (not moved),
so the deliverable is **building 10 FUI block impls**, then **flipping the gate to ERROR**, then a
**second gate arm** comparing each block's declared CEM/export surface to the impl's actual exports.

## Work-investigation pass (read the real tree)

- **Gate** is `locus: webeverything`: a flip of `export const BLOCK_IMPL_DRIFT_ENFORCED = false`
  ([we:check-standards-rules.mjs:1232](../scripts/check-standards-rules.mjs#L1232)) — pure, one line, plus
  the export-shape arm is a new function beside it. The fs walk feeding it lives in `we:check-standards.mjs`.
- **The 10 block builds are `locus: frontierui`.** Each WE contract names its target dir under
  `../frontierui/blocks/…`; none exist today (`ls` confirms 31 dirs, none of the 10). Each is an
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
- **FUI's vite-plugin is a divergent inline-typed fork, not a stub.** [fui:vite-plugin.ts:50-65](../../frontierui/tools/trait-enforcer/vite-plugin.ts#L50)
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
| Blocker is open | **#753 resolved 2026-06-18** (graduated to `fui:frontierui/workbench/mount.ts`) → the consume-mode probe shipped today. The *appetite* half of the demand gate is **not yet shown**. |

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
| `nav:section` uses bare `document.querySelector` → inert in shadow root | ✓ confirmed — [fui:blocks/navigation/NavSectionBehavior.ts:47](../../frontierui/blocks/navigation/NavSectionBehavior.ts#L47) `return document.querySelector(selector)` |
| `nav:list` has the same shadow problem (audit it) | ✗ **already shadow-safe** — [fui:blocks/navigation/NavListBehavior.ts:105-115](../../frontierui/blocks/navigation/NavListBehavior.ts#L105) scopes to `this.target.querySelectorAll`; the slice shrinks to "fix nav:section + confirm nav:list" |
| disclosure-nav hand-rolls sibling-exclusive / outside-click / responsive / Escape | ✓ confirmed — [fui:blocks/disclosure-nav/DisclosureNav.ts:110-163](../../frontierui/blocks/disclosure-nav/DisclosureNav.ts#L110) `wireDisclosure()`: desktop-gate click (l.123), `closeAll` sibling-exclusive (l.120), Escape+refocus (l.132), outside click/focus via `composedPath` (l.146) |
| these behaviors are NOT in nav:section/nav:list (a real new trait) | ✓ confirmed — nav:section = per-section disclosure, nav:list = roving list; **sibling-exclusive + outside-dismiss + responsive gating is a genuine new coordinator** → the epic is *not* a pure rebuild |
| sectioned-nav hand-rolls its accordion toggle | ✓ confirmed — [fui:blocks/sectioned-nav/SectionedNav.ts:56-91](../../frontierui/blocks/sectioned-nav/SectionedNav.ts#L56) per-section click toggle (l.73) + Escape (l.80), **no** sibling exclusivity → maps to `nav:section` alone, no coordinator needed |
| mode-C chrome path has no registry boot | ✓ confirmed — [fui:embed/chrome-in-document.ts:102-133](../../frontierui/embed/chrome-in-document.ts#L102) `mountInDocument(root: ShadowRoot)` builds nav imperatively (l.106), injects CSS, **no `registry.upgrade(root)`** |
| `CustomAttributeRegistry.upgrade(shadowRoot)` exists | ✓ confirmed — [fui:plugs/webbehaviors/CustomAttributeRegistry.ts:267](../../frontierui/plugs/webbehaviors/CustomAttributeRegistry.ts#L267) `upgrade(root: RootNode)`, `downgrade` at l.279; `RootNode = Document \| DocumentFragment \| ShadowRoot` |
| #931 regression guards exist | ✓ confirmed — unit [fui:DisclosureNav.test.ts:63](../../frontierui/blocks/__tests__/unit/disclosure-nav/DisclosureNav.test.ts#L63), [fui:SectionedNav.test.ts:45](../../frontierui/blocks/__tests__/unit/sectioned-nav/SectionedNav.test.ts#L45), integration [fui:chrome-in-document.test.ts:85](../../frontierui/embed/__tests__/chrome-in-document.test.ts#L85), e2e [fui:navigation.spec.ts:94](../../frontierui/plugs/__tests__/e2e/navigation.spec.ts#L94) |
| navigation intent: "coordinate with the unfinished intent→conformance gap, don't fake a tie" | ✓ confirmed the gap is real — [we:webtraits/intentProfileResolver.ts](../webtraits/intentProfileResolver.ts) is **build-time only** (trait inclusion/delivery); **no runtime conformance gate** exists. So "reconcile the intent" has nothing real to bind to. |

**Net:** six of the seven body slices are groundable to real `file:line` seams. The seventh (intent
reconcile) buries an open question the body itself flags — it goes to *could-not-split*.

## Could split — #934 → 6 slices

| # | Slice | workItem / size | blockedBy | Batchable now |
|---|-------|-----------------|-----------|---------------|
| **A** | **Shadow-scope `nav:section`** — `controlledElement` lookup `document.querySelector` → `this.target.getRootNode()`-scoped ([fui:NavSectionBehavior.ts:47](../../frontierui/blocks/navigation/NavSectionBehavior.ts#L47)); confirm `nav:list` already scoped (it is). Precondition: without it the trait is inert in a mode-C mount. | task | — | ✅ |
| **B** | **Build the horizontal-menu coordinator trait** — new webbehaviors trait capturing what nav:section/nav:list lack: sibling-exclusive open, outside click/focus dismiss, responsive desktop-only gating, Escape→collapse+refocus (the [wireDisclosure](../../frontierui/blocks/disclosure-nav/DisclosureNav.ts#L110) behaviors). Own unit test + demo fixture. | story · 5 | A | after A |
| **C** | **Boot the registry in the mode-C chrome path** — instantiate a lean shared-per-page `CustomAttributeRegistry` (#932 lifecycle ruling), register chrome traits, `upgrade(root)` on mount / `downgrade` on teardown in [fui:chrome-in-document.ts:102](../../frontierui/embed/chrome-in-document.ts#L102). Inert no-op until trait DOM lands (valid state). | story · 2 | — | ✅ |
| **D** | **Rebuild `disclosure-nav` as a trait-composing template** — emit `<button nav:section=…>` + coordinator-trait markup + keep the presentational horizontal/responsive CSS; delete `wireDisclosure()` ([fui:DisclosureNav.ts:110-163](../../frontierui/blocks/disclosure-nav/DisclosureNav.ts#L110)). Behavior now flows through the registry. | story · 3 | A, B, C | after A+B+C |
| **E** | **Rebuild `sectioned-nav` as a trait-composing template** — retire the hand-rolled per-section toggle ([fui:SectionedNav.ts:56-91](../../frontierui/blocks/sectioned-nav/SectionedNav.ts#L56)) onto `nav:section` (no coordinator — vertical accordion has no sibling-exclusivity). | story · 2 | A, C | after A+C |
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
| — | **FUI aliases already wired** ([fui:vite.config.mts:212-230](../../frontierui/vite.config.mts#L212-L230)); FUI has a `plugs/` dir but **neither** `webguards` nor `webvalidation`, and lacks all five runtime subsystem dirs. So the port is a clean additive copy + the alias wiring already exists. |
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
  ([fui:vite.config.mts:212-230](../../frontierui/vite.config.mts#L212)): `capability-manifest` whole
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
