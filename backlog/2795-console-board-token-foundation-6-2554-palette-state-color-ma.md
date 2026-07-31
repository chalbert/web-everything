---
bornAs: xzpkd8q
kind: story
size: 5
parent: "2555"
status: open
dateOpened: "2026-07-28"
tags: [plateau-loop, console, console-board, tokens, theme, a11y, canonical-2554, foundation, slice-2555]
scope:
  - plateau-app:src/backlog-view/lane-board.css
  - plateau-app:src/backlog-view/lane-board.ts
  - plateau-app:src/backlog-view/lane-board.test.ts
  - plateau-app:src/backlog-view/console-glyphs.ts
---

# Console board token foundation — §6/#2554 palette, state→color map, sprite, motion, theme-persist

Establish the ratified color/motion token foundation the whole board reads from. Today only accents darken in
dark mode and [#2711] treats dark as "judged by eye" — because there is no single token layer that both themes
and every state color resolve through.

## Why (canonical gap)
The committee (2026-07-28, vs the canonical artifact) found `tokens-ratified-palette`, `tokens-state-color-map`,
`tokens-theme-persist`, `tokens-motion-set`, `tokens-reduced-motion`, and `tokens-icon-sprite` **UNOWNED**;
[#2711] delivers only the dark *surface* half and omits the palette custom props, so state colors would inherit
light values on dark. The canonical artifact **specifies** both themes explicitly, so a checkable spec exists.

## Scope
- **Ratified palette** with fg+bg pairs per state (`--deliver/-bg`, `--lev/-bg`, `--waits/-bg`, `--human/-bg`,
  `--fail/-bg`, `--primary`, `--grad`) defined for BOTH light and an explicit `[data-theme="dark"]` override
  (plus the `prefers-color-scheme: dark` fallback) — every custom prop re-valued for dark, not just surfaces
  (`tokens-ratified-palette`).
- **Fixed state→color map**, single-sourced: build/wait = waits purple, delivered = deliver green, leverage =
  lev teal, human = amber, fail = red, queue = muted. No surface may re-use a state color for a transient cue
  (`tokens-state-color-map`).
- **One inline SVG icon sprite** (the lucide-style set: loader, checkcheck, waypoints, clipboard-check, …) all
  cards/pool draw from (`tokens-icon-sprite`).
- **Motion set** — `spin` (loader), `pulse`/breathe (attention), `shake` — with a `prefers-reduced-motion`
  disable rule (`tokens-motion-set`, `tokens-reduced-motion`).
- **Theme persistence** to `localStorage['pl:theme']`, restored on load, so a theme choice carries across the
  board and its sibling screens (`tokens-theme-persist`).
- WCAG-AA on the state colors over both surfaces is a checkable criterion.

## Where the code goes (locus)
`plateau-app:src/backlog-view/lane-board.css` token layer (the board's scoped override), reading base tokens
from `plateau-app:src/styles/theme.css`. Consumed by [#2789] (card grammar) and every `.lb-*` surface.

## Acceptance
Both themes resolve every board surface AND state color from this one token layer — no white cards on dark, no
light-valued state color on dark. Motions honor reduced-motion; the theme choice persists to `pl:theme` and
restores. Checked against the canonical §6/#2554 artifact's light AND dark renders. `plateau-app` `npm test` +
`we:` `check:standards` pass.
