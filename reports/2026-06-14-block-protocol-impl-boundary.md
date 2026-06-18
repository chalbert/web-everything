# The block protocol / implementation boundary — what is a block protocol, where does it live

**Date**: 2026-06-14
**Point**: #641 is the blocks analogue of the #606 plugs ruling. #606 already settled the impl-home axis (implementation → `@frontierui`, WE keeps the contracts, consumes impl as a #604 client — and explicitly named "block protocols" among the WE-kept contracts). So #641's genuinely new question is narrow: *what IS a block protocol* — which artifact in WE expresses a block's contract. The prior-art survey (CEM / Open UI / APG) says WE already authors that contract: `fui:blocks.json` (structural, CEM-shaped) + `block-descriptions/{id}.njk` (behavioral, Open UI/APG-shaped). The block protocol = that pair, with `sourcePath` repointed from the vendored WE copy to the canonical `@frontierui/blocks` impl.
**Plan file**: (none — focused `/prepare 641`)
**Research page**: `/research/block-protocol-contract/`
---

## Question

WE's top-level `blocks/` are byte-identical vendored copies of `frontierui/blocks/` (e.g. `we:navigation/NavListBehavior.ts`, `we:registerNavigation.ts`, `we:transient/TransientElement.ts` all diff-clean) — the same copy-paste/silent-drift hazard #170 flagged for plugs. The intended target (per the user, restated in #606's context section) is **WE blocks = protocols (contracts), FUI blocks = implementation**. #641 must decide: (1) what a "block protocol" *is*, (2) where it lives, (3) how to dedup the duplicated implementations.

## Recommendation (forks prepared)

- **Fork 1 — what is a block protocol.** **A: the existing `fui:blocks.json` entry (formalized as a CEM-aligned structural contract) + its `block-description` (the Open UI/APG behavioral spec)**, with `sourcePath` repointed to the FUI impl. Rejected: minting per-block `we:protocols.json` entries (over-formalization — blocks aren't cross-project conformance contracts) and a TS-interface SoT (impl-shaped, weakest standards-alignment).
- **Fork 2 — impl home + dedup.** **A: FUI owns canonical `@frontierui/blocks`; WE deletes its byte-identical vendored `blocks/` and consumes `@frontierui/blocks` as a #604 client** — the direct #606 analogue. Rejected: WE-owns (blocks are application implementation) and standalone package (over-engineering), same as #606.
- **Fork 3 — impl-less block protocols.** **Yes — a contract may precede its impl** (like a `concept` protocol). But migration order is load-bearing: the **9 WE-only families** with real impl code (audit, background-task-surface, data-grid, lifecycle, master-detail, selection, stepper, tree-select, type-ahead) must flow to `@frontierui/blocks` **before** WE's `blocks/` is deleted, or that work is lost (the #170 bidirectional-merge hazard). File as the execution build.

Confidence: **high** on Forks 1–2; **med-high** on Fork 3 (principle clear, per-family classification is execution).

## Key findings

- **#606 already drew the boundary and named the artifact.** The plugs ruling lists `we:plugs.json, intents, protocols, block protocols` as the contracts WE keeps, and classified FUI's `blocks/` as "the application implementations … correctly outside the standard." #641 doesn't re-open *where impl lives* — it only formalizes *what the WE-side contract is*.

- **Prior-art survey (research agent).** The ecosystem expresses a component contract along two axes: **structural API → Custom Elements Manifest** (`we:custom-elements.json`, community schema v2.1.0 — attributes/properties/events/slots/CSS-parts/custom-props/methods; live analyzer + LSP + MCP; shipped by Shoelace/Web Awesome, Carbon, Spectrum, Fluent) and **behavioral/a11y → Open UI + WAI-ARIA APG** (anatomy→parts→states→behaviors + role/keyboard tables + conformance tests). TS `.d.ts` is treated as an *input* the CEM analyzer reads, not the portable contract. The **W3C UI Specification Schema CG** (chartered Aug 2025 to define an impl-agnostic JSON meta-model aligned to Open UI) is direct evidence the JSON-meta-model target is recognized — but it **closed 21 May 2026**, a caution against bespoke new schemas vs. extending CEM.

- **WE already has the contract surface.** `fui:src/_data/blocks.json` entries carry `implementsIntent`, `exports`, `events` (with detail shapes), `traits`, `webStandards`, `designDecisions`, `sourcePath` — a CEM-shaped descriptor in all but name. `src/_includes/block-descriptions/{id}.njk` is the Open UI/APG behavioral half. The only field that lies is `sourcePath` (points at the vendored WE copy → repoint to FUI).

- **The trees are asymmetric (on-disk survey).** WE has 9 families FUI lacks; FUI has `droplist` (rich composite) + `traits` (lazy mixins) WE lacks. The shared 12 families (navigation, transient, tabs, for-each, view, stores, parsers, text-nodes, resource-loader, router, renderers, attributes) are byte-identical. So dedup is not symmetric: WE-only impls must migrate to FUI first.

## Files Created/Modified

| File | Action |
|------|--------|
| `we:reports/2026-06-14-block-protocol-impl-boundary.md` | Created (this report) |
| `we:src/_data/researchTopics.json` | Added `block-protocol-contract` topic |
| `we:src/_includes/research-descriptions/block-protocol-contract.njk` | Created write-up |
| `we:backlog/641-decide-the-block-protocol-implementation-boundary-we-blocks-.md` | Rewritten to prepared-fork shape; `preparedDate` stamped |
