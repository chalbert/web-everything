# Per-component API data sourcing for the Web Docs props table

**Decision prep for [#801](../backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table.md)** —
a slice of the Web Docs feature pipeline epic [#623](../backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i.md).
Published as the `/research/` topic `per-component-api-data-sourcing`.

## The question #801 poses

The props-table renderer ([`block:props-table`, #654](../backlog/654-mint-the-props-table-block-render-custom-elements-manifest-a.md))
and the CEM protocol + emit pipeline ([`we:scripts/gen-cem.mjs`, #653](../backlog/653-register-custom-elements-manifest-cem-as-a-we-protocol-emit-.md))
already exist. But `we:gen-cem.mjs:43-93` projects only **events / exports / tagName**, and the emitted
`we:custom-elements.json` carries **0 members, 0 attributes, 0 slots, 0 cssProperties** for all 74 blocks. So
the table that is *meant* to show "attributes, properties, events, slots, CSS custom-properties and parts"
(`we:src/_includes/block-descriptions/props-table.njk:5-6`) has no data for four of its six member kinds.

#801 frames the call as a boundary/placement **fork**:

- **A — hand-authored `fui:blocks.json` fields** (a WE-side *declared contract*), projected by `gen-cem`.
- **B — an FUI-side CE-manifest analyzer** over FUI block source, the emitted `we:custom-elements.json` shipped
  to WE as data.

This report shows that, after the standing fork-existence test against the governing precedent and a
prior-art survey, **A is a forced invariant** for WE's *own reference docs* (B is excluded *as WE's SoT*,
but survives as the already-ratified #706 opt-in dimension and as the engine of a conformance gate), and the
**one genuine on-merit fork** is the *scope* of the authored contract.

## The governing precedent — #706 already ruled the source question (at the dimension level)

[#706](../backlog/706-generate-fui-s-block-catalog-from-a-derived-manifest-and-ren.md)
(resolved 2026-06-16) faced the *same* authored-vs-impl-scan question for FUI's own block catalog and
**dissolved it into invariant + dimension** (`#706` RULING, lines 66-99):

- **Derivation source = SUPPORTED DIMENSION**, not a fork: `authored | impl-scan (CEM-from-source) | hybrid`,
  all emitting the *same CEM contract*. **WE ships the authored→CEM path (#626/`gen-cem`) as the
  default/reference source; impl-scan/CEM-from-source is an opt-in** for an implementer with annotated source.
- **Standard (WE) owns** the manifest *contract* + the completeness invariant + the authored→CEM default.

[#785](../backlog/785-document-derivation-source-as-a-web-docs-standard-dimension-.md)
(resolved) documented this as a Web-Docs standard dimension (`we:src/_includes/project-webdocs.njk`, "Dimension —
Derivation source": *authored = default/reference; impl-scan = opt-in; all emit the same CEM contract*).

So #801 is **not** a fresh A/B fork on equal footing — it is the *application* of #706's already-ratified
dimension to WE's own props-table, where #706 has already named the default: **authored→CEM**.

## The constellation boundary forces it the rest of the way

For WE's *own* reference docs specifically, B (an FUI build artifact consumed as WE's canonical props-table
data) is not merely the non-default — it is **excluded by the docs-rendering boundary**:

- **`@webeverything` never imports/consumes FUI artifacts as canonical** (the constellation rule:
  *FUI owns impl AND its rendered display; WE renders its OWN standard pages; WE never imports/renders/consumes
  FUI block code as canonical* — ruled #700/#701, refined #732/#765). A props table on a WE *standard* page
  that sourced its truth from an FUI-emitted `we:custom-elements.json` would make WE's own standard docs depend on
  an FUI build artifact — exactly the coupling the boundary forbids.
- The **contract-first direction**: WE *declares* a block's public API; FUI *implements* it. Sourcing the
  declared API *from* the impl inverts that (impl becomes the SoT for the standard) — the inverse of the
  neutral-contract-SoT + deterministic-conformance-gate posture WE took for the generation adapters (#463).

## The events precedent — WE already authors the public contract WE-side

WE's `fui:blocks.json` **already** carries the public contract for FUI-implemented blocks, authored WE-side, not
scraped: every block declares `implementedBy: @frontierui/blocks/…` and 4 blocks declare richly-structured
`events` (`type-ahead` → `typeahead-match`/`-nomatch`/`-reset`, each with `description`/`taxonomy`/`detail`/
`bubbles`/`cancelable`). `we:gen-cem.mjs:48-53` projects those authored events into the CEM. **Attributes, slots,
CSS custom-properties and CSS parts are the same nature of declared-contract data** — adding them to
`fui:blocks.json` and projecting them through `gen-cem` is the *consistent continuation* of the shipped #653
pattern, not a new mechanism. (Today: `attributes: 0, slots: 0, cssProperties: 0, properties: 0, tagName: 0`
across all 74 blocks — the fields simply don't exist yet.)

## Prior art — the survey that reshapes the *scope* question

Surveyed the Custom Elements Manifest spec + analyzer (the de-facto multi-vendor format `gen-cem` already
targets) and how the leading web-component design systems source these fields. One finding is decisive:

- **The analyzer cannot auto-derive slots, CSS custom-properties, or CSS parts.** Per the
  [analyzer getting-started docs](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/):
  *"`@custom-elements-manifest/analyzer` is able to figure out most of your component's API by itself, but for
  some things it needs a little help, including **CSS Shadow Parts, CSS Custom Properties and Slots**, which you
  can document using JSDoc."* Shoelace (built on Lit) does exactly this — it *"manually adds JSDoc comments and
  the analyzer scrapes them into a manifest"* (`@slot`, `@csspart`, `@cssproperty`), per
  [its CEM config](https://github.com/shoelace-style/shoelace/blob/next/custom-elements-manifest.config.js).
- **What the analyzer *can* derive automatically** is the surface that maps to real code constructs:
  attributes, public properties/fields, methods, and (with a library plugin) events — because these are
  `@property` decorators, attribute reflection, class members, and dispatched events in the source AST.

**Bearing on #801:** the slots / CSS-API / CSS-parts surface — four of the six props-table columns — is
**hand-authored either way**. So B's headline advantage ("zero hand-authoring; the impl is the single SoT")
is **false for exactly the fields the table most needs**: those are authored JSDoc *in FUI source* under B vs
authored fields *in WE `fui:blocks.json`* under A. The choice is not "author vs derive" — it is purely **which
repo's file the authored contract lives in**, and the boundary answers that: WE-side, for WE's own standard
docs. The *only* class the analyzer genuinely auto-derives without authoring is the **programmatic JS surface
(non-reflected fields / methods)** — which is precisely the impl-volatile, FUI-owned surface.

This survey *reshapes the fork*: it dissolves the headline source-fork (the authoring is unavoidable; the
boundary fixes the locus) and *creates* a sharper one — **how much of the member surface WE should author as
declared contract**, given that the programmatic JS surface is the one part B could ever automate.

## The decision, after the fork-existence test

### Forced invariants (ratify, not weigh)

**I1 — Source = authored WE-side `fui:blocks.json` fields → `gen-cem` → CEM.** The #626/#706 default/reference
source, consistent with how `events`/`exports` are already authored (#653). The alternative (FUI analyzer
output as WE's *canonical* props-table SoT) is **broken for WE's own reference docs**: it violates the
docs-rendering boundary (WE consuming an FUI build artifact as canonical for its own standard) *and* does not
even deliver its claimed benefit (slots/CSS/parts are hand-authored regardless). B is **not deleted** — it
remains the #706 **opt-in impl-scan dimension** (for FUI's own catalog or a future annotated-source
implementer, emitting the same CEM contract) and the natural **engine of a conformance gate** (below).

**I2 — Field shapes mirror the CEM 2.1.0 member kinds; no bespoke schema.** `attributes`, `members`
(fields/methods), `slots`, `cssProperties`, `cssParts` — the kinds the props-table renderer already projects
(`we:block-descriptions/props-table.njk:16-19`) and `gen-cem` already targets. This is #654's ratified
`consumesCemNotBespoke` design decision; the shape is dictated by the spec, so it is a *fixed mechanic*, not a
branch. `we:gen-cem.mjs` is extended to project the chosen fields (the post-ratification build).

### Fork 1 — scope of the authored contract: full member set vs platform-facing contract surface

The genuine on-merit either/or: *which* member kinds does WE author as declared contract in `fui:blocks.json`?

- **Option A — full CEM member set, incl. programmatic JS members/methods.** WE authors everything the props
  table can show, including non-reflected JS fields and methods. *Pros:* one source covers the whole table for
  every block; nothing deferred. *Cons:* JS members/methods are the **impl-volatile** programmatic surface
  (FUI's), not the standard's declarative contract — authoring them WE-side maximizes the drift risk against
  FUI impl, and they are the *one* class the analyzer could auto-derive, so hand-authoring them duplicates what
  FUI source already states. Couples WE's declared standard to FUI's internal method signatures.
- **Option B — platform-facing contract surface only (recommended).** WE authors the **declarative,
  platform-facing API**: `attributes`, attribute-reflected `properties`, `events`, `slots`,
  `cssProperties`, `cssParts` — the HTML/CSS/event surface a block author commits to. Non-reflected
  programmatic JS members/methods are **deferred to the #706 opt-in impl-scan source** (the analyzer derives
  them from FUI source if/when a programmatic-API table is wanted), not authored as WE contract. *Pros:* the
  authored surface is exactly the non-derivable, contract-bearing surface (slots/CSS/parts must be authored
  anyway; attributes/events/reflected-props *are* the declarative contract); aligns the manual-authoring burden
  with the fields that genuinely need it; honors contract-vs-impl + bias-toward-separation (the programmatic
  surface stays FUI's, reachable via the opt-in scan). *Cons:* the props table's "properties" column shows only
  reflected/public-API properties until/unless impl-scan is wired — a partial table for blocks whose
  interesting surface is programmatic (the renderer already omits empty member kinds gracefully, so this
  degrades cleanly).

**Recommended default: B.** The platform-facing surface *is* the standard's contract and is the surface that
must be hand-authored regardless (per the survey); the programmatic JS surface is impl-volatile, FUI-owned, and
the only class an analyzer adds value for — so it belongs to the #706 opt-in impl-scan, not WE's authored
reference. This is the most-flexible split that keeps WE authoring only what it actually owns.

*Red-team:* the decider could argue *full authoring* (A) — "one complete source, no partial table, no second
mechanism." The principle A violates: **contract-vs-impl / bias-toward-separation** — it pulls FUI's volatile
programmatic surface into the WE standard's declared contract, creating a drift surface for data WE doesn't
own and an analyzer *could* derive. B confines WE's authoring to the contract it genuinely owns and routes the
rest to the already-ratified opt-in. If the partial-table cost ever bites, the fix is wiring the #706 opt-in
impl-scan for the programmatic surface — not relocating the *contract* surface out of the standard.

## Captured follow-ups (not fork branches — file at ratification)

- **Extend `gen-cem` + the props-table page-integration build** (the spin-out #801 names): project the chosen
  member kinds in `we:scripts/gen-cem.mjs` and wire the per-block page so `<props-table tag="…">` resolves real
  data. Mechanical once I1/I2/Fork-1 are ratified.
- **Backfill the authored member fields** across the blocks (start with the blocks that have a `/blocks/` page +
  a registered tag) — authoring work, gated by completeness the way #706's invariant gates the FUI catalog.
- **Conformance gate (the home for the rejected analyzer-as-source engine).** FUI runs
  `@custom-elements-manifest/analyzer` over its source and the emitted CEM is **compared to WE's declared CEM**,
  failing on drift — the analyzer becomes a *verifier* of contract-vs-impl, not the *source* (the #463
  deterministic-conformance-gate posture). Separately-prioritized build, not a fork ([[feedback_fork_not_a_prioritization_tool]]).

## Per-fork classification (against the architecture)

- **Layer.** No new runtime/DI/Protocol and no new Block/Intent. The data is authored onto the **existing
  `custom-elements-manifest` protocol** (#653) via `fui:blocks.json` (the WE-side declared contract) and projected
  by the existing `gen-cem` devtool. The *contract* is WE-standard-owned; the *authoring* is WE-side data, the
  *opt-in scan / conformance gate* is the implementer's (FUI's) instantiation.
- **Protocol vs intent dimension.** Source-of-truth is the #706 *dimension* (authored default, impl-scan
  opt-in) — this item picks WE's instantiation of it for the reference docs, not a new axis.
- **Fixed mechanic vs dimension.** I1 (authored, WE-side) and I2 (CEM member-kind shapes) are fixed mechanics
  for WE's reference docs; Fork 1 (contract scope) is the one genuine dimension where both branches are coherent
  end-states.
- **Most-permissive / least-coupling default.** B (contract-surface only) is the least-coupling scope — it
  keeps the WE standard free of FUI's volatile programmatic surface and routes that surface to the opt-in scan.

## Sources

- [Custom Elements Manifest — analyzer getting started](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/)
  (analyzer cannot derive slots / CSS custom-properties / CSS parts — JSDoc required).
- [webcomponents/custom-elements-manifest](https://github.com/webcomponents/custom-elements-manifest)
  (the spec + member kinds: `field`/`method` members, `attributes`, `events`, schema 2.1.0).
- [Shoelace we:custom-elements-manifest.config.js](https://github.com/shoelace-style/shoelace/blob/next/custom-elements-manifest.config.js)
  + [JSDoc discussion](https://github.com/shoelace-style/shoelace/discussions/1769)
  (Lit + manually-authored JSDoc scraped into the manifest).
- [Introducing Custom Elements Manifest — Open Web Components](https://custom-elements-manifest.open-wc.org/blog/intro/)
  (api-viewer / Storybook / VS Code custom-data / JetBrains web-types all consume the CEM).
</content>
</invoke>
