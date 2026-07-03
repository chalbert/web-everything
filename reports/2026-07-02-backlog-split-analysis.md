# Backlog split analysis — 2026-07-02

Focused runs: `/slice 2079` · `/slice 2093` · `/slice 2021` · `/slice 2015` · `/slice 2094` · `/slice 2025`.

---

# `/slice 2079` — Author W3C-spec-shaped normative standards for every WE standard

Unsliced epic (`kind: epic`, `size: 13`, no children). Rubric (1) settled at the parent level; the body's
seed decomposition is "skeleton first, then one slice per standard".

## Work-investigation pass

The body's "every current standard" was verified against the real registry surface — and its seed
decomposition ("one slice per standard") does not survive contact with it:

- **"Every current standard" enumerates to 279 registry entries** across four one-file-per-standard
  registries: **81 blocks** (`we:src/_data/blocks/`, loader `we:src/_data/blocks.js:1-18`), **98 intents**
  (`we:src/_data/intents/`, `we:src/_data/intents.js:1-15`), **59 plugs** (`we:src/_data/plugs/`,
  `we:src/_data/plugs.js:1-12`), **41 protocols** (`we:src/_data/protocols/`,
  `we:src/_data/protocols.js:1-12`). "One slice per standard" would author ~279 stories at once — the
  explosion the conservative instinct refuses.
- **Current write-up depth is wildly uneven, and mostly too thin to spec.** A block has a JSON descriptor
  + njk prose (`we:src/_data/blocks/button.json:1-28` + `we:src/_includes/block-descriptions/button.njk:1-36`);
  an intent is JSON-only with an inline HTML description (`we:src/_data/intents/action.json:1-68`); a plug is
  a **10-line bare registry entry** (`we:src/_data/plugs/customattribute.json:1-10`); a protocol is an
  8-line JSON pointing at a section of its owning project page
  (`we:src/_data/protocols/analytics-vocabulary.json:1-8`). Project-level statuses are 17 `concept` / 4
  `draft` / 23 `poc` (`we:src/_data/projects/*.json`). A normative MUST/MUST-NOT spec for a 10-line `poc`
  stub is not authoring — it's undone design work in disguise.
- **Zero RFC-2119 language exists in any standard today.** Grep across all four registry dirs: no
  MUST/SHALL/SHOULD. Normative rules exist only in the governance layer
  (`we:docs/agent/block-standard.md:96-129`, gate `we:scripts/check-standards.mjs`) — centralized, not
  per-standard.
- **The shape template is real and citable.** The #2074 conformance table — enumerated well-formed
  natures + typed `define()` errors (`AmbiguousPayloadError`, `MissingRegionCloseError`,
  `DelimiterCollisionError`, warn-cases) — lives at
  [we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:145-162](../backlog/2074-customnoderegistry-node-kind-extensibility-standard.md),
  codified rules at `we:docs/agent/block-standard.md:554-576`. It self-describes as "the conformance spine a
  spec-shaped write-up (epic #2079) turns into normative MUST/MUST-NOT prose".
- **No skeleton, no house style, no home exists.** There is no spec-skeleton template anywhere
  (`we:docs/agent/` is schema reference, not authoring template), and no decided surface for where a
  per-standard normative spec would live (njk description section? new markdown collection? JSON field?).
  #1792 (resolved) built a read path for `we:docs/agent/*` governance prose, not per-standard specs — the
  closest catalog precedents are the protocols index-only shape (`we:src/protocols.njk:50-75`) vs. the
  research-topic detail-page shape (`we:src/research-topic-pages.njk:1-11`).

## Verdict — partial split (roadmap epic; most mass is design-gated)

The epic buries **two real forks** the seed decomposition skips over:

1. **Home + form** — where a normative spec lives and in what format (per-standard file? njk section? a
   new collection with a gate?), plus the skeleton house style itself (section order, RFC-2119
   boilerplate, conformance-class + error-model convention, IDL convention).
2. **Scope + maturity policy** — which of the 279 owe a spec at which status tier. Speccing `concept`/`poc`
   stubs normatively is premature; a maturity ladder (e.g. `active` blocks first, stubs exempt until
   designed) decides the actual work-list — and therefore the contents of every downstream slice.

Per rubric (1) these cannot be split away — they are carved into a `kind: decision` card, and everything
downstream of them stays could-not-split-here.

## Could split — #2079 (executed 2026-07-02: D = #2096, P = #2097)

| slice | kind | size | home | scope |
|-------|------|------|------|-------|
| **D = #2096** Spec register — home, skeleton house style, scope policy | decision | 3 | webeverything backlog | The two forks above (+ pilot choice). Goes through `/prepare` → ratify; codify step authors the skeleton doc + RFC-2119 boilerplate. |
| **P = #2097** Pilot spec — CustomNodeRegistry (#2074) | story | 3 | per D's home ruling | Apply the ratified skeleton to the one standard whose conformance spine already exists (`we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:145-162`). Demoable: a rendered spec-shaped write-up + gate green; becomes the worked example every wave copies. `blockedBy #2096`. |

### DAG

```
#2096 → #2097 → (future per-category waves — not carved yet, see below)
```

A 2-chain, but incremental delivery is genuine: D resolves as statute value on its own (the skeleton +
scope policy), P ships a demoable worked example. Both are agent-ready-able (D via `/prepare`, P batchable
once D lands).

## Could not split (here) — the authoring waves

| scope | rubric condition failed | unblocking action |
|-------|-------------------------|-------------------|
| Per-category authoring waves — blocks (81) · intents (98) · plugs (59) · protocols (41) | **(1) design-gated** — their work-list (which entries owe a spec) and their unit shape (per-standard? per-cluster?) are both decided by D's scope policy; carving sub-epics now would scaffold shells whose contents an open decision still controls. Also (3): per-slice sizes unknowable until the pilot calibrates effort-per-spec. | **Resolve D, land pilot P, then re-run `/slice 2079`** — it then carves per-category sub-epics (roadmap mode, each a future `/slice` candidate) sized against the pilot's measured effort and D's maturity ladder. |

The gating is encoded in the DAG, not left buried: on execution the epic's body is refreshed to umbrella
framing with a pointer to D, and D's card carries the forks.

## Execution notes (executed 2026-07-02)

- #2079 is already an epic — no story→epic conversion; its residual `size: 13` dropped (sized
  children would double-count; `check:standards` errors).
- Scaffolded D → **#2096** (`--kind=decision --size=3`) and P → **#2097** (`--kind=story --size=3
  --blocked-by=2096`), both `--parent=2079`.
- #2079's digest refreshed to umbrella framing; gate green; backlog count +2.

---

# `/slice 2093` — Adopt and extend the CustomNode recipe model across FUI

Unsliced epic (`kind: epic`, `size: 13`, no children). Rubric (1) settled at the parent level; the body's
seed is "(1) migrate the existing delimiter plugs onto customNodes, (2) add the new recipes; each plug and
each recipe a slice". The seed was verified against the real FUI tree and the ratified statute — it
mostly survives, with **one scope correction** (below).

## Work-investigation pass

All impl surface lives in FUI (WE holds zero impl); citations are `fui:` paths.

- **No `customNodes` / `CustomNode` exists anywhere in FUI yet** — the ratified model
  (`we:docs/agent/block-standard.md:554-580`, #2074) is build-pending. The registry substrate it extends is
  real: `fui:plugs/core/HTMLRegistry.ts` (84 LOC — constructor↔name map + shared `whenDefined` resolver
  per the #1986 amendment) over `fui:plugs/core/CustomRegistry.ts` (extends-chain `get()`).
- **The value:'shown' polyfill already ships** as webexpressions: `CustomTextNodeParser`
  (`fui:plugs/webexpressions/CustomTextNodeParser.ts:34-121`) carries `openingIdentifier` /
  `closingIdentifier` — literally the `static open`/`close` pair, author-declared exactly as Fork 3
  ruled; the `CustomTextNodeRegistry` TreeWalker + MutationObserver walk
  (`fui:plugs/webexpressions/CustomTextNodeRegistry.ts:46-381`) is the Text-host materializer;
  `InterpolationTextNode` (`fui:blocks/text-nodes/interpolation/InterpolationTextNode.ts:47`) is the
  `{{ }}`/`[[ ]]` consumer, wired at `fui:plugs/bootstrapUnplugged.ts:156-165`.
- **The invisible-marker polyfill already ships** as webdirectives comments: `CustomComment`
  (`fui:plugs/webdirectives/CustomComment.ts:27-45`) + `CustomCommentRegistry` re-prototyping walk
  (`fui:plugs/webdirectives/CustomCommentRegistry.ts:50-117`). #2074's statute-overlap section names it
  explicitly: "CustomCommentRegistry polyfills the invisible recipes."
- **The region/template path has a precedent, not an impl**: the transform→`<template>` stamping in
  `fui:blocks/view/ViewIfDirective.ts:147-163` and `fui:plugs/webdirectives/CustomTemplateType.ts:42-68` —
  but no delimiter-keyed region parsing (regionClose matching, nesting stack) exists.
- **Capability-parity machinery exists to reuse**: the `observedAttributes` MutationObserver in
  `fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:56-246` (#1986 rule 4).
- **Tests**: vitest per plug — `fui:plugs/webexpressions/__tests__/unit/` (9 files),
  `fui:plugs/webdirectives/__tests__/unit/` (10 files); new plug slices follow the same layout.

**Scope correction (statute vs body).** The body lists "webdirectives CustomComment/Template/Script" as
migration targets. Per ratified Fork 2 (#2074, `we:docs/agent/block-standard.md:577-580`),
`CustomTemplateType`/`CustomScriptType` are the **tag/attr keyings — framed, not re-owned**; migrating
them onto `customNodes` is the rejected alternative (b). Only the delimiter-keyed surfaces migrate:
webexpressions (value recipes) and the comment grammar (invisible recipes' pre-JS authoring form). The
epic digest is refreshed to match on execution.

## Could split — #2093 (partial: 6 slices; include-marker deferred)

| slice | kind | size | scope (grounded) |
|-------|------|------|------------------|
| **S1** Mint `CustomNode` + `customNodes` registry + migrate value:'shown' | story | 5 | New plug `fui:plugs/webnodes/` extending `HTMLRegistry`. `CustomNode` base with the ratified static surface; `define(class)` conformance errors (`AmbiguousPayloadError`, `MissingRegionCloseError`, `DelimiterCollisionError`, the two warn cases). Consumer in the same slice (no consumer-less registry): re-express the interpolation path — parser `open`/`close` from statics, the `CustomTextNodeRegistry` walk as the Text-host materializer, bootstrap re-key at `fui:plugs/bootstrapUnplugged.ts:156-165`. Demo: `{{ price }}` via `customNodes.define`. |
| **S2** value:'hidden' recipe (`{=` compute-no-emit → Comment) | story | 2 | Reuses S1's parse walk; Comment/stripped materialization; template-comment fixture (`{= track(x) }`). |
| **S3** invisible directive marker recipe (`{@` rendered:false + attrs) | story | 3 | Marker nature; `observedAttributes` ride the open marker, change-reaction via the #1986 rule-4 observer pattern; portal-style fixture. |
| **S4** comment-grammar bridge — `CustomCommentRegistry` materializes invisible recipes | story | 3 | The pre-JS-invisibility authoring path (#2074 Risk 1): the comment walk reads `customNodes` definitions authored as `<!--@… -->`; keeps #1986's registry as the polyfill instance the statute says it is. |
| **S5** region inert recipe (`{#…}{/…}` → `<template>`) | story | 5 | Delimiter-keyed region parsing: `regionName`/`regionClose` name-echo matching + nesting match-stack (#2074 Risk 2); materialize via the `fui:blocks/view/ViewIfDirective.ts:147-163` transform→template path. |
| **S6** region live recipe (children:'live' → element host) | story | 3 | Shares S5's region stack; context-provider fixture (`{#ctx}` — zero render effect). |

### DAG

```
S1 ─┬→ S2
    ├→ S3
    ├→ S4
    └→ S5 → S6
#1989 (open decision, residue marker grammar) → S5
```

S1 is immediately batchable; S2/S3/S4 run independently in parallel once it lands (real independence,
rubric 4). S5/S6 chain behind #1989 — the region recipes' applied-residue/boundary markers are exactly
that open decision's grammar (already carved, so the fork is an edge, not a burial; coordinate with
active #2068, which is reconciling today's runtime markers). Re-estimated 21 pts vs the body's 13 —
the region machinery is bigger than the seed implied.

## Could not split (here)

| scope | rubric condition failed | unblocking action |
|-------|-------------------------|-------------------|
| include/outlet marker recipe (`{>` rendered:true) | **(1) design-gated** — what a named partial resolves against (snippet source, parameterization) is precisely the open snippet+render decision [#1980](/backlog/1980-directive-proposal-snippet-render-named-parameterized-reusab/) (prepared, unratified). A slice now would bury that fork's answer in impl. | **Ratify #1980**, then carve the include recipe against its ruling (blockedBy S1). |
| "Migrate CustomTemplateType/CustomScriptType onto customNodes" (body claim) | **not a slice at all** — contradicts ratified Fork 2 (tag/attr-keyed framed-not-owned; rejected alternative b). The framing cross-reference is already codified. | None needed — scope correction: refresh the epic digest on execution. |

**Open question to register:** #2074 deferred the **reserved-delimiter-family policy** (which `open`s are
platform-reserved — the hyphen-rule analogue) "to a child" that was never filed. It gates no slice here
(`DelimiterCollisionError` is normative and buildable without it), but the deferred fork should get its
own `kind: decision` card rather than living only in #2074's body.

## Execution notes (on approval)

- #2093 is already an epic — no conversion, but **drop its residual `size: 13`** and refresh the digest
  to statute-shaped umbrella framing (removing the Template/Script migration claim, pointing at #1980 for
  the include recipe).
- Scaffold S1–S6 `--parent=2093`; edges: S2/S3/S4 `--blocked-by=<S1>`, S5 `--blocked-by=<S1>,1989`,
  S6 `--blocked-by=<S5>`.
- File the reserved-delimiter-family policy decision card (parked or open, user's call).
- Sibling DAG honesty: [#2094](/backlog/2094-framework-flavored-delimiter-bundles/) (delimiter bundles)
  presupposes the registry — add `blockedBy: <S1>` to it.
- Gate `npm run check:standards`; confirm backlog count rose by the scaffolded count.

---

# `/slice 2021` — Dogfood the WE-docs detail-page + content templates onto WE components (sweep)

Unsliced epic (`kind: epic`, `parent: 777`, no children, no `size`). Rubric (1) settled at the parent
level. Its stated gate is met: keystone **#2016 (SSR render path) is resolved**, first index conversion
**#2019 resolved**, **#2018/#2020 active** — the pattern is proven at scale, so authoring the slices now
is exactly what the body scheduled. The `blockedBy: ["2016"]` edge is cleared (green chip), not stale.

## Work-investigation pass

Full read of the in-scope templates plus a chrome census across all of `we:src/*-pages.njk` and the
content pages. The body's seed ("slice per template family") mostly survives, but the real seams differ
from its framing in three load-bearing ways:

- **The scope list undercounts by ~2×.** The body names 5 detail generators + 3 content pages; the real
  surface is **13 detail generators** (`we:src/adapter-pages.njk`, `we:src/backlog-pages.njk`,
  `we:src/block-pages.njk`, `we:src/capability-pages.njk`, `we:src/capability-adapter-pages.njk`,
  `we:src/demo-pages.njk`, `we:src/intent-pages.njk`, `we:src/plug-pages.njk`, `we:src/project-pages.njk`,
  `we:src/research-topic-pages.njk`, `we:src/resource-pages.njk`, `we:src/rules-pages.njk`,
  `we:src/state-pages.njk`) + 3 content pages (`we:src/research.njk`, `we:src/semantics.njk`,
  `we:src/demos.njk`), ~1,640 lines total. Every one has **zero `we-*` usage** today (grep-verified);
  the index pages are already converted.
- **The chrome is cross-cutting, not per-family.** Three shared patterns dominate:
  (1) the `plug-detail-header` breadcrumb/title/status header in 12 of the 13 generators;
  (2) the `section-card fui-card` panel chrome (~35 instances: `we:src/block-pages.njk` alone has 10+,
  e.g. `we:src/block-pages.njk:49,55,64,84`; intent 6; demo 5; research-topic 5; backlog 4; …);
  (3) the `projectStatus` status-meter macro (`we:src/_includes/project-status.njk:1-8`), imported by 10
  templates. Converting the shared macro/chrome once serves every family — the body's "one slice per
  family" would re-solve this 13 times.
- **The SSR machinery has a real gap the body doesn't name.** #2016/#2019 built *grid-level* shortcodes
  (`weIntentGrid`/`weProjectGrid`, `we:.eleventy.js:289-311`) over a generic batch core
  (`renderComponents`, `we:scripts/lib/component-render-build-hook.cjs:82-97`). There is **no
  template-facing primitive** for "wrap this section's body in a `we-card`" — and a naive per-card
  shortcode would spawn one FUI-CLI subprocess per card (81 block pages × ~10 cards ≈ 800 subprocess
  calls per build; the existing surfaces deliberately render "in ONE subprocess batch"). The foundational
  slice is therefore a **placeholder-macro + per-page splice transform** (the `spliceDataTables`
  transform precedent, `we:.eleventy.js:275-278`) that batches all of a page's card/badge specs through
  `renderComponents` in one call. This is an impl-detail default behind the observable boundary (SSR
  HTML byte-identical to the client `<we-card>` upgrade), not a fork.
- **The status-meter shape is already ratified.** #2019 settled it: status → header `we-badge`
  (render-from-data), the meter row stays trusted HTML in the card body
  (`we:scripts/lib/component-render-build-hook.cjs:246-266`). The header conversion is mechanical
  application of that precedent via the one shared macro — call sites don't change.
- **The table exclusion is now a ruling, not a blocker.** #1964 is **resolved** (contract-or-revert:
  presentational doc tables stay plain `<table class="data-table">`; sortable ones gain the #1867
  `data-*` contract) and the wrap migration closed (#2027 resolved). The `data-table` surfaces in
  `we:src/block-pages.njk` / `we:src/intent-pages.njk` / `we:src/capability-pages.njk` are
  presentational → **already in their ratified end-state**. They stay out of every slice; the epic's
  "excluded until #1964 resolves" lines are refreshed to cite the ruling.
- **Overlap with active siblings is real and encodable.** #2018 (active) owns the shared badge macros
  (`we:src/_includes/backlog-badges.njk`) that `we:src/backlog-pages.njk` imports (ONE source shared with
  the tile — the tile ⊆ detail parity rule, `we:src/backlog-pages.njk:143-155`); the backlog-detail slice
  must ride behind it. #2020 owns `we:src/governance.njk` — not in this epic's surface. (Note:
  `we:src/backlog-pages.njk` also carries uncommitted working-tree edits — another reason it rides last.)

## Verdict — full split (8 slices; foundation first, then mechanical fan-out)

No buried forks: the batching mechanism is an impl detail with transform precedent, the badge/meter shape
is #2019 statute, tables are #1964-ruled. Every slice is card/badge/tag chrome only, lands `size ≤ 3`,
leaves the site fully rendering (per-template conversions are independently demoable), and after S1 the
touched files are disjoint.

## Could split — #2021 (executed 2026-07-02: S1=#2098 S2=#2099 S3=#2100 S4=#2101 S5=#2102 S6a=#2105 S6b=#2106 S7=#2103)

| slice | kind | size | scope |
|-------|------|------|-------|
| **S1** Generic SSR card/badge primitive for templates | story | 3 | `weCard`/`weBadge` placeholder macros + a per-page splice transform batching all of a page's specs through `renderComponents` in ONE subprocess call (precedents: `we:.eleventy.js:275-278` transform; `we:scripts/lib/component-render-build-hook.cjs:82-97` batch). Unit tests beside `we:scripts/lib/__tests__/component-render-build-hook.test.mjs`. Proof-of-life: convert `we:src/semantics.njk` (1 section-card) in-slice. |
| **S2** Shared detail-header status → SSR `we-badge` (+ meter) | story | 2 | Convert `we:src/_includes/project-status.njk` internals to the #2019 shape (badge + trusted meter row); call sites in the 10 importing templates unchanged. `blockedBy S1`. |
| **S3** `we:src/block-pages.njk` panels → `we-card` | story | 3 | The 10+ `section-card fui-card` panels across both tiers. Tables untouched (#1964 end-state). `blockedBy S1`. |
| **S4** `we:src/intent-pages.njk` → `we-card` | story | 2 | 6 section panels + the hand-rolled `standard-card` implementing-blocks grid (`we:src/intent-pages.njk:72-87`) → `we-card` tiles (the `intentTileSpecs` shape). `blockedBy S1`. |
| **S5** `we:src/backlog-pages.njk` → `we-card` | story | 2 | 4 section panels; header keeps the #2018-converted shared badge macros (parity rule intact). `blockedBy S1, #2018`. |
| **S6a** Rich detail generators sweep | story | 3 | `we:src/capability-pages.njk`, `we:src/capability-adapter-pages.njk`, `we:src/demo-pages.njk`, `we:src/research-topic-pages.njk` (~17 panels + headers). `blockedBy S1, S2`. |
| **S6b** Thin detail generators sweep | story | 2 | `we:src/adapter-pages.njk`, `we:src/plug-pages.njk`, `we:src/resource-pages.njk`, `we:src/state-pages.njk`, `we:src/rules-pages.njk`, `we:src/project-pages.njk` (0–1 panels each; mostly header/status chrome). `blockedBy S1, S2`. |
| **S7** Content pages → `we-card` | story | 2 | `we:src/research.njk` `project-card` tiles (`we:src/research.njk:13,35,59`) + `we:src/demos.njk` `standard-card` grid & empty-state panel. `blockedBy S1`. |

Every slice: SSR output correct with JS off; Playwright before/after against the running dev server;
committed interaction test; matching regression lane after each change.

### DAG

```
#2016 ✓ → S1 ─┬→ S2 ─┬→ S6a
              │      └→ S6b
              ├→ S3
              ├→ S4
              ├→ S7
              └→ S5  (also ← #2018, active)
```

S3/S4/S7 are mutually independent and batchable the moment S1 lands; S6a/S6b ride behind S2 because their
mass is header+single-panel chrome. Total 19 pts across 8 slices, all `size ≤ 3`, all batchable.

## Could not split — none

Nothing in #2021's scope fails the rubric. (The presentational tables are not "could not split" — they
are already in their #1964 end-state and simply aren't epic scope anymore.)

## Execution notes (on approval)

- #2021 is already an epic with no residual `size` — no conversion, no size drop.
- Scaffold S1–S7 (`--parent=2021`, `blocked-by` per the DAG; S5 additionally `--blocked-by=2018`).
- Refresh the epic body: scope list corrected to the 13+3 real surface; the "#1964 excluded until
  resolves" lines re-cited to the ruling (presentational tables stay plain per #1964/#2027).
- Gate `npm run check:standards`; confirm backlog count +8.

---

# `/slice 2015` — FUI: migrate transient blocks to wrapper-first (#1962)

Partially-sliced epic (`kind: epic`, `locus: frontierui`; one child — #2028, the resolved base-element
contract decision). Rubric (1) settled at the parent level (#1962 ratified wrapper-first). The body's
seed decomposition (audit → two migration families → reserved-case hardening → consumer cleanup) was
verified against the real FUI tree; it survives with **three staleness corrections**.

## Work-investigation pass

- **The authoritative subclass census is 14 concrete transients** (grep `extends TransientElement` +
  `extends TemporalTransientElement` across `fui:blocks/`): the soft-7 (badge, tag, card, section-card,
  auto-heading, meter, progress — all #1974's scope), filter-chip, button, text-field, number-input, and
  the 3 temporal presets (`DatePickerElement` / `TimePickerElement` / `DatetimePickerElement`,
  `fui:blocks/temporal/TemporalTransientElement.ts:40-52`). **No color/file pickers exist anywhere in
  `fui:blocks/`** (grep empty) — the epic body's "temporal/color/file pickers" list is stale (correction 1).
- **filter-chip is mis-familied in the epic body** (correction 2). The body claims it was "carved into
  #1974 as a behaviour-free leaf", but (a) `we:backlog/1974-expose-transient-vs-light-dom-as-a-configurable-per-project-.md`
  does not mention filter-chip at all, and (b) the code says it's a **single native control**:
  `fui:blocks/filter-chip/FilterChipElement.ts:39-46` resolves to a native `<button>` carrying
  `aria-pressed` + the #1961 `value` identity surface. Per #1962's ratified family rule (single native
  control → persistent wrapper with a real inner native control) it belongs to the **wrapper family** —
  so it gets its own slice here, and the epic digest is corrected on execution.
- **The #2009 clause is settled** (correction 3): #2009 (un-exclude `value` on transient toggles)
  **resolved 2026-07-01** — it shipped *before* the migration, so the body's "close #2009 as superseded if
  it hasn't shipped" contingency is moot; it stands as the near-term mitigation its own body describes.
- **No persistent base class exists in FUI yet** (grep for `childTag`/persistent base: empty). #2028
  (resolved, child of this epic) ratified the contract — `childTag()` hook, host-is-node vs wrap-child,
  **badge is the pilot** — and the pilot + base land inside **#1974** (open, started, `parent: 1963`).
  Every wrapper-family slice therefore rides behind #1974; the cross-epic edge is real, not stale.
- **text-field / number-input are already wrapper-shaped inside**: both build the full
  `<div class="fui-*">…<input>…` structure via their factory in `decorate`
  (`fui:blocks/text-field/TextFieldElement.ts:39-44`, `fui:blocks/number-input/NumberInputElement.ts:34-38`)
  and only self-erase at the end. Migration = make the host persist (keep factory parity, no second
  renderer) — mechanical against the #2028 shape.
- **Temporal presets carry traits across the swap**: author attributes (incl. `calendar-grid` / `clock` /
  `range-coordination`) currently transfer onto the surviving `<input>` by the base
  (`fui:blocks/temporal/TemporalTransientElement.ts:26-37`). Post-migration the host persists and those
  attributes must reach the inner native input instead. Author markup and observable behavior are
  unchanged (attrs still authored on the preset tag; traits still activate on a real native input) — an
  impl-detail forwarding default, not a fork.
- **The reserved-mechanism guard is confirmed missing**: `fui:blocks/transient/TransientElement.ts:75`
  runs `queueMicrotask(() => this.replaceWith(el))` with no `isConnected` re-check (the #1961 rider's
  third leg; idempotence + microtask deferral are already present at lines 54-55/75).
- **WE-side consumers wired to the upgrade**: `we:src/assets/js/backlog-table-sort.js:227-288`
  (document-level click delegation + re-sync after chip self-replace) and
  `we:src/assets/js/home-display.js` (mirrors the selected class). #1960 (open, **prepared** decision,
  locus webeverything) codifies that delegate-on-ancestor contract; once filter-chip persists, the rule's
  forcing case disappears and the card re-scopes to the reserved case.

## Verdict — full split (6 slices)

No buried forks: the wrapper shape per family is #1962 statute, the per-leaf shape test is #2028 statute,
trait forwarding and factory adoption are impl details behind an unchanged observable boundary. Homes are
disjoint directories, every slice lands `size ≤ 3`, and each leaves FUI's vitest + the WE catalog demoable
(un-migrated blocks keep self-erasing until their slice lands).

## Could split — #2015

| slice | kind | size | scope (grounded) |
|-------|------|------|------------------|
| **S1** Harden reserved `TransientElement` with the `isConnected` guard | task | 1 | Add `if (!this.isConnected) return;` inside the deferred replace at `fui:blocks/transient/TransientElement.ts:75` + a disconnect-before-microtask unit test beside `fui:blocks/__tests__/unit/transient/TransientElement.test.ts`. The #1961 rider's third leg; the mechanism stays (reserved case). Unblocked — batchable now. |
| **S2** button → persistent wrapper | story | 2 | `fui:blocks/button/ButtonTransientElement.ts` → host persists containing the real native `<button>`/`<a>` (variant class, icon/label composition, toggle aria move to the inner control). `blockedBy #1974`. |
| **S3** filter-chip → persistent wrapper | story | 2 | `fui:blocks/filter-chip/FilterChipElement.ts` → host persists wrapping the native `<button>`; preserve the #1961 surface (`value` verbatim, `selected`→`aria-pressed` as the one forced rename). `blockedBy #1974`. |
| **S4** text-field + number-input → persistent host | story | 3 | Both keep their factory-built `<div class="fui-*">…<input>` internals and stop self-erasing (`fui:blocks/text-field/TextFieldElement.ts`, `fui:blocks/number-input/NumberInputElement.ts`); factory↔element parity stays single-renderer. `blockedBy #1974`. |
| **S5** temporal presets → persistent wrapper | story | 3 | `fui:blocks/temporal/TemporalTransientElement.ts` → host persists wrapping `<input type="date\|time\|datetime-local">`; trait/config attributes forward to the inner input so calendar-grid/clock/range keep activating on a real native control. `blockedBy #1974`. |
| **S6** WE consumer cleanup + re-scope #1960 | task | 2 | Locus **webeverything**: simplify the chip-upgrade delegation/re-sync in `we:src/assets/js/backlog-table-sort.js:227-288` + `we:src/assets/js/home-display.js` once chips persist; update the prepared #1960 card to the reserved-case scope (card maintenance — its ratification stays #1960's own decision turn). `blockedBy S3`. |

### DAG

```
#1974 (open·started, parent #1963 — soft-7 + #2028 base-class pilot) ─┬→ S2
                                                                      ├→ S3 → S6
                                                                      ├→ S4
                                                                      └→ S5
S1 (independent — batchable immediately)
```

S2–S5 are mutually independent (disjoint block dirs) and batch in parallel lanes the moment #1974 lands.
Total 13 pts across 6 slices. Epic DoD after S1–S6 + #1974: zero concrete subclasses remain transient
(per #1962: "no current block qualifies"), `TransientElement` retained as the hardened reserved mechanism.

## Could not split — none

Nothing in #2015's scope is design-gated: #1962/#2028/#1961 rulings cover every shape question the
slices touch. The one open sibling decision (#1960) is an *edge* (S6 re-scopes the card), not a burial.

## Execution notes (on approval)

- #2015 is already an epic with no residual `size` — no conversion, no size drop.
- Scaffold S1–S6 (`--parent=2015`; S2–S5 `--blocked-by=1974`, S6 `--blocked-by=<S3>`; S1 unblocked).
  S1–S5 `locus: frontierui`, S6 `locus: webeverything`.
- Refresh the epic digest: drop the phantom color/file pickers, move filter-chip to the wrapper family
  (correcting the "#1974 behaviour-free leaf" claim), and replace the #2009 contingency with its settled
  outcome. #1974 keeps `parent: 1963` — the cross-epic edge stays a body pointer, not a re-parent.
- Gate `npm run check:standards`; confirm backlog count +6.

---

# `/slice 2094` — Framework-flavored delimiter bundles

Unsliced epic (`kind: epic`, `size: 13`, no children, `blockedBy: ["2104"]` — the edge the #2093
execution laid). Rubric (1) settled at the parent level. Seed: "one bundle per framework flavor as a
slice, each scored on faithful reproduction" — the delimiter analogue of the #1226 parity program.

## Work-investigation pass

The bundles are authored *over* the #2074 recipe model, whose build is the #2093 split executed earlier
today — so the surface is part-real, part-freshly-filed:

- **No `customNodes`/`CustomNode` exists in FUI yet** (grep = 0 hits) — the registry is #2104 (S1 of the
  #2093 split, open), regions are #2110/#2111 (region inert/live; #2110 itself `blockedBy 2104, 1989`).
  Every bundle writes recipe classes against that API, so every slice rides behind those NNNs — real
  edges now, not placeholders.
- **The expression half has a live precursor**: `fui:plugs/webexpressions/CustomTextNodeParser.ts:34-121`
  already takes free `openingIdentifier`/`closingIdentifier` pairs (mustache `{{ }}` + polymer `[[ ]]`
  shipped, wired at `fui:plugs/bootstrapUnplugged.ts:156-165` and `fui:plugs/expressionsUnplugged.ts`) —
  #2104 re-keys exactly this path, so expression recipes per bundle are near-mechanical.
  **No region matcher exists anywhere** (`regionName`/`regionClose` grep = 0) — region recipes wait on
  #2110's nesting stack.
- **The bundle packaging shape has an in-house precedent**: the `AUTO_DEFINE_FLAVORS` factory map
  (`createStrictExplicitFlavor()`/`createLazyDomFlavor()`/`createBuildParsedFlavor()`) in
  `fui:blocks/renderers/auto-define/CustomAutoDefineRegistry.ts` — a flavor = a factory returning a
  pre-configured registry. A delimiter bundle is the same shape: a factory that `customNodes.define()`s
  a framework's recipe set.
- **Per-bundle scope is statute, not a fork.** #2074's framework-coverage table maps every construct
  (interpolation · raw output · block regions · include · comment · directive · verbatim escape) to a
  recipe nature, and its out-of-scope table rules **attribute-keyed constructs** (Vue `v-if`/`v-model`,
  Angular `*ngIf`, Svelte `bind:`) and **attribute-value interpolation** (`class="{{x}}"`) out of the
  delimiter surface (`we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:119-143`).
  So each bundle's contents are enumerable today from the framework's published grammar + the statute —
  no slice buries a scope call.
- **Test/fixture layout is established**: parser fixtures follow
  `fui:plugs/webexpressions/__tests__/unit/CustomTextNodeParser.test.ts`; registry/lifecycle fixtures
  follow `fui:plugs/webdirectives/__tests__/unit/CustomCommentRegistry.test.ts`.
- **The program template is #1226**: per-target flavor stories under the umbrella, a scoring-harness
  keystone (the #2024 analogue), and the **gap list as the real deliverable** — the epic's stated
  stress-test purpose (the #1243 lesson: a bundle with no measured score is a stub, not a covered
  flavor).

## Verdict — full split (7 slices: scorecard keystone + 6 bundles)

No buried forks (scope is #2074 statute; the include recipe is #1980-gated *inside* #2093's scope, so
bundles record it as a scorecard row, not a blocker). All slices land `size ≤ 5`, are mutually
independent once their keystones land, and each ships demoable (fixture + committed tests + published
scorecard/gap list).

## Could split — #2094

| slice | kind | size | scope |
|-------|------|------|-------|
| **B0** Grammar-fidelity scorecard + shared conformance fixture | story | 3 | The #2024 analogue: per-bundle construct checklist schema — each framework construct scored `reproduced` / `partial` / `out-of-scope-per-statute` (attr-keyed → #1986 registry; attr-value interpolation → sibling surface) / `gap` (model can't express → feeds statute). Fixture pattern mirrors `fui:plugs/webexpressions/__tests__/unit/CustomTextNodeParser.test.ts`; consumer-at-birth: score FUI's own native grammar (`{{ }}`/`[[ ]]` post-#2104) as bundle zero. Gap lists publish as `we:reports/` topics (the #2022 shape). `blockedBy #2104`. |
| **B1** Handlebars/Mustache bundle | story | 5 | The full-nature stress: `{{x}}` expression, `{{{x}}}` raw (distinct `open`), `{{#if}}`/`{{#each}}`…`{{/…}}` name-echo regions, `{{!}}`/`{{!-- --}}` hidden, `{{> partial}}` (scorecard row: pending #1980), `{{else}}` mid-marker (expected model gap — see below). Mustache is the subset, same bundle. `blockedBy B0, #2110`. |
| **B2** Liquid/Jinja bundle | story | 5 | Dual-sigil family `{{ }}` + `{% %}` with **`end`-prefix name-echo** closes (`{% for %}`…`{% endfor %}` — a second declared-close shape), `{% raw %}` verbatim escape (the mandatory escape hatch), `{# #}`/`{% comment %}` hidden. One bundle: the delimiter skeleton is shared; Liquid↔Jinja divergence is expression vocabulary (filters/tags), out of grammar scope. `blockedBy B0, #2110`. |
| **B3** Blade bundle | story | 3 | The sigil-keyword grammar #2074 names as the Fork-3 edge case (`we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md:38`): `@if`…`@endif` (no-bracket open, `end`-fused close), `@verbatim`, `{{ }}` escaped vs `{!! !!}` raw, `{{-- --}}` hidden; `@include` = pending-#1980 row. `blockedBy B0, #2110`. |
| **B4** Angular block-syntax bundle | story | 3 | `{{ }}` interpolation + the v17 block grammar `@if (…) { … } @else { … }`, `@for`/`@empty`, `@switch` — **bare-brace close** (a third close shape); `*ngIf`/`[prop]` documented as out-of-scope rows (attr registry). `blockedBy B0, #2110`. |
| **B5** Svelte bundle | story | 3 | Single-brace `{x}` (shortest legal `open` — literal-brace collision stress), `{#if}`…`{:else}`…`{/if}` (the `{:…}` mid-marker family), `{@html}`/`{@const}` markers. `blockedBy B0, #2110`. |
| **B6** Vue bundle | story | 2 | The firewall proof: Vue's delimiter surface is *only* `{{ }}` (+ the configurable `delimiters` option — parity with recipe `open`/`close` statics); the deliverable is mostly the out-of-scope map (`v-if`/`v-for`/`v-model` → #1986 attr registry rows) and the smallest passing scorecard. No regions needed. `blockedBy B0`. |

### DAG

```
#2104 (S1, open) → B0 ─┬→ B6
                       ├→ B1 ┐
#2110 (S5, ← #2104,    ├→ B2 │
       #1989) ─────────┼→ B3 ├ mutually independent
                       ├→ B4 │
                       └→ B5 ┘
```

B1–B6 are mutually independent (six parallel lanes once B0 + their region keystone land); B6 needs only
B0. Re-estimated 24 pts vs the body's 13 — six real grammars plus a measurement keystone the body's
"each scored" implies but never sized.

**Expected statute gap, deliberately not pre-filed:** mid-region markers (`{{else}}`, `{:else}`,
`@else`/`@empty`) — the ratified static surface has `open`/`close`/`regionName`/`regionClose` but no
mid-marker concept, and three bundles will hit it independently. That is the epic's stress-test purpose
working as designed: the first confirming gap list files the `kind: decision` card with evidence instead
of front-running the model on a guess.

## Could not split — none

Nothing in #2094's scope fails the rubric now that #2093's split is executed and the edges have real
NNNs. (Include/outlet constructs are #1980-gated via #2093's own deferral — encoded as scorecard rows +
body notes, not slice blockers.)

## Execution notes (on approval)

- #2094 is already an epic — no conversion, but **drop its residual `size: 13`** (sized children would
  double-count; `check:standards` errors) and refresh the digest to umbrella framing pointing at the
  statute + this report. Keep `blockedBy: ["2104"]`.
- Scaffold B0–B6 (`--parent=2094`); edges: B0 `--blocked-by=2104`, B1–B5 `--blocked-by=<B0>,2110`,
  B6 `--blocked-by=<B0>`. Tags per bundle: `[custom-nodes, delimiter-grammar, bundle, <framework>]`.
- Gate `npm run check:standards`; confirm backlog count +7.

---

# `/slice 2025` — Author full Fluent + Carbon flavors (next parity targets)

Unsliced epic (`kind: epic`, no children, no residual `size`). Rubric (1) settled at the parent level;
the body's seed decomposition is "one slice per system (Fluent, Carbon)". Both blockers are resolved
(#2017 loader, #2024 harness), so the epic is live.

## Work-investigation pass

The seed decomposition *survives* contact with the tree — the per-flavor method is now a fully-landed,
target-agnostic pipeline, and the two systems touch disjoint files:

- **The repeatable method is real and just shipped.** #2022 (shadcn, resolved 2026-07-02) delivered the
  template artifact set: manifest + token sidecar (`we:design-systems/shadcn.designsystem.json:1-6` +
  `we:design-systems/shadcn.tokens.json:1-35` — full DTCG override, 5 families, ~14 paths), reference set
  (`we:design-systems/shadcn.reference.json`, 3 components / 13 roles), site surface
  (`we:src/_data/designSystems/shadcn.json`), FUI unit test
  (`frontierui:plugs/webtheme/__tests__/unit/shadcnFlavor.test.ts`), and gap-list report
  (`we:reports/2026-07-02-shadcn-parity-gap-list.md`).
- **The harness amortizes the hard part.** #2024's `scoreFlavor(manifest, reference)`
  (`frontierui:plugs/webtheme/conformanceHarness.ts:144-215`) is zero-per-system — every target fact is
  caller-supplied data — and `we:scripts/parity-conformance.mjs` (`npm run parity:score`) auto-loads
  every `we:design-systems/*.designsystem.json`, so a new flavor is picked up by dropping files in place.
  The hand-rolled reachability predicate that made #2022 a `size·8` is now the harness's single source.
- **No fluent/carbon artifacts exist in WE** (`we:design-systems/` holds shadcn · material-like ·
  acme-brand · we-docs only). The named stubs are 5-token hardcoded workbench presets:
  `fluent-like` at `frontierui:workbench/designSystems.ts:62-75` (`#0f6cbd`, 4px radius, Segoe) and
  `carbon-like` at `:76-90` (`#0f62fe`, 0 radius, IBM Plex, compact/immediate) — already in the #747
  manifest shape, so each seeds its slice's `intentDefaults`/`traitDefaults`.
- **No buried fork.** The flavor shape follows the ratified #747 manifest + DTCG-sidecar shape twice
  proven (#2022 full, #2023 seed); "supersede or repoint" the stub is an impl detail with the #1243 →
  `supersededBy` precedent, not a design call. The #1226 order (… Carbon → Fluent) is prioritization,
  not a dependency edge.

## Verdict — clean full split, 2 slices (executed 2026-07-02: F = #2140, C = #2141)

| Slice | kind·size | Scope (file:line-grounded) |
| --- | --- | --- |
| **F = #2140** Fluent 2 flavor + parity gap list | story · 5 | `we:design-systems/fluent.designsystem.json` + `we:design-systems/fluent.tokens.json` (full Fluent 2 DTCG override: `#0f6cbd` accent family, 4px radius scale, solid surfaces, Segoe type/depth — superseding the 5-token stub `frontierui:workbench/designSystems.ts:62-75`) + `we:design-systems/fluent.reference.json` + `we:src/_data/designSystems/fluent.json`; FUI loader test à la `frontierui:plugs/webtheme/__tests__/unit/shadcnFlavor.test.ts`; scored via `npm run parity:score`; gap list under `we:reports/`. |
| **C = #2141** Carbon flavor + parity gap list | story · 5 | Same artifact set for Carbon (`#0f62fe`, no-radius, compact density, IBM Plex type scale — superseding `frontierui:workbench/designSystems.ts:76-90`): `we:design-systems/carbon.designsystem.json` + `we:design-systems/carbon.tokens.json` + `we:design-systems/carbon.reference.json` + `we:src/_data/designSystems/carbon.json`; FUI test; score + gap-list report under `we:reports/`. |

### DAG

```
(#2017 ✓, #2024 ✓ — resolved, no live edges)
        F ─┐
           ├ mutually independent
        C ─┘
```

Re-estimate 5 each (vs #2022's 8): the method, harness, bridge predicate, and report emitter all exist;
the remaining bulk is researching the target system's real token values + authoring 4 data files + one
test + the gap-list write-up. Both slices are Tier-A batchable and touch disjoint files (parallel-lane
safe). Each leaves a demoable state mirroring the shadcn done-state: a flavor that loads through #2017,
re-themes the canonical set, and carries a published score + gap list.

## Could not split — none

Both of the epic's rows are fork-free with resolved design lineage; nothing is design-gated.

## Execution notes (executed 2026-07-02)

- #2025 was already an epic with no residual `size` — no conversion; digest refreshed to umbrella
  framing naming #2140/#2141. `blockedBy: ["2017","2024"]` are both resolved (honest — left as is).
- Scaffolded F → **#2140** and C → **#2141** (`--kind=story --size=5 --parent=2025`, no `--blocked-by`);
  tags `[parity, flavor, fluent|carbon, dtcg]`.
- Gate green; backlog count +2. Both are `/batch`-eligible.
