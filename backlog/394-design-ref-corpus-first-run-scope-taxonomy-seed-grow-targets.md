---
type: decision
workItem: story
size: 3
parent: "382"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-design-ref-corpus-taxonomy-seed.md
tags: [design-reference, corpus, taxonomy, classification]
---

# Design-ref corpus: first-run scope & taxonomy seed (grow targets)

## Digest

The corpus pipeline already ships (#382); the only open fork is **how to classify and grow the
worklist**. **No new design existed for the taxonomy itself** — so this prep ran a prior-art survey
(reference galleries + IA literature) and published it as the [`design-ref-taxonomy`](/research/design-ref-taxonomy/)
research topic. **4 forks**, each grounded in that survey and carrying a **bold** recommended default.
This is **internal research-corpus tooling** (`design-refs/`) — _not_ a Web Everything standard, **zero
project-facing lock-in** — so every default lands on the most-permissive, growable option. The eventual
decision turn is ratification, not research.

## Ruling ✅ *(ratified 2026-06-13)*

All four forks ratified **as recommended — B / C / B / A**:

1. **Fork 1 — Register structure → B (split).** Split the conflated `designRegister` into
   **`productRegister`** (deterministic product archetype: enterprise / modern-saas / consumer /
   creative-tool / utilitarian — author-supplied at target time) + **`visualStyle`** (named visual
   aesthetic — *deferred to the phase-3 vision pass* per #382 Fork 2). Re-key the 16 existing
   `designRegister` values → `productRegister` (mechanical, no recapture).
2. **Fork 2 — Vocabulary openness → C (open-growing controlled vocab).** Canonical values live in a
   keyed **`we:design-refs/taxonomy.json`** (the `we:benchmarkCorpus.json` pattern). New values allowed but
   must be registered → clean re-run diffs, synonyms gated at add-time.
3. **Fork 3 — First-run scope → B (scarcity-weighted grow-targets, ~30–50).** Drive toward **≥3 shots
   per under-covered (productRegister × category) cell**, prioritising registers thin today
   (consumer/social, commerce/admin, finance/banking, productivity/collaboration, communication/inbox,
   content/media). The quota is a **grow-target the worklist tracks, not a hard cap**.
   **Caveat recorded:** reachable *public* apps skew dev-tools, so the thinnest cells may be
   unreachable via Playwright capture and depend on the **gallery-harvest method**
   ([#397](/backlog/397-design-ref-gallery-harvest-capturemethod-for-auth-walled-app/)) for auth-walled
   interiors. The scarcity cells are an aspirational worklist target; the first run may fall short on
   the thinnest cells without #397, and that is acceptable (grow-target, not cap).
4. **Fork 4 — Category vocab source → A (coarse hand-roll, lightly anchored).** A **~10-domain seed**
   recorded in `we:taxonomy.json`, cross-referencing G2/Capterra top-level names where they map — without
   inheriting their depth.

**Build follow-through** (mechanical, agent-ready) carved to
[#509](/backlog/509-design-ref-taxonomy-seed-re-key-scarcity-targets-build-394-r/). This resolves the last
open fork of the **#382** epic, which resolves alongside.

## The axis being decided

The corpus worklist `we:design-refs/targets.json` carries author-supplied curated fields per app —
`category`, `designRegister`, `theme` ([we:targets.json:5](../design-refs/targets.json)) — which
`we:scripts/design-refs.mjs` copies onto each shot's `we:meta.json`
([we:design-refs.mjs:194-196](../scripts/design-refs.mjs)) and the `report` command aggregates "by category /
register / theme" ([we:design-refs.mjs:7](../scripts/design-refs.mjs)). The decision decomposes into **four
orthogonal axes**:

1. **Register structure** — is "design register" _one_ field or _two_? Today `designRegister` conflates
   product archetypes (`enterprise-dense`, `modern-saas`) with visual aesthetics (`minimal`, `dark-dev`,
   `minimal-hand-drawn`) in the same column ([we:targets.json:5-20](../design-refs/targets.json)). The survey
   shows these are independent axes.
2. **Vocabulary openness** — closed schema enum, free-text folksonomy, or open-growing controlled
   vocabulary in a keyed registry (the shape of `we:src/_data/benchmarkCorpus.json`)?
3. **First-run scope** — how many shots, distributed how? The proof set is **16 apps, all dev/tool-flavored**
   (developer-tools ×4, code-playground ×3, the rest editors/diagramming) — thin everywhere else.
4. **Category vocabulary source** — hand-roll coarse domains (today's `whiteboard-diagramming`,
   `code-playground`…) or borrow an external directory taxonomy (G2/Capterra)?

`surface` (screen-type) is **out of scope here** — #382 Fork 2 deterministically deferred per-screenshot
visual tagging (surface, refined register, theme) to the phase-3 vision pass
([#382:78-82](/backlog/382-design-reference-screenshot-corpus-collect-dedup-codify/)); this item only sets the
**target-level** curated seed.

## Architectural classification (per-fork pass)

| Question | Answer |
|---|---|
| Which layer? | **None** — internal `design-refs/` corpus tooling, not intent/block/plug/protocol/adapter |
| Protocol or intent dimension? | Neither — metadata schema for an internal worklist |
| Project-facing lock-in? | **Zero** — dev-time corpus; devtools = no lock-in |
| Fixed mechanic or dimension? | **Dimension** — open-growing vocab; quota is a grow-target, not a cap |
| Most-permissive default? | **Yes** — growable vocab + grow-target (not hard cap) on every fork |
| Bias toward separation? | **Honoured** — split the conflated register field (Fork 1) |
| The one real seam | **Deterministic target-curation** (`productRegister`, `category`) vs **vision-pass tagging** (`visualStyle`, `surface`) — the seam #382 Fork 2 already drew |

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Register structure | **Split → `productRegister` (deterministic) + `visualStyle` (vision-pass)** | Keep one `designRegister` field | High |
| 2 · Vocabulary openness | **Open-growing controlled vocab in keyed `we:taxonomy.json`** | Closed schema enum | High |
| 3 · First-run scope | **Scarcity-weighted grow-targets, ~30–50 shots filling thin registers** | Flat N-per-category | Medium |
| 4 · Category vocab source | **Coarse ~10-domain hand-roll, lightly anchored to G2/Capterra** | Adopt external taxonomy wholesale | Medium |

---

## Fork 1 — Register structure: one field or two

**Crux.** `designRegister` today mixes two things that vary independently
([we:targets.json:5-20](../design-refs/targets.json)): a **product archetype** (`enterprise-dense`,
`modern-saas`, `utilitarian` — a property of _what the product is_, knowable deterministically) and a
**visual aesthetic** (`minimal`, `dark-dev`, `minimal-hand-drawn`, `friendly-minimal` — a property of
_how the pixels look_). A modern-SaaS product can render flat or glassmorphic; the two are orthogonal.

- **Option A — keep one `designRegister` field.** Matches the shipped schema; one column to fill. But it
  forces a false choice per app and produces a noisy mixed vocabulary (already visible in the proof set).
- **Option B — split into `productRegister` + `visualStyle`.** `productRegister` = the exercise-app
  archetype vocabulary (enterprise / modern-saas / consumer / creative-tool / utilitarian), author-supplied
  at target time because it's deterministic. `visualStyle` = the named-aesthetic vocabulary (flat, material,
  minimal, glassmorphic, neobrutalist, skeuomorphic), **deferred to the vision pass** because it's
  perceptual — consistent with #382 Fork 2.

**Default: B (split).** Bias-toward-separation: burden of proof is on combining, and these are genuinely
independent axes that prior art treats separately. The split _reduces_ collect-time curation (only the
deterministic archetype is author-supplied; the aesthetic is a vision-pass output). _Rejected: A_ — the
conflation is the source of the proof set's noisy register column.

_Sub-decision:_ migrate the 16 existing `designRegister` values → `productRegister` on the next worklist
edit (a mechanical re-key, no recapture needed).

## Fork 2 — Vocabulary openness & where canonical values live

**Crux.** How rigid is each axis's vocabulary, and where do the canonical values live so re-runs stay
comparable? The IA literature is explicit (see the research topic): a **closed taxonomy** is consistent but
rigid; a **folksonomy** (free-text) is flexible but drowns in synonym/polysemy noise.

- **Option A — closed schema enum.** Validate `category`/`productRegister` against a fixed list in the
  schema. Maximally comparable, but blocks adding a new domain mid-run (you'd have to edit the validator).
- **Option B — free-text tags.** Anything goes. Flexible but accrues synonyms (`dev-tools` vs
  `developer-tools`) and defeats the "counts by register" report.
- **Option C — open-growing controlled vocabulary in a keyed registry.** Seed canonical values in
  `we:design-refs/taxonomy.json`; new values are allowed but must be registered (keyed, append-friendly), so
  re-runs diff cleanly and synonyms are caught at add-time. This is exactly the
  `we:src/_data/benchmarkCorpus.json` pattern already used by the gap-analysis program.

**Default: C (open-growing controlled vocab).** The documented faceted-classification resolution, and it
mirrors a pattern the repo already runs. Most-flexible-yet-safe: growth is allowed, noise is gated.
_Rejected: A_ (too rigid for an explicitly-growing corpus), _B_ (the noise the proof set already shows).

## Fork 3 — First-run scope & distribution

**Crux.** How many shots and distributed how? The placeholder is ~30–50 from the style-registers
([#382:86-89](/backlog/382-design-reference-screenshot-corpus-collect-dedup-codify/)). The proof set is **16
apps, all dev/tool-flavored** — the item's whole motivation is "prioritise registers the corpus currently
lacks."

- **Option A — flat N-per-category.** Even, simple. But spends budget re-covering the already-saturated
  dev-tools cells.
- **Option B — scarcity-weighted grow-targets.** Drive the corpus toward **≥3 shots per under-covered
  (productRegister × category) cell**, prioritising the registers thin today (everything outside
  dev-tools/editors). Landing ~30–50 the first run. The quota is a **grow-target the worklist tracks, not a
  hard cap** — new runs append.
- **Option C — uncapped opportunistic.** Collect whatever's reachable, no quota. Maximal volume but
  re-entrenches the dev-tools skew (reachable public apps _are_ mostly dev tools).

**Default: B (scarcity-weighted grow-targets), ~30–50 first run.** Operationalises the item's intent and
keeps the most-permissive framing (a grow-target, not a cap). _Rejected: A_ (wastes budget on saturated
cells), _C_ (doesn't fix the documented skew). Seed cells to fill first: consumer/social, commerce/admin,
finance/banking, productivity/collaboration, communication/inbox, content/media — the archetypes absent
from the 16-app set.

## Fork 4 — Category vocabulary source _(surfaced by the survey)_

**Crux.** Where does the `category` seed come from? The SaaS directories (G2 2,000+, Capterra ~1,000,
Crozdesk 377) each maintain a _different_, evolving, keyed taxonomy — so reuse means borrowing a coarse top
level, not adopting leaves.

- **Option A — hand-roll coarse domains.** What `we:targets.json` does now (`whiteboard-diagramming`,
  `code-playground`…). Fits the corpus's small scale; risks idiosyncratic, un-comparable labels.
- **Option B — adopt an external directory taxonomy wholesale.** Comparable to industry segmentation, but
  2,000 G2 categories are wildly too fine for a ~50-shot corpus — over-engineering.

**Default: A, lightly anchored.** Hand-roll a coarse **~10-domain seed** recorded in the Fork-2
`we:taxonomy.json` registry, **cross-referencing G2/Capterra top-level names where they map** (so it isn't
idiosyncratic) without inheriting their depth. _Rejected: B_ — taxonomy depth the corpus will never use.

---

## Build follow-through (once ratified)

Mechanical, no further design: (1) add `we:design-refs/taxonomy.json` seeded with the productRegister +
category canonical lists; (2) re-key the 16 `designRegister` → `productRegister`; (3) append scarcity-cell
targets to `we:targets.json` and run `design-refs collect`; (4) point `report` at the new keyed vocab. None of
this is blocked — the phase-1 pipeline already supports the fields.
