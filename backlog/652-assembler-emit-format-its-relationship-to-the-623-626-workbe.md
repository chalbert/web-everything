---
type: decision
workItem: story
size: 3
parent: "646"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-15"
relatedProject: webdocs
relatedReport: reports/2026-06-15-assembler-recipe-emit-prior-art.md
tags: [devtools, composition, assembler, emit-format, cem, webdocs, workbench, decision]
crossRef: { url: /backlog/646-devtools-composition-assembler-build-your-own-component-for-/, label: "Gates — devtools composition assembler epic (#646)" }
---

# Assembler emit-format + its relationship to the #623–626 workbench landscape

**Prepared, ready to ratify.** Two coupled forks that **gate the whole #646 epic** — it cannot be sliced
until they settle (surfaced by `/slice 646`, run 6 of
[we:reports/2026-06-14-backlog-split-analysis.md](../reports/2026-06-14-backlog-split-analysis.md)). No fresh
design exists; the call is grounded in the published `/research/` topic
[ejectable-composition-recipes](/research/ejectable-composition-recipes/) (report linked via
`relatedReport`). [#609](/backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/) ratified only
the *principle* (the assembler is a deferred build; the **ejectable recipe it emits is the standard**, no
runtime framework — *minimize-lock-in* + *impl-is-not-a-standard*). The prior-art survey **reshaped Fork 1**:
the item's "markup vs CEM vs bespoke JSON" trichotomy is false — those sit on three orthogonal layers that
**coexist** (payload · API descriptor · distribution wrapper), so Fork 1 collapses to a forced invariant +
support-all, leaving the home/registry call (Fork 2) as the one genuine judgment. Each surviving call carries
a **bold** recommended default.

## Ruling (2026-06-15) — ratified

Both forks ratified **as recommended**:

- **Fork 1 — recipe-emit format:** **A — plain HTML markup + WE declarative wiring as the ejectable
  payload** (a forced invariant under #609). A CEM descriptor (per #626) and a `registry-item`-shaped
  wrapper are *coexisting additional emit targets*, never rival payloads. Bespoke project-facing recipe
  JSON (option C) rejected — lock-in.
- **Fork 2 — home + shared registry:** **A — stand-alone devtools surface**, reading the
  `workbench*` vocabulary (#624/#625) + a WE-owned preset registry in the shadcn `registry-item` shape,
  read-only. Not a mode inside the Web Docs surface (B), not a rival registry (C).
- **Repo placement** (raised at ratification — *not* decided by this item; deferred to #091 managed-offering
  layering): the *standard* it emits → WE; *primitives* → Frontier UI; *served tool surface* → plateau-app.
  Fork 2's "devtools" classification governs lock (zero-lock-in, no protocol), not repo.
- **Caveat (ratified):** a future, **optional** assembler↔team-component-library integration — submit PRs,
  update existing components in place, scaffold new ones in the team's conventions — carved as
  [#660](/backlog/660-optional-assembler-team-component-library-integration-submit/) (blocked on #646's
  foundational slice). It stays a transport around the same plain payload, never a new lock.

Next: re-run `/slice 646` — it can now decompose (foundational slice A = shell + reveal-nav preset in the
decided format → one `task` per additional preset).

## The axes (what the survey decomposed)

The shadcn/ui distribution model — *"not a component library, a code-**distribution** platform"*: you copy
plain source into your repo and own it (no runtime dep), and a thin `we:registry-item.json` wrapper is the CLI
*transport* that **carries** the code, never replaces it — splits the emit concern into three orthogonal
layers, each pinned to the real tree:

- **The ejectable payload** (what the author owns) — plain markup + WE declarative wiring composing the
  primitives: nav-list ([fui:blocks.json:2082](../src/_data/blocks.json#L2082)) + disclosure
  ([we:intents.json:1868](../src/_data/intents.json#L1868)) + anchor `strategy=escape`
  ([we:intents.json:1256](../src/_data/intents.json#L1256)) + hover-intent
  ([we:intents.json:2664](../src/_data/intents.json#L2664), minted by #643). The dogfood reveal-nav header
  ([we:base.njk:32-69](../src/_layouts/base.njk#L32), [we:style.css:241-276](../src/css/style.css#L241)) is a live
  proof that "a page you could have hand-written" *is* the recipe.
- **The API descriptor** (an optional export of the result) — **CEM**, already ratified-recommended as WE's
  component-API-metadata protocol by [#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-/)
  (the manifest-as-protocol precedent is `changelog-manifest`,
  [we:protocols.json:94](../src/_data/protocols.json#L94)). Describes the composed meta-component's *API surface*,
  never its internal wiring → an additional export, not the recipe body.
- **The distribution wrapper / preset store** (how presets are stored & shared, the *input* side) — a WE-owned
  registry the assembler reads, sibling to the feature vocabulary in
  [we:workbenchFeatures.json](../src/_data/workbenchFeatures.json) / [we:workbenchTools.json](../src/_data/workbenchTools.json)
  (#624/#625) that the catalog pipeline (#623–627) also consumes. This is the same artifact Fork 2's
  shared-registry question is really about.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — Recipe-emit format** | **Plain markup + declarative wiring as the ejectable payload** (CEM descriptor & a `registry-item` wrapper are *coexisting* additional emit targets, not rivals) | Bespoke project-facing recipe JSON *instead of* markup — *rejected* (lock-in) | High |
| **2 — Home + shared-registry** | **Standalone devtools surface, reads the shared registries read-only** (`workbench*` vocabulary + a WE-owned preset registry in the shadcn `registry-item` shape) | A mode inside the Web Docs surface (#627) · a fully independent rival registry | Med-high |

## Fork 1 — recipe-emit format

**Crux.** What a preset emits when an author ejects, under #609's invariants (no framework dependency; output
*is* the standard; must round-trip into a real page). The survey's decisive finding: the item's three options
are **not rival payloads** — they live on the three layers above and coexist.

- **A — plain HTML markup + declarative wiring attributes. ✅ recommended (effectively a forced invariant).**
  Emit the composed markup (nav-list section + disclosure + anchor `strategy=escape` + hover-intent) with WE's
  existing declarative attribute wiring — nothing the platform can't already render. It is the **only** option
  that is literally "the standard, ejected" (shadcn/ui, Webstudio, Webflow all converge here: the owned
  artifact is plain code). Maximally ejectable, zero new schema, honours native-first. **CEM** (the old option
  B) is reclassified as a *coexisting additional export* — the assembler emits a CEM entry describing the
  result's API the same as any block, already settled as a protocol by #626 — and the **`registry-item` wrapper**
  is the preset store from Fork 2, which *carries* this plain payload. Neither competes with A; both ride
  alongside it.
- **B — CEM-aligned descriptor as the recipe body.** *Rejected as the payload.* CEM describes a component's
  *API* (attributes/props/events/slots), not its internal composition wiring — it structurally cannot be the
  recipe. It is the right artifact for a *different* layer (the API export), so it is adopted *there*, not here.
- **C — bespoke recipe schema (WE-owned JSON handed to the author).** *Rejected.* A WE-owned project-facing
  format the author receives *instead of* markup is exactly the lock-in *minimize-lock-in* refuses — and the
  shadcn precedent shows it is unnecessary: the distribution wrapper carries plain code, it does not replace
  it. (Note the wrapper itself — a thin manifest *around* the markup, for CLI install/share — is **not** this
  branch; that is Fork 2's preset store and is supported.)

*Sub-decision (settled by A):* a preset additionally emits **(i)** a CEM descriptor of the composed
meta-component (per #626) and **(ii)** the `registry-item`-shaped wrapper that stores/shares it (Fork 2) —
both optional exports around the same plain payload, never substitutes for it.

## Fork 2 — home + shared-registry relationship to #623–626

**Crux.** Where the assembler lives and what it shares with the Web Docs catalog/story pipeline (#623–627).
The assembler is an **authoring** surface; #623–626 is a **catalog/inventory** surface — distinct concerns
that must not drift. Classification: the assembler is **devtools** (a tool consulted at author time, not a
running-app seam) → zero lock-in, no protocol; the preset store is a **registry** it reads.

- **A — stand-alone devtools surface, consumes the shared registries read-only. ✅ recommended.** The
  assembler is its own authoring tool (devtools), reading [we:workbenchFeatures.json](../src/_data/workbenchFeatures.json)
  / [we:workbenchTools.json](../src/_data/workbenchTools.json) as the shared source of truth for feature
  vocabulary, plus a new **WE-owned preset registry in the shadcn `registry-item` shape**
  (`{name, type, composesBlocks/Intents, files:[{path, content}]}`) for the presets themselves — rather than
  minting a rival preset registry. One vocabulary, two consumers (catalog renders it; assembler authors
  against it) — mirrors the constellation's "one capability, many consumers" pattern and honours
  bias-toward-separation (authoring tool ≠ served-product surface).
- **B — a mode inside the Web Docs surface (#627).** *Rejected as default.* Folding the assembler into the
  catalog surface as an "author" tab gives tighter integration, but couples an authoring tool's lifecycle to
  the served-product surface and blurs the catalog/authoring split the epic is built to keep clean.
- **C — fully independent, own preset registry.** *Rejected.* Simplest in isolation, but guarantees the drift
  the epic explicitly warns against ("reconcile homes and shared registries so they don't drift") — duplicating
  vocabulary `workbench*` already models.

*Sub-decision (settled by A):* the **preset store format** reuses the shadcn `registry-item` *shape*
(proven, CLI-friendly, native-ecosystem) as a WE-owned registry file — distinct from the `workbench*`
vocabulary it also reads.

---

## Context (not part of the call)

### Why these gate the slice (not deferred)

Unlike #569/#143 (deferred-until-release), this is **not** parked: every prospective #646 slice — the
assembler shell and each preset — emits a recipe (Fork 1) and needs a home/registry (Fork 2), so a slice
drawn before this lands would bury Fork 1 and guess Fork 2. Ratify via `/decision`, then re-run
`/slice 646` — it splits into a foundational slice A (shell + reveal-nav preset, in the decided format)
→ one `task` per additional preset (command palette, filter bar, hovercard, toolbar, date-range).

### Coupling to #626 (CEM)

[#624](/backlog/624-inventory-the-component-workbench-docs-tool-landscape-storyb/) flagged CEM as *both* an ingest
source *and* a format Web Docs should emit; [#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-/)
(prepared) recommends adopting CEM as a new WE `protocol` for component-API metadata. This decision inherits
that: the assembler's CEM export rides #626's protocol, it does not mint its own — which is why the two were
flagged "decide together." Fork 1's payload (composition wiring) and #626's CEM (API surface) are different
layers, so there is no conflict — only reuse.
