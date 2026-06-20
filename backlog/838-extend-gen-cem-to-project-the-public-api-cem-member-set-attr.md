---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/gen-cem.mjs
tags: []
---

# Extend gen-cem to project the public-API CEM member set (attributes/properties/slots/cssProperties/cssParts) and wire the props-table page

Per the #801 ratification (Fork-1=B, public-API line): extend we:scripts/gen-cem.mjs to project attributes, attribute-reflected + deliberately-public properties, slots, cssProperties and cssParts from fui:blocks.json onto the emitted CEM (it currently emits only tagName/events/exports), and wire the per-block page so <props-table tag="…"> resolves real data. Author members with CEM privacy:public; private/internal members are excluded by default (deferred to the #706 opt-in impl-scan). Field shapes mirror CEM 2.1.0 member kinds (no bespoke schema).

## Progress

**Resolved 2026-06-17 (batch-2026-06-17).**

- **gen-cem projection** — `we:scripts/gen-cem.mjs` now projects `attributes`, `members` (authored public properties → CEM `kind: 'field'`, `privacy: 'public'`, carrying `reflects`/`attribute`/`fieldName`), `slots`, `cssProperties` and `cssParts` from `fui:blocks.json` onto each declaration, alongside the pre-existing `events`/`exports`/`tagName`. Each kind is sugar-tolerant (a bare string → `{ name }`; array or object-keyed input both accepted) and mirrors the CEM 2.1.0 member shapes (no bespoke schema, #801 I2). Empty kinds are omitted so a re-run over unchanged blocks stays a no-op diff.
- **Authored example** — `dropdown` (the `<drop-list>` form-associated member of the droplist family) now declares its public surface: 5 attributes, 2 properties (`value` reflected), the public `change` event, 3 CSS parts. `gen:cem` regenerated; the declaration carries the real data. Broad authoring across the catalog is the sibling slice #842 (the projection machinery this item ships is what #842 populates).
- **Page wiring** — `we:block-pages.njk` renders a new **Public API** panel (attributes / properties / events / slots / CSS custom-properties / parts), omitting any kind the block doesn't author. The live `<props-table>` element is FUI-owned impl and is **not** rendered here per the docs-rendering boundary; WE renders the identical CEM-shaped contract **server-side** from its own `fui:blocks.json` (the boundary-safe form of "props-table resolves real data" — one seam, the WE page is just another consumer).

`tagName` is deliberately **not** authored here — that is the #822 tag-half (the blocked sibling of #842); the panel keys off the block page itself, not a tag lookup, so it needs none.
