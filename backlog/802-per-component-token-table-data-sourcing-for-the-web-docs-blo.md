---
kind: decision
size: 2
parent: "623"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-component-token-table-sourcing.md
relatedProject: webdocs
tags: [webdocs, webtheme, design-tokens, custom-elements-manifest, decision-prep]
---

# Per-component token-table data sourcing for the Web Docs /blocks/ panels

Decide how a per-component token table on `/blocks/{id}/` is sourced and what it shows. One of three
panel-data decisions carved from [#727](/backlog/727-web-docs-blocks-uniform-live-example-slot-on-every-per-compo/)
(siblings: [#801](/backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table/) props-table,
[#803](/backlog/803-per-component-a11y-panel-content-data-sourcing-for-the-web-d/) a11y panel), under the
Web Docs feature-pipeline epic [#623](/backlog/623-web-docs-feature-pipeline-inventory-workbench-tools-derive-i/).

**Prepared 2026-06-16** — prior art surveyed, `/research/` topic
[`component-token-table-sourcing`](/research/#component-token-table-sourcing) published,
forks below at DoR. Full grounding: [`we:reports/2026-06-16-component-token-table-sourcing.md`](../reports/2026-06-16-component-token-table-sourcing.md).

## Grounding digest (verified 2026-06-16)

- **Component token tier is tiny and archetype-keyed.** [`we:webtheme/defaultTokens.ts:90-117`](../webtheme/defaultTokens.ts)
  carries a component tier with only `button`/`card` groups (**2 of 69** blocks), each aliasing a primitive
  (`button.radius: {$value: '{we:radius.md}'}`). `button`/`card` are **not block ids** — the closest block is
  `action-button` (a Behavior); there is no `card` block. The tier names generic archetypes, not WE blocks.
- **A resolve pipeline already yields the table rows.** [`we:webtheme/tokens.ts:78-140`](../webtheme/tokens.ts)
  exposes `flattenTokens()` → `FlatToken` and `resolveTokens()` → `ResolvedToken {…, aliasOf, resolved}`, so
  `button.radius` already projects to `aliasOf='we:radius.md'`, `resolved='0.5rem'`.
  [`we:webtheme/compile.ts:44-48`](../webtheme/compile.ts) emits the #403 example `--button-radius: var(--radius-md)`.
- **CEM has a first-class per-component `cssProperties` slot — and it is empty.** WE emits CEM
  (`we:custom-elements.json` via [`we:scripts/gen-cem.mjs`](../scripts/gen-cem.mjs), #653); the
  [props-table](/blocks/props-table/) write-up says it projects "members/attributes/events/slots/**cssProperties**"
  ([`we:block-descriptions/props-table.njk:17`](../src/_includes/block-descriptions/props-table.njk)). But
  `we:gen-cem.mjs:71-82` emits **no** `cssProperties` and **0** blocks carry token data — the renderer slot
  exists, wired into the same manifest the props table consumes, simply unpopulated.
- **Mapping precedent = the `fuiDemo` field (#727).** #727 added an optional `fuiDemo` field to a block's
  `fui:blocks.json` entry pointing at its FUI demo — the in-tree consumer-declares-its-source pattern.

## The axis

The token table is a **projection of an existing source of truth**, not a new metadata shape — the same
invariant #626 Fork 1 ratified for the props table ("one manifest, many consumers; never a second metadata
source to keep in sync"). Prior art (Material 3 ref/sys/comp tiers, Adobe Spectrum component tokens, the CEM
`cssProperties` slot, Storybook design-token addons, Style Dictionary references) converges on three things:
source from an explicit per-component declaration (never a name/dir convention), surface the token's
**alias/reference** as the primary thing shown with the resolved literal alongside, and where a CEM exists,
put the CSS-custom-property rows **in that one manifest**. WE already holds all three substrates — the
decision wires them rather than inventing.

## Recommended path at a glance

| Fork | Question | Recommended default | Main alternative (why excluded) |
|---|---|---|---|
| 1 | Where the token data is sourced | **Project the component token tier into CEM `cssProperties` (in `we:gen-cem.mjs`)** | A parallel `src/_data` token JSON — coherent but re-opens #626 Fork 1's one-manifest ruling |
| 2 | How a block maps to its token group | **Explicit optional `componentTokens` field on the `fui:blocks.json` entry** | id name-convention — *broken* (`button` ≠ `action-button`) |
| 3 | What the table shows | **Override · alias · resolved literal (3 columns)** | Override-only — drops the M3/Spectrum-standard alias chain the data already carries |

## Fork 1 — token-data source path

**Recommended: source the table from CEM `cssProperties`, projected by `we:gen-cem.mjs`.** The component
token tier (resolved via `flattenTokens`/`resolveTokens`) flows into each block's CEM declaration as
`cssProperties` rows; the existing props-table / a token-specific projection of the same manifest renders
them. This *applies* #626 Fork 1's "one manifest, many consumers" to tokens — no new data path, the
props-table renderer already names `cssProperties`.

- **Alternative — a parallel `src/_data/blockTokens.(json|js)` feed** (expose `webtheme/` to 11ty as its own
  global data, the item's original framing). Coherent — 11ty reads JSON/JS data fine — but it reintroduces a
  second per-component metadata source the props-table architecture explicitly rejected, and is excluded by
  the one-manifest principle, not by being non-functional. *Red-team note for the decider:* confirm #626
  Fork 1 still governs the props table before leaning on it; if that ruling is softer than assumed, this
  alternative is live.

## Fork 2 — block ↔ component-token mapping locus

**Recommended: an explicit optional `componentTokens` field on the block's `fui:blocks.json` entry**, naming the
`defaultTokens` component group(s) it draws from (e.g. `"componentTokens": "button"`). Mirrors the #727
`fuiDemo` field precedent, keeps `webtheme/` pure and unaware of `block.id`, and a block without the field
renders no token panel (graceful absence, same as `fuiDemo`).

- **Alternative — id name-convention** (derive the token group from `block.id`). *Broken*: `button`/`card`
  do not match any block id (`action-button`, and no `card` block), so a convention resolves nothing today.
- **Alternative — declare the mapping inside `webtheme`** (`defaultTokens` `$extensions` carrying block ids).
  Coherent but inverts the dependency — makes the token model know about docs/blocks, against
  bias-toward-separation. Excluded in favour of the consumer-declares-its-source default.

## Fork 3 — table scope

**Recommended: show override · alias · resolved literal (three columns).** The M3/Spectrum-aligned superset;
the data is already in `ResolvedToken.aliasOf` / `.resolved`, so the alias chain (`--button-radius` →
`var(--radius-md)` → `0.5rem`) is free. Most-informative-default (the restriction is the author's opt-in).

- **Alternative — override-only** (just `--button-radius: 0.5rem`). Loses the reference every mature token
  system treats as the primary documentation; rejected.
- **Alternative — full multi-hop reference-tier expansion** (every link in a chain as its own row). Over-rich
  for a 1–2-hop component tier; can be a later display refinement, not the default.

## Ratified 2026-06-17

All three forks ratified as recommended (grounding re-verified against the tree, defaults red-teamed):

- **Fork 1 → CEM `cssProperties`, projected by `we:gen-cem.mjs`** (~90%). The one-manifest principle the
  red-team note flagged is not a soft assumption — it is shipped doc copy at
  [`we:props-table.njk:17`](../src/_includes/block-descriptions/props-table.njk) ("never a second metadata
  source to keep in sync"), which names `cssProperties` as a projection slot. The parallel `src/_data` feed
  is correctly excluded.
- **Fork 2 → explicit optional `componentTokens` field on the `fui:blocks.json` entry** (~90%), mirroring the
  confirmed `fuiDemo` precedent. **Refinement:** accept `string | string[]` (a block may draw from >1 token
  group), not a bare single value.
- **Fork 3 → three columns: override · alias · resolved literal** (~85%). Alias chain is free from
  `ResolvedToken.aliasOf`/`.resolved`; full multi-hop expansion deferred as a later display refinement.

**Amendment — the `cssProperties` co-ownership seam with [#801](/backlog/801-per-component-api-data-sourcing-for-the-web-docs-props-table/).**
#801 (open) is deciding the *authored* CEM contract scope and also names `cssProperties` as an in-scope
member kind. Both decisions write the same slot. The build slice MUST emit the **union**: token-tier-derived
rows (this item) merged with any hand-authored styling API (#801) — `we:gen-cem.mjs` merges, neither side
assumes sole ownership of `cssProperties`. A clobber on either side is a defect.

## On ratification

Spins out a build slice: extend `we:gen-cem.mjs` to emit `cssProperties` from the mapped token group (**merged**
with #801's authored contract, per the amendment above), add the `componentTokens` (`string | string[]`)
field to the relevant `fui:blocks.json` entries, and render the panel on `/blocks/{id}/`. The sparse 2/69
coverage is a **prioritisation** input for *when* to build that slice — not a branch of this sourcing
decision.
