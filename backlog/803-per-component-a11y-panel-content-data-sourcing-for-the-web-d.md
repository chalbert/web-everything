---
type: decision
workItem: story
size: 3
parent: "623"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-component-a11y-panel-sourcing.md
relatedProject: webdocs
tags: [webdocs, accessibility, a11y, wai-aria, panel-sourcing, decision-prep]
---

# Per-component a11y-panel content + data sourcing for the Web Docs /blocks/ pages

Decide what a per-component accessibility panel on `/blocks/{id}/` surfaces and where its data comes from.
One of three panel-data decisions carved from
[#727](/backlog/727-web-docs-blocks-uniform-live-example-slot-on-every-per-compo/)
(siblings: [#801](/backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table/) props-table,
[#802](/backlog/802-per-component-token-table-data-sourcing-for-the-web-docs-blo/) token table), under the
Web Docs feature-pipeline epic [#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/).

**Prepared 2026-06-16; collapsed under the fork checklist 2026-06-17.** Prior art surveyed, `/research/`
topic [`component-a11y-panel-sourcing`](/research/#component-a11y-panel-sourcing) published. The prep stamp
framed this as **three forks** — running the *fork-existence test* + *fork-is-not-prioritization* checklist
(we:backlog-workflow.md) over them, **all three fail to be genuine either/or choices**: this is a #088-shape
decision — **one merit ruling (the layered model) + a supported/deferred list, zero A/B**. Full grounding:
[`we:reports/2026-06-16-component-a11y-panel-sourcing.md`](../reports/2026-06-16-component-a11y-panel-sourcing.md).

## Grounding digest (verified 2026-06-17)

- **Authored a11y metadata already exists on the block — and is unrendered.**
  [`fui:src/_data/blocks.json`](../src/_data/blocks.json) carries an optional `webStandards` field on
  **29 of 75** blocks (first at `fui:blocks.json:25`), shaped `{<concern>: {usage, reference}}` —
  e.g. `wizard.webStandards.ariaCurrentStep` = `{usage: "…carry aria-current=\"step\"…", reference: <MDN aria-current>}`.
  Across all entries the `reference` field points at the **contract** (95 MDN + 12 W3C/WAI incl. APG, a few
  Open-UI/WHATWG). **[`we:src/block-pages.njk`](../src/block-pages.njk) renders none of it** (`grep webStandards`
  → 0) — the realization layer is authored but has no panel.
- **Intents carry no a11y field.** [`we:src/_data/intents.json`](../src/_data/intents.json) has no
  `a11y`/`aria`/`wcag` slot (verified — intent keys: `id, name, status, summary, dimensions, description,
  requiresCapabilities, designSystemResearch, uxResearch, researchGaps, events`). An intent a11y contract is
  a **new field**, not a projection.
- **Axe is route-level, not per-component.** #770 (resolved) ships
  [`we:tests/a11y/rendered-site-a11y.spec.ts`](../tests/a11y/rendered-site-a11y.spec.ts) +
  [`we:tests/a11y/route-allowlist.ts`](../tests/a11y/route-allowlist.ts); `GATED_ROUTES` include the `/blocks/`
  **index** but **not** `/blocks/{id}/`, and store no per-component metadata.
- **The documented component renders inside a cross-origin FUI iframe.** The `fuiDemo` shortcode
  ([`we:.eleventy.js:54`](../.eleventy.js)) embeds a FUI-hosted demo via a sandboxed cross-origin `<iframe>`.
  Per #732, axe run from the WE lane **cannot traverse** into the frame — it would audit the WE doc-page
  chrome, not the FUI component. FUI owns the impl *and* its rendered display (the no-leakage boundary;
  #701/#700/#732).

## The ruling — one merit call (ratify)

A per-component a11y surface distinguishes **three layers** (the IBM Carbon best-practice; every mature
a11y-doc surface keeps them separate). The merit decision is **which layer lives where**, plus the
**never-merge** invariant — there is no "pick a source" either/or:

| Layer | Home (constellation) | What renders on `/blocks/{id}/` |
|---|---|---|
| **Contract** — what the *pattern* requires (APG keyboard/roles) | **intent** | the existing per-concern `reference` link (MDN/APG/WAI), Carbon "Resources" |
| **Realization** — how *this* block delivers it (impl-specific notes) | **block** (`webStandards`) | one row per concern → `usage` prose + "Reference ↗" link |
| **Verification** — automated axe/AVT, dated & freshness-bearing | **conformance** (FUI-owned for FUI blocks) | nothing today — FUI-published no-leakage feed when it exists |

**Invariant (never merge the layers).** A panel that inlines the contract next to authored prose with no
verification implies a sufficiency claim axe can't back (axe covers ≤ ~57% of WCAG); automated results are a
**separate dated attestation**, never authored prose. This is the one forced rule of the decision.

Why each apparent "fork" is **not** a genuine A/B (checklist applied):

- **Realization SoT → forced invariant, not a weigh.** "Render `webStandards`" vs "mint a parallel a11y
  schema" is not two end-states: a parallel schema is a **dual source of truth** for data 29/75 blocks
  already author (a merit defect — drift), and the item's own prep conceded a richer schema is *"a later
  display refinement [that] can structure the bag"* — i.e. a **refinement of** `webStandards`, not a rival.
  Deriving the panel from the intent instead is **broken** (intents carry no a11y field). Ruling: **the block
  (`webStandards`) is the realization SoT**; structuring the bag for display is a supported later refinement.
- **Contract layer → prioritization in a fork's clothing (dissolved).** "Link out via `reference`" and "mint
  a first-class intent a11y contract" are **additive, not exclusive** — the best end-state has **both**. The
  prep text self-convicted: *"Not broken — the richer Carbon model in full — but premature… Sequencing, not
  exclusion"* (the #465 pattern). On merit the end-state includes the intent contract; **when** to build it
  ("a 56-intent lift, no second consumer yet") is normal burndown ordering, filed as its own item — not a
  branch. The intent a11y contract classifies cleanly to the **intent** layer (declarative "what the pattern
  requires"; no swappable-vendor story → not a Protocol).
- **Verification → forced invariant, not a weigh.** A per-block axe lane / live in-page axe is **broken**:
  `fuiDemo` is cross-origin, so axe audits WE chrome, not the FUI component, and conformance is FUI-owned
  no-leakage data (#475). Ruling: **verification lives at FUI as a published no-leakage feed** (surfaced as a
  dated attestation when it exists); the route-level #770 gate stands. "None in v1" is a **blockedBy
  dependency on the FUI feed**, not a deferred design choice.

## Supported by default (not decisions)

- Rendering `webStandards` as the realization panel **and** linking out to each concern's `reference` for the
  contract layer — both ship together; they are not rivals.
- Later structuring the `webStandards` bag into a typed display shape (keyboard / roles / labeling) — a
  display refinement of the same SoT, no new authored data.

## Build spinouts (separately-prioritized — existence ratified here, schedule is just ordering)

1. **Render the panel** → **[#826](/backlog/826-render-the-accessibility-web-standards-panel-on-blocks-id-fr/)** (filed, agent-ready, blockedBy this item).
   Add an "Accessibility & Web Standards" `section-card` to
   [`we:src/block-pages.njk`](../src/block-pages.njk) rendering `block.webStandards` (concern → `usage` +
   "Reference ↗" link), with graceful absence (no field → no panel, same as `fuiDemo`/`composesIntents`).
   The primary agent-ready slice.
2. **Backfill `webStandards`** on the 46/75 blocks still missing it → **[#827](/backlog/827-backfill-webstandards-a11y-metadata-on-the-blocks-still-miss/)**
   (filed, blockedBy #826) — an authoring task; sparse coverage is a **prioritisation** input for *when*, not
   a branch of this decision.
3. **Mint the intent a11y contract** (new intent field: required keyboard interactions, ARIA roles/states,
   APG pattern) — open when a second consumer appears (the "stays unregistered until a second consumer"
   pattern, #732/#728). Renders the "required by intent → realized by this block" mapping.
4. **FUI per-component verification feed** — opens only if/when FUI publishes per-component axe as a
   consumable no-leakage output (#475), surfaced as a Carbon-AVT-style dated attestation.

---

## Context — why the prep framing was wrong

The prep pass stamped `preparedDate` over a **three-fork** template without first running the
fork-existence test (we:backlog-workflow.md: *"Run the fork-existence test first and let it shrink the item… a
prepared decision that lists five 'forks' where four are 'support all' is verbose, not thorough"*). Under the
checklist the three forks collapse: two are **forced invariants** (one broken branch each — intent-derived
realization; cross-origin axe), one is **prioritization** wearing a fork's clothing (link-out + intent
contract are additive). Net: **one merit ruling (the layered model + never-merge invariant) + a
supported/deferred list**, the #088 shape. The original "Recommended path at a glance" fork table and the
three `## Fork N` sections were removed in this collapse; their substance is preserved in the ruling above.
