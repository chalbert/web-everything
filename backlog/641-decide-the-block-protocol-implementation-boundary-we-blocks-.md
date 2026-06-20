---
kind: decision
size: 5
status: resolved
codifiedIn: docs/agent/platform-decisions.md#constellation-placement
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-block-protocol-impl-boundary.md
tags: [blocks, block-protocol, constellation, standard-vs-impl, architecture]
---

# Decide the block protocol/implementation boundary — WE blocks = protocols, FUI blocks = implementation

**Resolved 2026-06-15 — ratified A/A/A (see Ruling below).** This is the **blocks analogue of the
[#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) plugs ruling**. No new design
exists yet; **3 forks** grounded in the published research topic
[`/research/block-protocol-contract/`](/research/block-protocol-contract/) (prior-art survey: Custom Elements
Manifest · Open UI · WAI-ARIA APG · the dead W3C UI-Spec-Schema CG), each carrying a **bold** recommended default.

The narrowing that frames it: **#606 already settled the *impl-home* axis.** It ruled the plugs runtime is
*implementation* → `@frontierui/plugs`, that WE keeps only the **contracts** and consumes the impl as a
[#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) client — and it **explicitly
named "block protocols"** among the contracts WE keeps (`backlog/606-…md`: *"WE keeps the contracts (`we:plugs.json`,
intents, protocols, block protocols)"*). It also pre-classified blocks: FUI's `blocks/` are *"the application
implementations built on top of plugs … correctly outside the standard."* So #641 does **not** re-open where impl
lives — it formalizes the one piece #606 left implicit: **what a WE-side block protocol actually IS**, plus the
dedup mechanics and the WE-only-families wrinkle.

## The axes

The concern decomposes into three orthogonal axes, each pinned to the real tree:

1. **The contract artifact** — what, in WE, expresses a block's contract? WE *already* authors a contract surface:
   `fui:src/_data/blocks.json` entries declare `implementsIntent`, `exports`, `events`, `traits`, `webStandards`,
   `designDecisions`, `sourcePath` (e.g. the `type-ahead` entry, `fui:src/_data/blocks.json` — a CEM-shaped descriptor in
   all but schema name), paired with the prose/ARIA behavioral spec in
   `src/_includes/block-descriptions/{id}.njk`. The one field that *lies* is `sourcePath` — it points at WE's
   **vendored** copy (`fui:blocks/type-ahead/TypeAheadBehavior.ts`), not a contract.
2. **Impl home + dedup mechanics** — the shared 12 families are **byte-identical vendored copies**:
   `we:blocks/navigation/NavListBehavior.ts`, `we:blocks/navigation/registerNavigation.ts`,
   `we:blocks/transient/TransientElement.ts`, `we:blocks/tabs/TabGroupBehavior.ts` all diff-clean against
   `../frontierui/blocks/…`. This is the #170 copy-paste/drift hazard, blocks edition.
3. **Asymmetric families** — the trees are **not** a mirror. WE carries **9 families FUI lacks** (`blocks/audit/`,
   `background-task-surface/`, `data-grid/`, `lifecycle/`, `master-detail/`, `selection/`, `stepper/`,
   `tree-select/`, `type-ahead/`); FUI carries `frontierui/blocks/droplist/` (rich composite) + `traits/` (lazy
   mixins) WE lacks. A naive "delete WE's `blocks/`" would **lose 9 families of real impl** — the #170
   bidirectional-merge hazard.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|-----------|
| 1 — what a block protocol IS | **A: existing `fui:blocks.json` entry (formalized, CEM-aligned) + `block-description`; `sourcePath` → FUI impl** | B: mint per-block `we:protocols.json` entries | High |
| 2 — impl home + dedup | **A: FUI owns `@frontierui/blocks`; WE deletes vendored copies, consumes as #604 client** | (none viable — direct #606 analogue) | High |
| 3 — impl-less block protocols | **A: yes, a contract may precede its impl; migrate the 9 WE-only impls to FUI *before* deleting WE's `blocks/`** | B: keep WE-only families WE-owned indefinitely | Med-high |

---

## Ruling — A/A/A: WE blocks = protocols, FUI blocks = implementation (the #606 blocks analogue)

Ratified 2026-06-15, all three forks to their recommended **A** defaults:

- **Fork 1 — A.** A WE-side **block protocol** *is* the existing `fui:src/_data/blocks.json` entry (formalized as a
  CEM-aligned structural contract: `implementsIntent`/`exports`/`events`/`traits`/`webStandards`) paired with its
  `src/_includes/block-descriptions/{id}.njk` (the Open UI / WAI-ARIA APG behavioral spec). The lying `sourcePath`
  repoints from WE's vendored copy to the canonical `@frontierui/blocks` impl (or a typed `implementedBy`). No new
  schema — extend the surface that already exists, inheriting the CEM tooling vocabulary. (Emitting a real
  `we:custom-elements.json` for tooling is a deferred build, not part of this call.)
- **Fork 2 — A.** **FUI owns canonical `@frontierui/blocks`** (granular sub-package, sibling of `@frontierui/plugs`).
  WE **deletes its byte-identical vendored `blocks/`** and consumes `@frontierui/blocks` as a **#604 client**. The
  mechanical application of the #606 plugs ruling — even more clear-cut, since blocks were already classified as
  application implementation. "WE imports nothing from FU" binds published `@webeverything/*` artifacts, not the docs
  site, so the site/demos consuming `@frontierui/blocks` is the already-ratified #604 seam.
  - **Amended 2026-06-16 by [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/).**
    #604 subsequently landed as #707's **iframe boundary**, which *struck* the WE→FUI import seam this
    bullet leaned on ("WE never imports or renders FUI block code; it only embeds FUI-hosted demos via
    iframe"). So Fork 2-A's "consume `@frontierui/blocks` as a #604 **import** client" is refined: WE
    deletes the **impl** families but **retains a small reference-runtime `blocks/` subset** (blocks whose
    demos exercise a WE *standard* — today `stores/simple`, `renderers/jsx`, `view`, `tabs`), and consumes
    the migrated impl demos via **iframe embed (no import; `@frontierui/blocks` never enters WE's
    `node_modules`)**. The impl-home axis (FUI owns `@frontierui/blocks`) is unchanged.
- **Fork 3 — A.** A block protocol **may exist in WE with no FUI impl yet** (a contract can precede its
  implementation, as `we:protocols.json` `concept` entries already do). The **9 WE-only families** (`audit`,
  `background-task-surface`, `data-grid`, `lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`,
  `type-ahead`) carrying real impl **must migrate to `@frontierui/blocks` *before* WE's `blocks/` is deleted** — the
  #170 migration-order guard (never delete a tree whose content isn't yet content-equal upstream).

**Spun off at resolve:** #657 (formalize the `fui:blocks.json` block-protocol shape + repoint `sourcePath`), #658
(promote `@frontierui/blocks` canonical, migrate the 9 WE-only families, delete WE's vendored `blocks/`, repoint the
#604 seam), #659 (extend the dual-mode/drift conformance check to blocks). Stays consistent with #606 by construction.

---

## Fork 1 — What IS a "block protocol"?

**Crux.** Once a block's concrete code lives in `@frontierui/blocks`, what artifact in WE *is* the contract? WE
already has a candidate surface (`fui:blocks.json` + `block-descriptions/`); the survey
([`/research/block-protocol-contract/`](/research/block-protocol-contract/)) shows the ecosystem splits a component
contract into a **structural** half (Custom Elements Manifest — attributes/props/events/slots/parts/methods) and a
**behavioral** half (Open UI / WAI-ARIA APG — anatomy/parts/states + role/keyboard tables). WE's two existing
surfaces map cleanly onto exactly those two halves.

- **A — The block protocol = the existing `fui:blocks.json` entry (formalized as a CEM-aligned structural contract) +
  its `we:block-description.njk` (the Open UI/APG behavioral spec), with `sourcePath` repointed from the vendored WE
  copy to the canonical `@frontierui/blocks` impl** *(or a typed `implementedBy` field).* **(default)** Reuses the
  surface that already exists; inherits the CEM tooling family's vocabulary without inventing a schema; the JSON
  half is machine-readable and runtime-agnostic (serves the polyglot-reach goal). Formalization work = pin the
  `fui:blocks.json` field set to a CEM-aligned shape and fix the lying `sourcePath`.
- **B — Mint a formal per-block entry in `we:protocols.json`** (a block as a first-class Protocol with a
  `CustomRegistry`/provider contract, like `validation`/`anchor-positioning`). *Rejected:* `we:protocols.json` is for
  **cross-project conformance contracts owned by a project** (`we:src/_data/protocols.json` entries carry
  `ownedByProject`); blocks are WE's own reusable layer, not cross-project conformance seams. Over-formalization —
  and it duplicates the descriptor `fui:blocks.json` already holds.
- **C — Extract TS interface / `.d.ts` files into WE as the contract SoT.** *Rejected:* a `.d.ts` is a
  language-specific implementation artifact, the **weakest** standards-alignment; the ecosystem treats it as an
  *input* the CEM analyzer reads, not the portable contract. A new bespoke schema is also exactly what the W3C UI
  Spec Schema CG tried and abandoned (closed May 2026) — extend the established surface, don't mint one.

**Default: A.** *Sub-decision (non-blocking):* whether to also emit a real `we:custom-elements.json` from `fui:blocks.json`
for IDE/catalog tooling is a deferred build, not a fork — the contract shape is the decision here.

## Fork 2 — Where does the implementation live + how to dedup?

**Crux.** The shared 12 families are byte-identical vendored copies (`we:blocks/navigation/NavListBehavior.ts` et al.
diff-clean vs `../frontierui/blocks/`). Same hazard #170 hit for plugs; #606 already ruled the analogue.

- **A — FUI owns canonical `@frontierui/blocks` (a granular sub-package, sibling of `@frontierui/plugs`); WE
  deletes its byte-identical vendored `blocks/` and consumes `@frontierui/blocks` as a
  [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) client.** **(default)** The
  direct #606 analogue — even more clear-cut than plugs, since blocks were *already* classified as application
  implementation, not even a polyfill/reference-impl borderline. The "WE imports nothing from FU" rule binds
  published `@webeverything/*` artifacts, not the docs site — so WE demos/site consuming `@frontierui/blocks` is
  the already-ratified #604 seam, not an inversion.
- **B — WE owns `blocks/` canonical** (the pre-#606 direction). *Rejected:* blocks are application implementation;
  co-locating impl in the standard layer violates impl-isn't-a-standard and #239, exactly as #606 found for plugs.
- **C — standalone `@webblocks` package / third scope.** *Rejected as over-engineering* (same as #606's C): the
  `@frontierui/*` umbrella already exists and satisfies #239; a third scope is unearned.

**Default: A** (high confidence — it is the mechanical application of the #606 ruling).

## Fork 3 — May a block protocol exist in WE without a FUI implementation?

**Crux.** The trees are asymmetric: WE has 9 families FUI lacks. Fork-2's "delete WE's `blocks/`" would destroy
those 9 real impls unless they migrate first — and separately, a *contract without an impl* must be a legal state
(else WE can't author a block protocol ahead of FUI building it).

- **A — Yes: a block protocol may exist with no FUI impl yet (a contract can precede its implementation), AND the
  9 WE-only families with real impl code must flow to `@frontierui/blocks` *before* WE's `blocks/` is deleted.**
  **(default)** Impl-less contracts are already normal (`we:protocols.json` entries sit at `status: concept` with no
  impl). The migration-order guard is the #170 lesson: never delete a tree whose content isn't yet content-equal
  upstream. Each WE-only family gets classified at build time — genuine impl → migrate to FUI; aspirational/empty →
  keep as a `fui:blocks.json` contract with no `sourcePath`.
- **B — Keep the 9 WE-only families WE-owned indefinitely** (only dedup the shared 12). *Rejected:* leaves impl
  code permanently in the standard layer, contradicting Fork 2's ruling and re-opening the drift hazard for those
  families the moment FUI grows a counterpart.

**Default: A.** The actual per-family classification + migration is the **execution build** (file at resolve, like
#606 spun off the `@frontierui/plugs` extraction) — not part of this decision.

---

## Blast radius / wiring (at resolve)

- **Spin-off builds to file:** (a) formalize the `fui:blocks.json` block-protocol shape + repoint every `sourcePath`;
  (b) promote `frontierui/blocks` to canonical `@frontierui/blocks`, migrate the 9 WE-only families up, delete WE's
  vendored `blocks/`, repoint WE demos/site (the #604 seam); (c) extend the dual-mode/drift conformance check
  (#606's plugs analogue) to blocks.
- **Premise-aligned:** [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) (WE
  consumes FUI blocks — this decision is its contract prerequisite),
  [#170](/backlog/170-plugs-duplicated-across-webeverything-frontierui/) (duplication/drift, plugs edition),
  [#239](/backlog/239-adapter-packages-self-contained-publish/) (npm scope — supports A on both 1 and 2).
- **Ancestor ruling:** [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) — this
  item must stay consistent with it (and is, by construction).

**Graduated to** `none` — ruling A/A/A: WE blocks = protocols [fui:blocks.json + block-descriptions], FUI owns @frontierui/blocks impl; #606 analogue; spun off #657–#659.
