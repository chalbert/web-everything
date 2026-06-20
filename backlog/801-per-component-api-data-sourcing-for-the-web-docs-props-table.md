---
kind: decision
size: 3
parent: "623"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/gen-cem.mjs
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-per-component-api-data-sourcing.md
relatedProject: webdocs
tags: [webdocs, custom-elements-manifest, props-table, derivation-source, boundary, decision-prep]
---

# Per-component API data sourcing for the Web Docs props table (WE-authored vs FUI CEM analyzer)

**RATIFIED 2026-06-17 — see the *Decision* section below.** I1 + I2 forced invariants ratified as written;
Fork 1 ratified as **B, sharpened to the *public-API* line**: WE authors the surface a block author
**deliberately commits to as public** — the declarative API (attributes/reflected properties/events/slots/
cssProperties/cssParts) *plus* any JS member/method designed as public interface — and **assumes private**
for everything else (deferred to the #706 opt-in impl-scan). This corrects B's reflection proxy, which would
have wrongly pushed stable public methods (`.show()`, public getters) out to impl-scan; confidence ~80% →
~90%. Spin-out builds filed at resolution.

**Prepared, ready to ratify.** Decide where structured per-component API data
(attributes/properties/slots/CSS custom-properties/parts) for the [`/blocks/` props table](/blocks/props-table/)
originates. The renderer ([`block:props-table`, #654](/backlog/654-mint-the-props-table-block-render-custom-elements-manifest-a/))
and the CEM protocol + emit pipeline ([`we:scripts/gen-cem.mjs`, #653](/backlog/653-register-custom-elements-manifest-cem-as-a-we-protocol-emit-/))
already ship, but `we:gen-cem.mjs:43-93` projects only **events / exports / tagName** and the emitted
`we:custom-elements.json` carries **0 attributes / 0 slots / 0 cssProperties** for all 74 blocks — so four of the
table's six member columns have no data. Grounded in a prior-art survey (CEM analyzer · Shoelace/Lit · the spec)
published as `/research/per-component-api-data-sourcing/` (report linked via `relatedReport`). After the
fork-existence test against the governing precedent, the item's framed A/B source-fork reduces to **two forced
invariants + one genuine on-merit fork** (the *scope* of the authored contract).

## The source question was already ruled — at the dimension level (#706)

[#706](/backlog/706-generate-fui-s-block-catalog-from-a-derived-manifest-and-ren/) (resolved) faced the same
authored-vs-impl-scan question for FUI's own catalog and **dissolved it into invariant + dimension**:
derivation-source is a **supported dimension** (`authored | impl-scan | hybrid`, all emitting the *same CEM
contract*), with **WE shipping the authored→CEM path ([#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-a/) /
`gen-cem`) as the default/reference source** and impl-scan opt-in. [#785](/backlog/785-document-derivation-source-as-a-web-docs-standard-dimension-/)
(resolved) documented this as a Web-Docs standard dimension. So #801 is the *application* of that ruling to WE's
own props-table — the default is already named: **authored**.

## Recommended path at a glance

| # | The call | Recommended | Main alternative | Confidence |
|---|---|---|---|---|
| I1 | Data **source** | **Authored WE-side `fui:blocks.json` → `gen-cem` → CEM** | FUI analyzer output as WE's canonical SoT | Forced invariant — alt is broken for WE's own docs (boundary violation; delivers no authoring saving) |
| I2 | Field **shapes** | **Mirror the CEM 2.1.0 member kinds** (no bespoke schema) | a props-table-specific shape | Forced invariant — #654's `consumesCemNotBespoke`; the spec dictates it |
| 1 | Authored contract **scope** | **B — public API surface** (declarative API + deliberately-public JS members; assume private otherwise → defer to opt-in impl-scan) | A — full member set incl. private/internal JS members/methods | **~90%** (↑ from med-high after the public-API refinement) — the one real call |

## Forced invariants (ratify, not weigh)

**I1 — Source = authored WE-side `fui:blocks.json` fields → `gen-cem` → CEM.** The #626/#706 default/reference
source, consistent with how `events`/`exports` are *already* authored WE-side (#653): `fui:blocks.json` declares
`implementedBy: @frontierui/blocks/…` and structured `events` (e.g. `type-ahead` → three events with
`description`/`taxonomy`/`detail`/`bubbles`/`cancelable`), which `we:gen-cem.mjs:48-53` projects. Attributes,
slots, CSS custom-properties and CSS parts are the **same nature of declared-contract data** — adding them is
the consistent continuation of the shipped pattern, not a new mechanism. The alternative (an FUI-emitted
`we:custom-elements.json` consumed as WE's *canonical* props-table SoT) is **broken for WE's own reference docs**:
it violates the docs-rendering boundary (`@webeverything` never imports/consumes FUI artifacts as canonical;
WE renders its *own* standard pages — #700/#701/#732/#765) and inverts contract-first (WE *declares* the API,
FUI *implements* it). The survey also shows it delivers **no authoring saving** for the fields that matter
(below). B is **not deleted** — it remains the #706 **opt-in impl-scan dimension** (for FUI's own catalog or a
future annotated-source implementer) and the engine of a future **conformance gate**.

**I2 — Field shapes mirror the CEM 2.1.0 member kinds; no bespoke schema.** `attributes`, `members`
(fields/methods), `slots`, `cssProperties`, `cssParts` — the kinds the renderer already projects
(`we:block-descriptions/props-table.njk:16-19`) and `gen-cem` already targets. This is #654's ratified
`consumesCemNotBespoke` design decision; the shape is the spec's, so it is a *fixed mechanic*. `we:gen-cem.mjs` is
extended to project the chosen fields (the post-ratification build the item names).

## Fork 1 — scope of the authored contract: full member set vs platform-facing surface

**The survey reshaped this.** The CEM analyzer **cannot auto-derive slots, CSS custom-properties, or CSS
parts** — per the [analyzer docs](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/), it
*"figures out most of your component's API by itself, but needs help … for CSS Shadow Parts, CSS Custom
Properties and Slots, which you document using JSDoc"* (Shoelace/Lit hand-write `@slot`/`@csspart`/
`@cssproperty` and the analyzer scrapes them). So **four of the six props-table columns are hand-authored
either way** — the only thing the analyzer genuinely automates is the **programmatic JS surface** (non-reflected
fields/methods). That dissolves the source-fork (already settled by I1) and sharpens the real either/or: *which
member kinds does WE author as declared contract?*

- **Option A — full CEM member set, incl. programmatic JS members/methods.** WE authors everything the table can
  show. *Pro:* one source covers the whole table; nothing deferred. *Con:* pulls FUI's **impl-volatile**
  programmatic surface (JS fields/methods) into the WE standard's *declared contract* — maximizing drift against
  FUI impl and **duplicating the one class the analyzer could auto-derive**. Couples the WE standard to FUI's
  internal method signatures.
- **Option B — public API surface (RATIFIED).** WE authors the surface a block author **deliberately commits
  to as public**: the declarative API (`attributes`, attribute-reflected `properties`, `events`, `slots`,
  `cssProperties`, `cssParts`) **plus any JS member/method designed as public interface** (e.g. an imperative
  `.show()`, a public getter). Everything else is **assumed private** and deferred to the #706 opt-in impl-scan.
  *The public-API line, not the reflection line* — a deliberately-public method is stable committed contract
  even though it isn't attribute-reflected, so it belongs in WE's authored surface; only the private/internal
  surface (impl-volatile, FUI-owned) is excluded. This maps onto the data model directly: CEM `members` carry a
  `privacy: public|private|protected` field and the analyzer's own default already excludes `#private`/`@private`,
  so "public unless designed otherwise" is the spec's native convention — no bespoke rule. *Pro:* authored surface
  = exactly the contract-bearing public surface (declarative + intentional public JS), honoring contract-vs-impl
  + bias-toward-separation while not under-including stable public methods. *Con:* requires authoring intent
  (which member is public) — but that's the same authoring act WE already does for events; the renderer omits
  empty member kinds gracefully, so a block with no declared public JS members degrades cleanly.

**Recommended default: B (public-API line).** The public surface *is* the standard's contract and must be
hand-authored regardless (per the survey); the private/internal JS surface is impl-volatile, FUI-owned, and the
only class an analyzer adds value for — so it belongs to the #706 opt-in impl-scan, not WE's authored reference.
Most-flexible split: WE authors exactly what it owns and intends as public, no more, no less. The original
"reflected-only" framing was sharpened during ratification to the public-API line, removing its under-inclusion
of deliberately-public methods (the weakness that fed A's "incomplete table" argument).

*Red-team:* the decider may argue full authoring (A) — "one complete source, no partial table, no second
mechanism." The principle A violates is **contract-vs-impl / bias-toward-separation**: it imports FUI's volatile
programmatic surface into the WE standard's declared contract, a drift surface for data WE doesn't own and an
analyzer *could* derive. If the partial-table cost ever bites, the fix is wiring the #706 opt-in impl-scan for
the programmatic surface — not relocating the *contract* surface out of the standard.

## Decision (ratified 2026-06-17)

- **I1 — Source = authored WE-side `fui:blocks.json` → `gen-cem` → CEM.** Ratified as written. The
  FUI-analyzer-as-canonical-SoT alternative is broken for WE's own reference docs (docs-rendering boundary +
  contract-first inversion) and the survey shows it saves no authoring for the fields that matter.
- **I2 — Field shapes mirror CEM 2.1.0 member kinds, no bespoke schema.** Ratified as written (#654's
  `consumesCemNotBespoke`; the spec dictates the shape). Grounding verified against
  [`we:gen-cem.mjs:67-95`](/scripts/gen-cem.mjs) (projects only tagName/events/exports today) and
  [`we:props-table.njk:12-19`](/src/_includes/block-descriptions/props-table.njk) (consumes
  members/attributes/events/slots/cssProperties, omits empty kinds).
- **Fork 1 — scope = B, on the public-API line (~90%).** WE authors the **public API surface**: declarative
  API (attributes/reflected properties/events/slots/cssProperties/cssParts) **plus deliberately-public JS
  members/methods**; **private/internal members assumed private** and deferred to the #706 opt-in impl-scan.
  The line was sharpened from "attribute-reflected only" to "public-API intent" during this ratification (per
  the deciding discussion): the reflection proxy wrongly excluded stable public methods, while public-API intent
  keeps them in and only excludes the impl-volatile private surface. Maps onto CEM's native `privacy` field.

  *Red-team result:* A's case ("one complete source, no partial table") **fails** on
  contract-vs-impl / bias-toward-separation — A pulls FUI's volatile private/internal JS surface into WE's
  declared standard, a drift surface for data WE doesn't own and the one class an analyzer could derive. The
  public-API refinement also neutralizes A's "incomplete column" sub-argument (stable public methods are now
  *in* B). Attack does not land → B ratified. Residual ~10%: a member's public-vs-private intent must be
  authored — but that mirrors the existing events authoring act.

## Captured follow-ups (filed at ratification 2026-06-17)

- **[#838](/backlog/838-extend-gen-cem-to-project-the-public-api-cem-member-set-attr/) — Extend `gen-cem` +
  props-table page-integration build** (the spin-out #801 names): project the public-API member kinds in
  `we:scripts/gen-cem.mjs` and wire the per-block page so `<props-table tag="…">` resolves real data. *(ready)*
- **[#839](/backlog/839-backfill-authored-public-api-member-fields-attributes-proper/) — Backfill authored
  public-API member fields** across the blocks (start with blocks that have a `/blocks/` page + a registered
  tag), completeness-gated the way #706's invariant gates the FUI catalog. *(blockedBy #838)*
- **[#840](/backlog/840-cem-conformance-gate-run-the-analyzer-over-fui-source-and-fa/) — Conformance gate**
  (the home for the rejected analyzer-as-source engine *and* the deferred private/programmatic surface): FUI
  runs `@custom-elements-manifest/analyzer` over source and the emitted CEM is **compared to WE's declared CEM,
  failing on drift** — analyzer as *verifier*, not *source* (the #463 deterministic-conformance posture).
  *(blockedBy #838, separately-prioritized)*

---

## Context

**Per-fork classification (against the architecture).** No new runtime/DI/Protocol and no new Block/Intent —
the data is authored onto the **existing `custom-elements-manifest` protocol** (#653) via `fui:blocks.json` (the
WE-side declared contract) and projected by the existing `gen-cem` devtool. The *contract* is WE-standard-owned;
the *authoring* is WE-side data; the *opt-in scan / conformance gate* is the implementer's (FUI's) instantiation.
Source-of-truth is the #706 *dimension* (authored default, impl-scan opt-in) — this item picks WE's
instantiation for the reference docs, not a new axis. I1 + I2 are fixed mechanics; Fork 1 (contract scope) is
the one genuine dimension. The least-coupling default (B, contract-surface only) keeps the WE standard free of
FUI's volatile programmatic surface.

**Where this sits.** A slice of epic [#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/).
Ratifying it unblocks the `gen-cem` extension + the props-table page-integration build (the item's stated
spin-out). Adjacent to the FUI-catalog cluster (#706/#731/#783/#785), which rules the *same* source dimension
for FUI's own catalog; #801 is its WE-reference-docs counterpart.

**Prior art** (full survey: report + `/research/per-component-api-data-sourcing/`): the Custom Elements Manifest
spec + analyzer (cannot auto-derive slots/CSS custom-properties/CSS parts — JSDoc required); Shoelace/Lit
(manually-authored JSDoc scraped by the analyzer); api-viewer / Storybook / VS Code custom-data / JetBrains
web-types (all consume the CEM). The decisive finding — the CSS-API/slots surface is hand-authored regardless —
is what dissolves the framed source-fork and surfaces the contract-scope fork instead.
</content>
