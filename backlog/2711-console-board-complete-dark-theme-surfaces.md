---
bornAs: xe9sz76
kind: story
size: 3
parent: "2555"
status: open
blockedBy: ["2795"]
dateOpened: "2026-07-27"
tags: [plateau-loop, console, console-board, dark-theme, a11y, canonical-2554, slice-2555]
---

# Console board dark theme skins card/rail/cell surfaces, not just accents

Mounted in dark at 1440w, only the **accents** darken — every **surface** (lane cells, cards, composer +
glossary rail, ready-to-queue cards, off-lane pool) stays white on a near-black page. Re-anchored 2026-07-28:
dark is **not** "judged by eye" — the canonical §6/#2554 artifact **specifies** the dark grammar (an explicit
`[data-theme="dark"]` override with its own token values + fg/bg palette pairs), so there is a checkable spec.

## Canonical alignment (what changed)
- **Verify against the canonical dark tokens**, not by eye, and not against a v68 light baseline — the canonical
  artifact ships both themes.
- **The dark set must carry the palette custom props**, not only surface/border/text: `--deliver/-bg`,
  `--lev/-bg`, `--waits/-bg`, `--human/-bg`, `--fail/-bg`, `--primary`, `--grad` — else state colors inherit
  light values on dark. This is the same token layer [#2795] establishes; this story delivers the board's
  consumption of it in dark and its coverage across every `.lb-*` surface.
- **Light non-regression is measured against the canonical light spec**, not "matches v68".

## Scope
- Under the board's dark scope, give every `.lb-*` **surface** a dark value: surface, surface-card,
  border/border-light, text, text-secondary, text-muted — composer, glossary, lane cells, cards, cross-lane
  waiter, ready-queue, off-lane pool.
- Carry the full ratified palette props (above) in the dark override so grammar colors stay correct.
- Keep the ratified color grammar (green/teal/purple/amber/red) **WCAG-AA** on the dark surface — a checkable
  criterion tied to the state colors, not eyeballed.

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.css` dark override (consuming [#2795]).

## Acceptance
A dark mount at 1440w renders every board surface dark with AA-legible text and correct grammar colors — no
white cards/rails/cells, no light-valued state color on dark. Light rendering matches the canonical light token
spec. Judged against the **ratified** §6/#2554 token grammar (binding now — tokens + WCAG-AA, checkable
without a pixel baseline). The canonical **visual baseline** that supersedes v68
`plateau-app:tests/visual/baselines/board.png` is the *pending* pixel oracle [#2796] freezes, so any
baseline (light-regression) comparison is **gated on that flip**; until [#2796] lands, verify against the
token spec, not against a canonical baseline that does not yet exist. Both themes; `plateau-app` `npm test` +
`we:` `check:standards` pass.
