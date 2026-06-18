# Per-component a11y-panel content + data sourcing — decision prep (#803)

**Date:** 2026-06-16 · **Backlog:** [#803](../backlog/803-per-component-a11y-panel-content-data-sourcing-for-the-web-d.md)
· **Sibling preps:** [#801](../backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table.md)
(props-table API), [#802](../backlog/802-per-component-token-table-data-sourcing-for-the-web-docs-blo.md)
(token table) · **Epic:** [#623](../backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i.md)
· **Research topic:** `component-a11y-panel-sourcing`

The third of the three panel-data sourcing decisions carved from #727: decide what a per-component
accessibility panel on `/blocks/{id}/` surfaces and where its data comes from.

## What the tree already has (verified 2026-06-16)

- **Authored a11y/standards metadata already lives on the block — and it is unrendered.**
  `fui:src/_data/blocks.json` carries an optional `webStandards` field on **28 of 74** blocks (first at
  `fui:blocks.json:25`), shaped `{<concern>: {usage, reference}}` — e.g. `wizard.webStandards.ariaCurrentStep`
  = `{usage: "The active step indicator … carry aria-current=\"step\" …", reference: "https://developer.mozilla.org/…/aria-current"}`.
  Across all entries the `reference` field points at the **contract**: 95 MDN links + 12 W3C/WAI (incl. APG)
  + a few Open-UI/WHATWG. **`we:src/block-pages.njk` renders none of it** (`grep webStandards` → 0 hits) — the
  realization layer is authored but has no panel.
- **Intents carry no a11y fields.** `we:src/_data/intents.json` (56 intents) has keys
  `description, dimensions, events, requiresCapabilities, researchGaps, uxResearch, …` — no `a11y`/`aria`/
  `wcag` slot. So an intent-derived contract would be a **new schema**, not a projection of an existing one.
- **Axe is route-level, not per-component.** #770 (resolved) ships `we:tests/a11y/rendered-site-a11y.spec.ts`
  + `we:tests/a11y/route-allowlist.ts`; `GATED_ROUTES` includes the `/blocks/` **index** but **not**
  `/blocks/{id}/`. It stores no per-component metadata — it is a build gate, warn→enforce ratchet, and the
  #763 ruling explicitly chose a hand-maintained allowlist over auto-derivation.
- **The component the panel documents renders inside a cross-origin FUI iframe.** The `fuiDemo` shortcode
  (`we:.eleventy.js:38`) embeds a Frontier-UI-hosted demo via
  `<iframe sandbox="allow-scripts allow-same-origin" src="${FUI_DEMO_BASE}/demos/…">` (FUI dev server :3001 /
  published host in prod). Per #732, an iframe's document is its own world — and axe-core run from the WE
  Playwright lane on `/blocks/{id}/` **cannot traverse into the cross-origin frame**; it would audit the WE
  doc-page chrome, not the FUI component. FUI owns the impl *and* its rendered display (the no-leakage
  boundary; #701/#700/#732).

## Prior art (per design-first step 1)

Surveyed how leading component-doc surfaces source and present per-component a11y (full agent findings
distilled here):

| Source | Where the a11y info comes from | What it shows |
|---|---|---|
| **WAI-ARIA APG** (`w3.org/WAI/ARIA/apg`) | The canonical **contract**, implementation-agnostic | Per-pattern "Keyboard Interaction" + "WAI-ARIA Roles, States, and Properties" |
| **IBM Carbon** | **Mix, layers kept separate**: authored prose + dated AVT test status | "Accessibility considerations" (authored) · "Resources" → links the **APG pattern** · "Accessibility testing"/"Automated test" status (AVT1 automated / AVT2 keyboard / AVT3 screen-reader) + a site-wide per-component status matrix |
| **Storybook `@storybook/addon-a11y`** | **Runtime-only**, live axe-core, **not persisted** | Violations / Passes / **Incomplete** ("confirm manually") tabs; a dev-time linter, not a published claim. Docs: axe covers "up to 57% of WCAG" |
| **Material 3 / Fluent 2 / GOV.UK** | **Hand-authored prose** (design guidance / research), no verification surfaced | touch targets, labeling, contrast (M3); WCAG 2.1 AA + focus mgmt (Fluent); inline guidance + "Research on this component" (GOV.UK) |
| **Adobe React Aria** | Authored, **implementation-realization** prose; ARIA props in the API table | how *this* component realizes press/focus/labeling |

**The synthesis — three distinct origins, one per layer:**

1. **Contract** — what the *pattern* requires (APG keyboard/roles). Reusable across every block that
   implements the pattern. In WE terms → the **intent** layer (the standard WE owns).
2. **Realization** — how *this* component delivers it; authored notes. In WE terms → the **block**
   (`webStandards`), which already exists.
3. **Verification** — automated axe/AVT results; a dated, freshness-bearing signal. In WE terms →
   **conformance**, and for FUI blocks that is FUI-owned data.

**Carbon is the only surveyed system that visibly separates all three** — and that separation is the load-bearing
lesson: docs that *merge* them (inline the APG keyboard table next to authored prose with no verification)
imply a sufficiency claim they can't back. **Treat automated results as a separate dated attestation, never
as authored prose, and never as proof of accessibility** (axe ≤ ~57% WCAG; the "Incomplete" tab exists
precisely because most criteria are not auto-checkable). Live-axe is a dev tool; a published panel wants a
durable attestation or nothing.

## Standing test — are the item's three "options" actually forks?

The item framed the origin as a single choice between *"intent/trait-derived a11y metadata, per-demo axe
results, or authored notes."* The survey shows this is a **pass-0 miss**: those three are not competing
alternatives for one slot — they are the **three layers above** (contract / realization / verification), and
best-in-class practice (Carbon) keeps all three. So the prepared structure is not "pick one source"; it is
three layer-scoped decisions, each with its own home in the constellation, sequenced for v1.

## Per-fork classification pass

- **Realization (block `webStandards`)** — Layer: **block** (impl realization). Not a protocol or intent
  dimension; an authored catalog/devtools field. Fixed field, optional per block (most-permissive: absent →
  no panel). Seam: distinct from contract + verification (bias-toward-separation honoured — three layers
  stay separate, never merged).
- **Contract (intent a11y)** — Layer: **intent** (the standard/contract). Coherent as an intent property in
  UX vocabulary (ARIA roles/keyboard *are* the platform's accessible-UX vocabulary — aligns with
  intents-are-UX-only, borrow-platform-vocabulary). New schema, 56-intent authoring lift. Defer until a
  second consumer needs it (the "stays unregistered until a 2nd consumer" pattern, #732/#728).
- **Verification (axe)** — Layer: **conformance**, FUI-owned for FUI blocks. Not a WE-authored field.
  Per-component axe against a cross-origin FUI iframe is impossible from WE *and* a no-leakage-boundary
  violation; consume FUI-published per-component results as outputs only (#475 pattern), if ever.

## Recommendation (to ratify in #803)

1. **Realization SoT = the existing block `webStandards` field** (Fork 1) — render it; do not mint a new
   a11y schema or a parallel data feed. The realization layer already exists on 28/74 blocks and is exactly
   what a *per-component* panel shows.
2. **Contract = link out, don't mint now** (Fork 2) — the panel surfaces each concern's `reference`
   (MDN/APG/WAI) as the contract link (Carbon's "Resources" model); a structured intent-layer a11y contract
   is deferred to its own item, triggered by a second consumer.
3. **Verification = none in v1; route-level #770 stands** (Fork 3) — no per-component axe badge; a future
   per-component signal arrives only as a FUI-published no-leakage output. Running axe on `/blocks/{id}/`
   is rejected as measuring the wrong thing (cross-origin frame).

Panel shape: a "**Accessibility & Web Standards**" section = one row per `webStandards` concern → `usage`
prose + a "Reference ↗" link to the contract. The Carbon "considerations + resources" shape, rendered from
data WE already holds.

## Red-team notes for the deciding agent

- **Fork 1 default** rests on `webStandards` being a *realization* record, not a *contract* record. Spot-check:
  is the existing `usage` prose impl-specific ("delegated to the composed Stepper") or pattern-generic? If
  several entries are actually generic contract text, the contract/realization split is muddier than assumed
  and Fork 2's "mint intent a11y" branch gets stronger.
- **Fork 3 default** leans on the #732 cross-origin-iframe finding and the #475 no-leakage rule. Confirm both
  still govern — if FUI already publishes per-component axe output as consumable data, the "none in v1" default
  weakens toward "consume it now."
