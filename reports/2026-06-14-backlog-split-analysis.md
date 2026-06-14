# Backlog split analysis — 2026-06-14

Focused run: `/slice 507`.

## Candidate

**#507 — MaaS deterministic generation-adapter — derive idiomatic native origin per language
(AI-improved adapter, human-reviewed) + first .NET/Java target**
`workItem: story` · `size: 13` · `parent: "081"` · `blockedBy: ["505", "506"]` · `status: open` →
**oversized story (kind a)**.

Both blockers are **resolved**: #505 shipped the language-neutral serve-path IR + OpenAPI projection +
JS reference impl ([servePathIR.ts](../blocks/renderers/module-service/servePathIR.ts),
[servePathOpenAPI.ts](../blocks/renderers/module-service/servePathOpenAPI.ts)); #506 shipped the
cross-language conformance suite — golden vectors, reference target, runner
([conformance/](../blocks/renderers/module-service/conformance/)). So 507's inputs exist on disk and it
is unblocked.

### Condition (1) — is this volume or a buried decision?

Volume. The design fork was settled in **#463 fork a**: deterministic generation (no AI in the path),
AI only at adapter-development time against a regression corpus, deterministic-core / HTTP-shell split,
fidelity gated by #506. The one residual choice — **".NET or Java" first** — is *which-target-first*
prioritization, not a fork: both are legitimate end-states we want eventually
([[feedback_fork_not_a_prioritization_tool]]), so it does not block the split; it is just the scope of
one slice. Picking one (recommendation: **.NET**, below) settles it at batch-time.

The 13 points decompose along clean component seams the body itself names: **(a)** the deterministic
emit engine, **(b)** a first foreign-language target backend, **(c)** wiring that target through the
#506 gate, **(d)** the dev-time regression corpus the adapter is improved against.

## Could split

| Slice | workItem · size | Scope | Home | DAG |
|---|---|---|---|---|
| **1 · Generation-adapter core — deterministic IR→emit engine + core/shell split** | story · 3 | The engine that reads [servePathIR.ts](../blocks/renderers/module-service/servePathIR.ts) and emits an origin deterministically (same source → byte-identical), codifying the **deterministic-core / HTTP-shell** architectural split and a **language-backend interface**. Proof backend = **regenerate the existing JS reference origin** byte-for-byte against a checked-in golden — validating the interface against an already-conformance-covered target before any foreign language. | new `blocks/renderers/module-service/generation/` | depends on 505 ✓, 506 ✓ |
| **2 · First foreign native target — .NET backend** | story · 3 | A language-backend implementing the slice-1 interface, emitting an **idiomatic native .NET MaaS origin** (own output tree) from the neutral contract. Runtime = AI-free pure-native; Wasm out of scope. | `generation/targets/dotnet/` | blocked-by **1** |
| **3 · Conformance-gate the generated target through #506** | story · 2 | Wire the generated .NET origin as a target the [#506 runner](../blocks/renderers/module-service/conformance/runner.ts) drives against the golden vectors; enforce byte-identical / identity-stable fidelity as the release gate for the generated origin. | `conformance/` + `generation/` | blocked-by **2** |
| **4 · Adapter dev-time regression corpus (no AI automation)** | story · 3 | The regression corpus + snapshot gate the deterministic adapter is improved against — the substrate any improver (human now, AI later) edits rules/templates against and re-runs. Explicitly **excludes** the full-AI improvement cycle (out of scope per #463). | `generation/corpus/` | blocked-by **1** (parallel to 2/3) |

**Slice DAG:**

```
505 ✓ ─┐
506 ✓ ─┼─> 1 ──> 2 ──> 3
        └        └────────────  (3 needs the generated target from 2)
            1 ──> 4            (4 parallels 2/3 — both only need the engine)
```

Linear spine `1 → 2 → 3` (each foreign target proven through the gate), with `4` branching off `1` in
parallel. Every slice re-estimates to `size ≤ 3`, names its own home, buries no fork.

**Demoable state at each seam:**
- After **1**: a tested engine that regenerates the JS reference origin byte-identically (determinism
  proven; interface validated against a real target — not speculative). Gate green.
- After **2**: a real idiomatic .NET MaaS origin exists, generated deterministically.
- After **3**: that .NET origin passes the #506 golden vectors — the proof #507 was chartered to ship.
- After **4**: a regression corpus gates generator output drift for any future rule/template change.

### Why splitting here does not cost quality

The usual risk — *engine interface designed without a consumer goes speculative and slice 2 reworks it*
— is neutralized by slice 1 carrying the **JS-reference-regeneration proof backend**: the engine's
language-backend interface is validated against a known-good, already-conformance-covered output before
a foreign language is attempted. Slice 2 then adds a *second* backend to an interface that already has
two consumers (JS reference + .NET), which is exactly when an interface earns its shape. No quality cost.

## Could not split

Nothing held back. All four conditions (2)–(5) hold for every slice; (1) holds at the parent. The
.NET-vs-Java residual is prioritization, resolved by choosing .NET for slice 2 (not a blocker).

## Proposed mutation (gated on go)

- Convert **#507** `story → epic` in place; **drop residual `size: 13`**; refresh the digest to umbrella
  framing (keep the #463-fork-a charter, point at the four children, note Java is a future sibling
  target reusing slices 1/3/4).
- Scaffold **4 children** under `--parent=507`:
  - **1** Generation-adapter core (no `blockedBy` — 505/506 already resolved)
  - **2** `--blocked-by=<slice-1 NNN>`
  - **3** `--blocked-by=<slice-2 NNN>`
  - **4** `--blocked-by=<slice-1 NNN>`
- Net flow: **+4** (1 story → 1 epic + 4 stories). Gate on `npm run check:standards`. Then `/batch`
  can chain 1 → (2 ∥ 4) → 3.

---

# Backlog split analysis — 2026-06-14 (run 2)

Focused run: `/slice 563`.

## Candidate

**#563 — AI-driven agile methodology as a shareable approach**
`workItem: epic` · no `size` · `status: open` · **no child references it as `parent`** →
**unsliced epic (kind b)**.

Per the kind-(b) path, rubric (1) (*should we decompose?*) is normally taken as settled at the parent.
But the **work-investigation pass fails before any slice can be drawn** — and that, not (1), is what
holds this back.

### The work-investigation pass — no investigable surface exists

A slice boundary is a claim about the work. For #563 there is **nothing on disk to investigate**: it is
a *knowledge/positioning artifact* (the epic itself: "playbook / template / write-up", "Capture it as a
value artifact … NOT a product"), and the artifact does not yet exist. There is no subsystem to grep, no
registry, no fixture, no file a proposed slice could cite at `file:line`. Any slice drawn now would be
"straight from the body" — exactly the manufactured-agent-ready-work the rubric forbids.

The reason the surface doesn't exist is structural, not incidental — **two foundational gates are
deliberately unmet**:

1. **The artifact *shape* is an open, undecided fork.** The epic's own Status: "⬜ Decide the artifact
   shape (playbook / template / write-up) when the practice has settled." The slices are *downstream of
   this decision* — a playbook decomposes into sections, a template repo into a kit-extraction, a
   talk/article into an outline. You cannot name ≥2 concrete slices without first picking the shape, and
   **you cannot split away a fork** (rubric (1)/(3): a slice that picked a shape would bury it).
2. **Deliberate deferral until the practice settles / near release.** The epic ("Don't freeze a moving
   target early"; "no build committed") mirrors sibling **#143** (`status: parked` — "Deferred by
   intent: don't build this early — author it just before release"). The substance #563 would capture is
   still maturing; decomposing now would freeze a moving target.

So the epic is correctly *open* but **not yet decomposable** — it is an idea-epic awaiting a shape
decision, not a decided-to-decompose epic with latent volume. The one piece already carved out
(personas-as-concept) left as **#564** (`story·3`, separate decision) — not a child of #563, and the
correct pattern: real sub-questions leave as their own items when they crystallize, rather than being
forced into a premature slice grid.

## Could split

Nothing. No proposed slices.

## Could not split

| Candidate | Rubric condition that fails | Unblocking action |
|---|---|---|
| **#563** epic | **(1)/(3) — buried fork + (2) ≥2 nameable slices.** The decomposition is gated on the undecided *artifact shape*; no slice is nameable or `file:line`-citable until shape is picked, and any slice drawn now buries that fork. Compounded by deliberate deferral (no investigable surface until the practice settles, aligned with #143's pre-release timing). | **Resolve the artifact-shape decision (#569) first.** The fork is now extracted from #563's body into its own `type:decision` card **[#569](../backlog/569-artifact-shape-for-the-ai-driven-agile-methodology-playbook-.md)** — a fork belongs in a decision card, not a hidden epic checkbox, regardless of *when* it's ratified ([[feedback_decisions_are_workitems_not_plan_mode]]). #569 is **parked** (deferred until the practice settles near release, aligned with #143) — the deferral governs *when to ratify*, not whether it's tracked. When release nears, ratify #569 via `/decision`, *then* re-run `/slice 563` against the now-concrete artifact. |

## Mutation applied

No *split* (no slices), but the buried fork was surfaced as required by the workflow ("register the
pending decision back in the backlog"):

- **Filed [#569](../backlog/569-artifact-shape-for-the-ai-driven-agile-methodology-playbook-.md)** —
  `type:decision` · `story·2` · `parent:563` · `status:parked` — the artifact-shape fork, with its four
  options (A playbook *(lean)* / B template repo / C talk / D enablement guide) and guardrails.
- **#563 body de-buried** — the inline "shape is open" bullet and the "⬜ Decide the artifact shape"
  checkbox now point at #569 instead of carrying the fork.
- #563 itself stays an **open idea-epic** (no `story→epic` conversion — it's already an epic; no child
  slices, since it's not decomposable until #569 lands). Net flow: **+1** (the decision card).

Re-run `/slice 563` after #569 is ratified.

---

# Backlog split analysis — 2026-06-14 (run 3)

Focused run: `/slice 570`.

## Candidate

**#570 — Scaffold the webcharts project — Vega-Lite L1 profile + CustomChartRenderer protocol +
conformance suite (semantic/theme plane split + a11y axis)**
`workItem: epic` · `size: 13` · `parent: "105"` · `status: open` · **no child references it as
`parent`** → **unsliced epic (kind b)**. Decomposition already decided (rubric (1) settled at parent);
every slice still verified against the real tree.

### Work-investigation pass — proven surface, slices are file:line-citable

Unlike #563, the scaffolding surface **exists** — adding a new standard touches established registries
and templates:

- **Project node** — `src/_data/projects.json` (shape per `webregistries` [projects.json:3-10](../src/_data/projects.json#L3-L10)) + icon `src/assets/icons/webcharts.svg` + partial `src/_includes/project-webcharts.njk` (pattern: `project-webvalidation.njk`). `check-standards.mjs` needs only unique `id` + valid `status` for a project.
- **Protocol** — `src/_data/protocols.json` (shape per `anchor-positioning` [protocols.json:21-27](../src/_data/protocols.json#L21-L27)); required `id/name/summary/status/ownedByProject/anchor`. **Hard coupling:** `anchor` must exist as `<section id>` in the owning partial or `check:standards` errors, and `ownedByProject` must resolve — so the protocol row + its body land together, after the project exists.
- **Schema** — no dedicated dir; the Vega-Lite L1 profile lives as TS/pseudocode in `project-webcharts.njk` (precedent: the Mock Contract schema in `project-webcases.njk`) + glossary terms in `semantics.json`.
- **Conformance suite** — self-contained cases under `src/cases/webcharts/*.html` (precedent: `src/cases/resource-loader/`, `src/cases/for-each/`); free-form, no required-field validation.
- **Deferred per #105** — renderer adapters (Vega/Plotly/ECharts → `adapters.json` "lib") and the thin chart-description intent (`intents.json`). Not sliced; filed as follow-ons when L1 lands.

The one sub-fork #105 noted ("how thin the L1 core is") **dissolves** rather than blocks: the ratified
contract is a *tiered* Vega-Lite subset/superset, so L1 = the minimal core (`data/mark/encoding` +
scales/axes/legends) and selections/transforms/composition become L2+ tiers — additive, not excluded.
No buried decision; no `type:decision` card warranted.

## Could split

**#570 → storied epic + 4 task slices.** All ≤ `size 3`, each leaves a `check:standards`-green, demoable state.

| Slice | workItem · size | Scope | Named surface | blockedBy |
|---|---|---|---|---|
| **a · project node + skeleton page** | task · 2 | webcharts entry (category `standard`, status `concept`) + icon + umbrella partial (mission/scope, no protocol yet) | `projects.json`, `src/assets/icons/webcharts.svg`, `src/_includes/project-webcharts.njk` | — |
| **b · Vega-Lite L1 profile schema** | task · 3 | L1 profile: semantic plane (`data→encoding`) kept separate from presentation/theme plane (webtheme tokens); thin L1 core, L2+ tiers additive; color/size mapping semantic, resolved values theme | `project-webcharts.njk` (schema section), `semantics.json` | a |
| **c · CustomChartRenderer protocol** | task · 3 | `protocols.json` entry + anchor `<section>` in the partial: renderer-swap registry contract, native-first SVG default, tiered-conformance framing | `protocols.json`, `project-webcharts.njk` (`#protocol-custom-chart-renderer`) | a |
| **d · conformance suite + a11y axis** | task · 3 | `src/cases/webcharts/*.html` scoring two independent axes (semantic fidelity, theme application) + first-class a11y (description channel, derived data-`<table>`, WAI-ARIA Graphics roles; required at L1, graceful degradation) | `src/cases/webcharts/` | b, c |

**Slice DAG:**

```
a ──> b ──┐
 └──> c ──┴──> d
```

`b ∥ c` are independent (both depend only on `a`) → satisfies ≥2-independent; the chain also delivers
incrementally — `a` ships a live tile + page, `b` adds the spec, `c` surfaces the protocol on
`/protocols/`, `d` adds scoreable conformance. Every slice is batchable (`task`, ≤3, named files, no
fork). Note: `a/b/c` all edit `project-webcharts.njk`, so sequence them through that shared file
(logical independence, not concurrent-edit independence).

## Could not split

None. All five rubric conditions hold for #570.

## Proposed mutation (gated on go)

- **#570 is already an epic** — no `story→epic` conversion; **drop residual `size: 13`** (children carry
  points; a sized epic with sized children errors `check:standards`); refresh digest to umbrella framing.
- Scaffold **4 task children** under `--parent=570`: **a** (no `blockedBy`), **b** `--blocked-by=<a>`,
  **c** `--blocked-by=<a>`, **d** `--blocked-by=<b>,<c>`.
- Net flow: **+4** (epic·13 → epic + 4 tasks). Gate on `check:standards`. Then `/batch` chains
  a → (b ∥ c) → d.

---

# Backlog split analysis — 2026-06-14 (run 4)

Focused run: `/slice 583`.

## Candidate

**#583 — External reference health monitoring (liveness, retirement, replacement)**
`workItem: epic` · no `size` · `status: open` · **already has two children** (#584 decision·5, #585
story·8). Eight further candidate slices sit un-carved in its body ("carve as they become ready").

This is not the kind-(b) "unsliced epic" case (it already has children), so the run does **not** re-ask
"should #583 decompose." It asks: **which un-carved candidates are build-ready to carve as batchable
children *now*** — verified against the real reference surfaces, not the body's framing.

### Work-investigation pass — real reference homes (file:line)

A registry/sweep slice is a claim about where references actually live. Mapped every external-reference
home:

| Home | File | URLs | Structured? | `retired` shape? |
|---|---|---|---|---|
| Corpus sources | `src/_data/benchmarkCorpus.json` (sources ~L48-73) | 51 (`docsUrl`+`repoUrl`, 26 sources) | ✅ JSON | ✅ #546 seed (`retired`/`retiredDate`/`retiredReason`) |
| Design reference library | `src/_data/references.json` (`links[].url`) | 28 ext | ✅ JSON | ❌ |
| Web-standard refs | `src/_data/blocks.json` (`webStandards.*.reference`) | 94 ext | ✅ JSON (nested) | ❌ |
| Capability-presence rows | `src/_data/benchmarkCapabilityPresence.json` (`rows[].url`) | 1,266 ext | ✅ JSON | ❌ |
| Intent docs | `src/_data/intents.json` (URLs in HTML `description`) | 70 | ⚠️ embedded HTML | ❌ |
| Report citations | `reports/*.md` | ~375 md links / ~550 bare | ❌ freeform md | ❌ |
| Research topics | `src/_data/researchTopics.json` | 0 structured (prose) | ❌ | ❌ |
| Backlog crossRefs | `backlog/*.md` frontmatter | 263 — **all internal** | ✅ but internal → out of scope | n/a |
| adapters / protocols | `src/_data/adapters.json`, `protocols.json` | 0 | — | — |

**No URL-liveness validator exists** (`scripts/` has no fetch/http/link/404/liveness utility). The
reference registry **does not exist** — built from scratch.

Decisive consequence: the five **structured** homes (corpus + references + blocks + capability-presence +
intents ≈ **1,500 URLs via deterministic JSON walks**) are indexable *now* with no fork. The freeform
homes (reports md, research prose) are lossy and separable. And the registry is exactly what the epic
calls "the foundation #585 stands on — likely the first slice to build," which **#585 today buries** as
an internal "prerequisite, detailed in the body."

## Could split (carve now — one slice)

| Epic candidate | Proposed new child | workItem · size | Files (file-citable) | Batchable? |
|---|---|---|---|---|
| **7** reference-registry substrate | **Reference-registry substrate — index the structured reference homes** | story · **3** | `benchmarkCorpus.json`, `references.json`, `blocks.json`, `benchmarkCapabilityPresence.json`, `intents.json`; new extractor `scripts/*` + a generated index data file | ✅ |

Scope: a deterministic extractor that walks the five **structured** homes and emits one deduped index
(`{ url, home, sourceId, label }`) — the substrate #585's sweep and #584's convention both stand on.
**Excludes** the lossy freeform homes (reports md, research prose) and **excludes** deciding the
retirement shape (that's #584). No buried fork — schema + canonical-URL dedup are mechanical.

### Resulting DAG under #583

```
#583 (epic)
├── NEW reference-registry substrate (story·3)   ← build first; foundational, no real blocker
├── #585 liveness sweep (story, re-est 8→5)       ← blocked-by NEW (needs the index)
└── #584 retirement convention (decision·5)       ← parallel; unchanged
```

- **Independence + incremental delivery:** the registry ships standalone value (a queryable/rendered
  index of "every external reference this project depends on") before any sweep exists. ✓
- **Demoable state:** the generated index file / a count-by-home render. ✓
- Mutation also **re-points `#585.blockedBy` → the new slice** and **re-estimates #585 8→5** (the registry
  was part of its size-8).

## Could not split (carve deferred) — with unblocking action

| Epic candidate | Failing rubric condition | Unblocking action |
|---|---|---|
| **3** multi-modal classification | Not separate — already folded into #585's scope | none (stays in #585) |
| **4** remediation routing | (4) DAG — needs detection (#585) *and* convention (#584) both landed before anything routes | land #585 + resolve #584, then carve |
| **5** archive-on-cite | (3) buries a real fork — which archive service, when the snapshot fires, where pins live (#546's rejected Fork-1-B "done right") | file a `type:decision` card, then carve the build |
| **6** axis-vacancy alerting | (4) DAG — needs retirement detection (#585) + corpus category structure; done manually by #546 today | land #585, then carve |
| **8** cadence / trigger | (4) DAG — nothing to schedule until the sweep (#585) exists; reuses #101/#558 orchestrator | land #585, then carve |
| **9** platform-strategy setting (L2) | (1) volume-vs-fork — a protocol-shape *decision* (gate-strict vs advisory, archive-on-cite on/off, horizons), not a task; premature pre-dogfood | land L1 dogfood, then open as `type:decision` |
| **10** Plateau SaaS offering (L3) | (1)+(5) — explicitly "later"; no demoable WE-side state; gated by Plateau linear-cost rule | defer until L2 setting ratified |

The epic body's "carve as they become ready" disposition is correct for 4/5/6/8/9/10 — none is
build-ready today. Only slice 7 is carve-safe now.

## Proposed mutation (gated on go)

- **#583 already an epic** — no conversion, no `size` to drop (it never carried one).
- Scaffold **1 child** under `--parent=583`: the reference-registry substrate (`story·3`, **no
  `blockedBy`** — foundational, build now).
- **Re-point #585** `blockedBy: ["583"]` → `["583", "<new-NNN>"]` and **re-estimate #585 `size: 8 → 5`**.
- Net flow: **+1** child; no resolves, no deletes. Gate on `check:standards`. Then `/batch` can pick up
  the registry slice immediately (it's unblocked).
