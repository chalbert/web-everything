---
kind: story
size: 5
parent: "1254"
locus: plateau-app
status: resolved
blockedBy: ["1284", "1335"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "plateau:src/main.ts"
tags: []
---

# plateau-app auth/profile onto FUI droplist/type-ahead

Migrate plateau-app's hand-rolled auth/profile control (we:plateau:src/main.ts) onto FUI's droplist (fui:blocks/droplist) and type-ahead (fui:blocks/type-ahead) behaviors. Both FUI blocks ship today; this slice rides the FUI-block integration seam proven by the nav/sidebar pilot (#1284), hence blockedBy it. Demoable: the profile/auth menu opens and selects via FUI behaviors at :4000.

## Outgrew size-2 + locus fix (batch-2026-06-20 pre-flight)

- **Locus → plateau-app** (all edits + the :4000 verify live there; was unset → defaulted to webeverything,
  same fix #1284 made).
- **Outgrew 2 → 5; the "rides the #1284 seam" premise is false for a *menu*.** #1284 had a clean
  `registerNavigation(attributes)` helper + an existing nav pattern. The droplist family
  (`fui:blocks/droplist/`) exposes **no** equivalent menu-registration helper — only `AutoComplete`
  (`<we-autocomplete>`, a combobox) ships as a composed, registerable element; the raw `Anchor` /
  `Anchored` / `Selection` / `FocusDelegation` behaviors are "consumed directly" (default-class exports,
  no `register*`), and **no reference button-menu composition exists** to copy the
  `[composite-descendant]` + aria-controls/anchored DOM contract from. Adopting it for an auth menu means
  hand-composing 4+ behaviors against an unproven contract + a Playwright :4000 verify — not a 2-pt
  consumer wiring. Type-ahead is also a poor fit for a 2–3 item auth menu (revisit whether it belongs).
- **New blocker `#1335`** — file a FUI-side droplist **menu** registration helper + reference composition
  (the `registerNavigation` analogue for a button-anchored menu). Once it ships, this becomes the true
  size-2 consumer-wiring the card assumed.

## Progress (batch-2026-06-20b) — landed on #1335's registerDroplistMenu

- Migrated the flat header auth control (`plateau:index.html` — a `[user-display]` span + a `[Sign out]`
  button) onto the FUI droplist **menu**: a `profile-trigger` button carrying `anchor` (open/dismiss +
  `aria-expanded`, surface from `aria-controls`) opening a `role="menu"` list carrying `anchored`
  (placement `bottom-end`) + `focus-delegation="role=menu"` (roving menuitem focus). Mirrors the #1284
  `registerNavigation` pilot, now via `registerDroplistMenu` (#1335).
- `plateau:src/main.ts`: `import { registerDroplistMenu } from '@frontierui/blocks/droplist/registerDroplistMenu'`
  + `registerDroplistMenu(attributes, { typeAhead: false })` before `attributes.upgrade(...)`.
- **ACTION-menu pattern (resolved the type-ahead/selection question):** the menuitem is a native
  `<button role="menuitem">` so click + Enter/Space activate natively — no `selection` model and no
  `type-ahead` for a 2-item auth menu (the card's "revisit whether type-ahead belongs" → it doesn't).
  The droplist owns only open/dismiss + focus nav; `#signout-btn`'s existing native click→`handlers.logout`
  wiring is untouched.
- `plateau:src/styles/layout.css`: profile-trigger + menu styling, positioned via `anchor-name` /
  `position-anchor` (native CSS-anchor strategy, JS fallback).
- **Browser-verified live on :4000** (Playwright): logged in → trigger visible, menu hidden; click trigger
  → `aria-expanded=true`, menu shown, `#signout-btn` stamped `role=menuitem`; click Sign out → logged out,
  redirected to `/login`. Zero console/page errors. Plateau gate green (`npm test` — 259/259).
