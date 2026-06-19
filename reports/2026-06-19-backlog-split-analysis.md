# Backlog split analysis — #1073 (on-device small-VLM vision tier, Tier 2)

**Date:** 2026-06-19
**Scope:** focused split of epic [#1073](../backlog/1073-on-device-small-vlm-vision-tier-tier-2-richer-critique-taggi.md) (`workItem: epic`, unsliced, `size: 13`).
**Architecture ref:** [we:docs/agent/vision-tiers.md](../docs/agent/vision-tiers.md) · ruling [#488](../backlog/488-on-device-ui-screenshot-vision-model-as-a-plateau-capability.md).

## Verdict: splits cleanly into 4 slices (3 ready now + 1 gated)

The build has four real seams — **contract → model/eval → in-browser provider → dev-browser surface** —
that mirror the Tier-1 chain (#511/#512/#514) and the existing vision seam shape. Three are independently
deliverable and agent-ready now; the fourth is a real slice but gated on the dev-browser shell existing.

### Could split

| Slice | Title | Size | blockedBy | Independent / demoable state |
|---|---|---|---|---|
| **A** | Tier-2 rich-output contract + provider-seam extension | 3 | — | Pure: a normalized rich-output envelope (description/tags/regions) + a normalizer + the `manual` null path on `registerVisionProvider`, fixture-tested like the verdict/codification halves in `we:scripts/design-refs/vision.mjs`. No model, no browser. **Demo:** unit tests green. |
| **B** | Small-VLM candidate selection + offline eval harness | 3 | — | Pick a candidate (SmolVLM/Moondream/Florence-2) and an **offline eval** scoring it on the *objective* capabilities (tagging / element-region detection) against a held-out set. **Demo:** a dated eval report ranking candidates. *(Soft dep on #1034 — see note.)* |
| **C** | In-browser Transformers JS + WebGPU provider | 3 | A, B | Wrap slice B's chosen model behind slice A's contract, running via ONNX Runtime Web / Transformers JS + WebGPU — the Tier-2 analogue of #514. **Demo:** a standalone demo page running the VLM in-browser on a screenshot. |
| **D** | Dev-browser opt-in surface (download + invoke + render results) | 3 | C, *dev-browser shell* | The opt-in download + UI that surfaces the rich output inside the dev browser (#141). **Demo:** the tier visible/usable in the dev-browser shell. |
| **E** | Per-screenshot review / tag / train UI | 3 | A | A human-in-the-loop, per-screenshot labeling surface — review the model's output on one screenshot, tag ground-truth element-regions on it, feed training. The Tier-2 analogue of #1036; produces the corpus B evals against. **Demo:** tag a screenshot, persist a labeled pair. |

**DAG:**
```
A (contract) ─┬─▶ C (in-browser provider) ─▶ D (dev-browser surface)
              │                               ▲
              │                     gated on: dev-browser shell (#141 build)
B (model/eval)┘
A (contract) ────▶ E (per-screenshot review/tag/train UI)
```

**Why this is safe (rubric pass):**
- **Size = volume, not a decision.** The *capability tier* decision is already ruled (#488); these slices
  are build volume. The one residual decision (critique-quality metric) is carved out of B — see note.
- **≥2 nameable slices, each a real home.** A/C live behind the existing `registerVisionProvider` seam
  (`we:scripts/design-refs/vision.mjs`); B is a script + eval report; D is a dev-browser surface.
- **Each ≤3.** All four land `size: 3`.
- **Clean DAG / incremental.** A and B are fully independent and startable immediately; C composes them;
  D composes C. Every edge is real (C genuinely needs both a contract and a chosen model).
- **Every slice leaves a demoable state** (tests → eval report → standalone demo → dev-browser surface),
  honoring demo-first iteration.

### Could not (fully) split — the gated remainder

- **Slice D is filable but not agent-ready now** — its valid landing state ("the tier usable in the dev
  browser") requires the **dev-browser shell to exist**. #141 ruled the dev browser (decision, resolved)
  but the *build* is staged successor work with no current build item. **Unblock action:** file/advance
  the dev-browser shell build, then D is ready. Until then C's standalone demo is the demoable home. I'll
  file D with a `blockedBy` placeholder note rather than a false-green edge.

## Note — slice B's soft dependency on the critique rubric (#1034)

Tier 2's headline use is *design critique*, but critique quality has **no clean metric** (unlike Tier 1's
verdict-agreement). Defining "good critique" is exactly the open [#1034](../backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w.md)
rubric decision. So B is **scoped to the objectively-measurable capabilities** (tagging, element/region
detection) which need no rubric; the **critique-quality benchmark folds in once #1034 lands**. This keeps
B free of an unresolved decision (rubric-safe) while still letting you start model selection now.

## Proposed mutation (on "go")

1. #1073 stays `workItem: epic`, **drop its `size`** (storied epic; children carry the volume).
2. Scaffold A, B, C, D as `parent: 1073`, `size: 3`, with edges: C `blockedBy: [A,B]`; D `blockedBy: [C]`
   plus a body note that D is also gated on the dev-browser shell build.
3. `npm run check:standards` must stay green.

---

# Backlog split analysis — #1029 (FUI `/_maas/` wrapper-serve endpoint)

**Date:** 2026-06-19
**Scope:** focused split of story [#1029](../backlog/1029-fui-maas-wrapper-serve-endpoint-vite-middleware-conforming-t.md) (`workItem: story`, `size: 13`, `parent: 912`, `locus: frontierui`).
**Contract ref:** [we:blocks/renderers/module-service/servePathIR.ts](../blocks/renderers/module-service/servePathIR.ts) (the type-only IR FUI conforms to) · reference impl [we:blocks/renderers/module-service/fetchHandler.ts](../blocks/renderers/module-service/fetchHandler.ts) + [we:tools/maas/vite-plugin.ts](../tools/maas/vite-plugin.ts) · generator `fui:tools/gen-wrapper/genWrapper.mjs`.

## Verdict: splits cleanly into 3 slices (linear incremental-delivery chain)

#1029 is **itself slice A** of epic #912 (it has a `parent`), so the [edge-case rule](../docs/agent/backlog-workflow.md) applies: **#1029 is NOT converted to an epic** — it stays a re-sized `story` for its core slice, and the other slices are scaffolded as **siblings under #912**.

The endpoint has three real seams that mirror the WE reference's own architecture:
- **producer** (the injected `resolve`/`serveCompiled` seam — `fui:tools/gen-wrapper` + esbuild),
- **HTTP/identity origin** (the `we:blocks/renderers/module-service/fetchHandler.ts` + `we:tools/maas/vite-plugin.ts` equivalent), and
- **conformance** (the 6-response IR vector suite).

The middle (identity + 302 ladder + ETag/SRI + 6-response set) is internally cohesive and stays one slice; pulling the producer and the ~250-line conformance test off it is the clean, quality-neutral cut that gets every slice batchable (`≤8`).

### The flagged "design point" is precedent-settled — no decision card needed

#1029's body flags the 302 floating→pin ladder's *current-hash resolution* (regenerate-and-hash per floating hit vs cache the current-artifact id) as an "unspecified design point." **Investigation closes it:** the WE reference handler already commits to **regenerate-and-hash on every floating hit, no historical artifact store in v1** ([we:blocks/renderers/module-service/fetchHandler.ts:242-255](../blocks/renderers/module-service/fetchHandler.ts#L242-L255)) — and FUI conforms to the *same* `servePathIR` + `maas-versioning` contract the #506 vectors assert against, so it **mirrors the reference** rather than re-deciding. "Cache the current id" is a non-contract perf optimization, explicitly out of v1 scope. So rubric (1) holds — this is **volume, not an open fork**. The middleware slice carries an explicit "mirror `we:blocks/renderers/module-service/fetchHandler.ts`'s regenerate-and-hash, no historical store" instruction so it isn't re-litigated. *(Confidence ~80%; residual: if FUI is later deemed free to diverge on caching it's a tiny deferrable optimization, but conformance-to-contract removes it from this build.)*

### Could split

| Slice | Title | Size | workItem | blockedBy | Independent / demoable state |
|---|---|---|---|---|---|
| **#1029** (core, re-sized 13→8) | FUI `/_maas/` wrapper-serve middleware + handler | 8 | story | producer (new) | The HTTP/identity origin: Vite `configureServer` + Fetch↔Node adapter + handler (URL/pin parse, content-hash identity folding the genWrapper producer version, 302 floating→pin ladder, `ETag`, `If-None-Match`→304, `X-MaaS-Integrity`/`-Producer`/`-Lossy`, `CACHE_POLICY`, 400/404/500 set) conforming to the **type-only** `servePathIR` — must NOT import WE's runtime `fetchHandler` (#855/#817). Calls the producer slice. **Demo:** `curl`/native `import('/_maas/<block>.js?form=react-wrapper')` serves bytes via the 302 ladder. |
| **N1** (new sibling) | FUI wrapper-bytes producer — genWrapper + esbuild resolve seam | 3 | story | — | The injected `resolve` seam (FUI analog of `serveCompiled`): resolve a block's CEM declaration → `genWrapper(decl, 'react'\|'vue')` → esbuild JSX→ESM → `{code, language, producerVersion}`. **Demo:** unit test — react-wrapper + vue-wrapper emit valid ESM. |
| **N2** (new sibling) | 6-response `servePathIR` conformance test | 3 | task | #1029 | Assert all 6 enumerated responses (200 hash-pin+ETag+SRI+producer / 302 / 304 / 400 unknown-form / 404 / 500) against `SERVE_PATH` + `maas-versioning`. **Demo:** conformance suite green. |

**DAG (under #912):**
```
N1 (producer) ─▶ #1029 (middleware/endpoint) ─┬─▶ N2 (conformance test)
                                              └─▶ #1030 (workbench mount, existing) ─▶ #1031 (e2e, existing)
```
`#1030`/`#1031` edges are unchanged — they already `blockedBy` the endpoint (`#1029`), which remains the endpoint slice.

**Why this is safe (rubric pass):**
- **Size = volume, not a decision.** Strategy settled by #955/#974/#977; the lone "design point" is precedent-settled (above).
- **≥2 nameable slices, each a real home.** N1 → `fui:tools/maas/` (greenfield, genWrapper already lives at `fui:tools/gen-wrapper/`); #1029 → the `fui:` Vite middleware (shape mirrors `we:tools/maas/vite-plugin.ts`); N2 → an `fui:` conformance test against the WE IR.
- **Each ≤8 (batchable).** 8 / 3 / 3 — all under the >8 cutoff.
- **Clean DAG / incremental.** N1 is the injected seam WE itself factors out (`serveCompiled` is a separate module injected into the handler) — real architectural independence, not an arbitrary cut. #1029 composes it; N2 verifies it.
- **Every slice leaves a demoable state** (producer unit test → live endpoint serving wrappers → full IR-conformance suite), honoring demo-first iteration.

### Could not (further) split

- **#1029 (the middleware) stays one size-8 slice.** Its identity → 302-ladder → ETag/SRI → 6-response logic is one tightly-coupled handler (the 302 needs the id, the 200 needs id+SRI, the 304 needs ETag=id). Sub-splitting "per response" would fragment a cohesive unit with no independently-demoable sub-state (rubric 4/5 fail) — so it holds at 8 (batchable). **No unblock action needed.**

## Proposed mutation (on "go")

1. **#1029** stays `workItem: story`, `parent: 912` (NOT converted to epic — edge case); re-size `13 → 8`; set `blockedBy: [N1]`; strip the "re-sized 5→13 + released" framing; add the "mirror `we:blocks/renderers/module-service/fetchHandler.ts` regenerate-and-hash, no historical store" note + a pointer to this report.
2. Scaffold **N1** (`story·3`, `parent=912`, no blocker) and **N2** (`task·3`, `parent=912`, `blocked-by=1029`).
3. Refresh #912's body "Children" listing (A now has a producer prereq + a conformance follow-on).
4. `npm run check:standards` must stay green; backlog count `+2`.

---

# Backlog split analysis — #1042 (L3 completion umbrella)

**Date:** 2026-06-19
**Scope:** focused `/slice 1042` of epic [#1042](../backlog/1042-l3-completion-umbrella-spec-vs-impl-gaps-across-the-implemen.md) (`workItem: epic`, unsliced, no children — kind **b**).
**Source:** #991 audit §10 ([we:audits/standards-surfacing-audit.md](../audits/standards-surfacing-audit.md)) — 11 of 12 implemented standards carry spec-vs-impl gaps; intentional-layering ones already withheld from re-filing.

## Verdict: roadmap "epic of epics" → **full** sub-epic split (8 per-standard sub-epics)

Each natural child is a *whole standard's* completion scope (protocol/observable/SSR/member surfaces
still missing) — clearly multi-story, not a `≤5` band. So #1042 slices into **sub-epics** ((3′)/(5′) form
of the rubric), each a future `/slice` candidate. The body itself seeds "slice per standard when picked."

### Investigation pass — every row has resolved design lineage (spec page) + a real impl surface

| Standard | Spec lineage | Impl surface | §10 gap (seed) | Granularity |
|---|---|---|---|---|
| webregistries | `we:src/_includes/project-webregistries.njk` | `we:plugs/webregistries/` (9 TODOs) | global-patching API stubbed (`we:plugs/webregistries/index.ts:49`), `getStandInElement`/downgrade/`whenDefined` TODO (`we:plugs/webregistries/CustomElementRegistry.ts:114,135,148`), 1 of ~10 registry types | sub-epic |
| webstates | `we:src/_includes/project-webstates.njk` | `we:plugs/webstates/` (CustomStore only) | change-tracking **and** storage protocols absent; **reconcile [#503](../backlog/503-build-the-webstates-storage-protocol-durable-client-persiste.md)** (resolved·size5 but L3 found no storage impl) | sub-epic |
| webvalidation | `we:src/_includes/project-webvalidation.njk` | `we:plugs/webvalidation/` | no L1 observable attrs/events, commitment policy, error-summary (registry plane only) | sub-epic |
| webcontexts | `we:src/_includes/project-webcontexts.njk` | `we:plugs/webcontexts/` (3 TODOs) | no claim/query protocol, strict-vs-flexible modes, SSR | sub-epic |
| webbehaviors | `we:src/_includes/project-webbehaviors.njk` | `we:plugs/webbehaviors/` | missing `whenDefined`, ownerElement-vs-target naming, hyphen validation | sub-epic (small) |
| webexpressions | `we:src/_includes/project-webexpressions.njk` | `we:plugs/webexpressions/` | excludedElements, cloak removal, partial upgrade-trigger interception | sub-epic (small) |
| webtheme | `we:src/_includes/project-webtheme.njk` | `we:webtheme/` (compile/schemes/tokens) | scheme runtime unproven, high-contrast missing, accent CSS not regression-tested | sub-epic (small) |
| webdirectives | `we:src/_includes/project-webdirectives.njk` | `we:plugs/webdirectives/` (CustomTemplateDirective only) | ~70% unimplemented — CustomComment subsystem, multi-template; **build-vs-defer = prioritization, not a fork** | sub-epic |

**Excluded (body says intentional layering, NOT re-filed):** webcomponents (#854/#792), webguards
(#178/#273/#338), webworkflows (#657), webinjectors (minor / cross-repo deferred).

### Could split — #1042 → 8 per-standard sub-epics

| Slice | workItem | Scope (seed) |
|---|---|---|
| webregistries completion | epic | global-patching API + remaining registry types + downgrade/whenDefined |
| webstates completion | epic | change-tracking + storage protocols; reconcile resolved-but-undelivered #503 |
| webvalidation completion | epic | L1 observable surface + commitment policy + error-summary |
| webcontexts completion | epic | claim/query protocol + strict/flexible modes + SSR |
| webbehaviors completion | epic | whenDefined + naming convention + hyphen validation |
| webexpressions completion | epic | excludedElements + cloak removal + upgrade-trigger interception |
| webtheme completion | epic | scheme runtime + high-contrast + accent-CSS regression |
| webdirectives completion | epic | CustomComment subsystem + multi-template (deferrable; prioritization, not design-gated) |

**DAG:** **no edges** — all 8 independent (distinct standards, distinct dirs); rubric (4) maximal
independence. None carries `--size` (sub-epics hold no points; their own future slices will). Each is a
real future `/slice` candidate once concrete fix-stories are scoped with `file:line` grounding.

**Why this is safe (rubric pass):**
- **(1) No buried fork.** Every standard has a *resolved* spec page (design lineage). webdirectives'
  build-vs-defer is **prioritization, not a design fork** (decided at batch-selection time). The #503
  reconciliation is an investigation, not a design call.
- **(2) 8 nameable slices, each a real home** (its plug dir / `webtheme/`).
- **(3′) Each a coherent, independently-ownable scope** carrying cited spec + §10 gap lineage — not
  authored from thin air.
- **(4) Clean acyclic DAG, full independence** — all 8 startable in parallel.
- **(5′) Each leaves the backlog in a valid state** — a real home for that standard's completion work.

### Could not split

**None.** Every row has resolved design lineage and none is design-gated or a true GAP (the audit already
withheld the intentional-layering standards), so this roadmap yields a **full** sub-epic split rather than
the usual partial.

### Related (not an edge)

- **#1016** — conformance-vector suite (systemic finding 1; 0/12 standards have one). Sibling, not a
  blocker — per-standard completion can proceed without it. Optional `crossRef`, no `blockedBy`.

## Proposed mutation (on "go")

1. #1042 stays `workItem: epic` (kind **b**, no story→epic conversion); it has no `size` to drop. Refresh
   its digest to umbrella framing + pointer to this report.
2. Scaffold the 8 sub-epics: `node we:scripts/backlog.mjs scaffold --type=idea --workitem=epic
   --title="<standard> completion …" --parent=1042 --digest="…"` (no `--size`, no `--blocked-by`), each
   body seeded with its §10 gap row + spec-page lineage.
3. `npm run check:standards` green; backlog count `+8`.

---

# `/slice 1040` — webblocks protocol-surface governance umbrella (unsliced epic)

**Run:** focused, `/slice 1040`. **Candidate kind:** (b) unsliced epic (`workItem: epic`, no child names it `parent`). Condition (1) "should we decompose" is settled at the parent level — the epic *is* the decision to govern the block surface. Slices verified against the real tree below.

## Investigation — the real block-standard surface

- **79 block specs**, one file per block at `we:src/_data/blocks/<id>.json`, globbed by `we:src/_data/blocks.js` via `we:scripts/lib/blocks-loader.cjs` (#882). Block-level **lifecycle status**: 33 `active` / 32 `draft` / 14 `concept`.
- **Governance today is real but scattered across the validator, with no consolidated spec home:**
  - Lifecycle enum `LIFECYCLE = concept → draft → experimental → active` at `we:scripts/check-standards-rules.mjs:567` (+ `STATUS_SYNONYMS` :568, `checkStatus` :598); `active`⇒`implementedBy` warn at `we:scripts/check-standards.mjs:140`.
  - Type taxonomy `BLOCK_TYPES = {Store, Parser, Behavior, Directive, Component, Module}` at `we:scripts/check-standards.mjs:94`, enforced :147 — **drift:** one block declares `type: "Utility"` (out of set → currently warns).
  - Composability: `composesBehaviors` resolution gate (#936) at `we:scripts/check-standards.mjs:151-182`; the `dependsOn` (32 blocks) / `composesIntents` (33) / `implementsIntent` (50) / `consumesIntent` / `composesWith` relationship fields carry **no documented semantics**.
  - Structural contract fields (`exports`, `attributes`, `properties`, `events`, `slots`, `cssParts`, `slots`, `traits`, `intentDimensions`, …) — ~30 distinct keys observed across the 79 files — have **no schema reference doc**.
  - Spec page `we:src/_includes/project-webblocks.njk` is a filtered card grid only — no governance content. No `docs/agent/` block-authoring/governance guide exists.
- **Type:** the four body areas (status lifecycle · protocol taxonomy · type system · composability rules) map cleanly onto four **distinct** real surfaces. The work is **codification of already-enforced-but-undocumented rules into one governance home** + closing named drift — volume, not a held-open design fork. So it is **not** a roadmap "epic of epics" (no area is a multi-story standard build) → slices are **stories/tasks**, not sub-epics.

## Could split — #1040 (4 slices, A → {B, C, D})

| Slice | workItem·size | Scope | Grounding | Blocked by |
|---|---|---|---|---|
| **A — Governance spec home + schema reference** (the *type-system* area) | story·5 | Establish the block-standard governance doc home (expand `project-webblocks.njk` + a `docs/agent/block-standard.md` authoring guide) documenting the full block-spec JSON schema: every declarable field + meaning (the "type system" of a block spec). The foundational home the rest hang off. | `we:src/_includes/project-webblocks.njk:1`, `we:src/_data/blocks/*.json` (schema), `we:scripts/check-standards.mjs:136-148` | — |
| **B — Status lifecycle governance** | story·3 | Document the block lifecycle `concept→draft→experimental→active` + graduation criteria, codifying existing enforced rules; add the missing doc + flag (don't decide) any gate-tightening as a follow-up. | `we:scripts/check-standards-rules.mjs:567`, `we:scripts/check-standards.mjs:140` | A |
| **C — Protocol taxonomy governance** | story·3 | Define each `type` protocol category (Store/Parser/Behavior/Directive/Component/Module) + selection guidance; **reconcile the `Utility` drift** (add to `BLOCK_TYPES` or reclassify the one block). | `we:scripts/check-standards.mjs:94,147` | A |
| **D — Composability rules governance** | story·3 | Document composition-field semantics (`composesIntents`/`composesBehaviors`/`composesWith`/`dependsOn`/`implementsIntent`/`consumesIntent`), codifying the #936 `composesBehaviors` gate and the `dependsOn` graph rules. | `we:scripts/check-standards.mjs:151-182` | A |

**DAG:** `A → B`, `A → C`, `A → D`. After A lands, **B/C/D proceed independently in parallel** (real independence, rubric 4 ✓). A delivers incrementally — the schema-reference spec home is valid and useful on its own.

**Rubric pass:**
- **(1) volume not a fork** — each area codifies rules *already enforced in the validator*; no area holds an open multi-option design call. Any gate-tightening (e.g. make `active`⇒`implementedBy` an error, or a graduation-demo gate) is flagged as a separate `type:decision` follow-up, not buried in a slice.
- **(2) ≥2 nameable slices, real homes** — 4, each a doc section + the matching validator surface.
- **(3) lands small** — 5/3/3/3, all ≤5, file-grounded above.
- **(4) clean DAG / independence** — A→{B,C,D}; 3 parallel after the foundational doc; incremental.
- **(5) demoable state** — each slice ships a governance doc section *plus* a green `check:standards` gate (the validator IS the conformance demo for a governance rule, per the #441 research-freshness precedent); no half-protocol intermediate.

## Could not split — none

No area failed the rubric. The only "foundational-first" constraint is the A→{B,C,D} edge (the per-area sections need the spec home), which is captured as a `blockedBy` chain with genuine parallel + incremental delivery — not a rigid useless chain.

## Proposed mutation (on "go")

1. **#1040** stays `workItem: epic` (kind b — no story→epic conversion); it already carries no `size`. Refresh digest to umbrella framing ("Umbrella for block-standard governance; sliced into #A schema-home / #B lifecycle / #C taxonomy / #D composability").
2. Scaffold **A** (`story·5`, `parent=1040`, no blocker), **B**/**C**/**D** (`story·3`, `parent=1040`, `blocked-by=<A's NNN>`).
3. `npm run check:standards` green; backlog count **+4**.
