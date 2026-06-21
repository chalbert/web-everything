---
kind: story
size: 5
parent: "099"
status: resolved
locus: frontierui
relatedTo: ["1406", "1396", "1384"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:blocks/marquee-select/MarqueeSelect.ts"
tags: [build, selection, marquee, spatial, gesture, behavior-block]
---

# Author the marquee-select behavior block (selection + gesture, intersect default)

Realizing build for ratified #1406 Fork-1(a): author a marquee-select behavior block composing selection + the gesture pan recognizer. Owns band geometry + AABB hit-testing over getBoundingClientRect (Pointer Events + setPointerCapture, never HTML DnD), selection-mode dimension (mode: intersect | contain | center, intersect default per Fork 2), modifier vocab (replace | add Shift | toggle Ctrl/Cmd | subtract Alt), drag threshold + edge auto-scroll. Forced a11y-parity invariant: a keyboard equivalent (APG Listbox/Grid Shift+Arrow range-extend, Ctrl+Space toggle, WCAG 2.5.1) that produces the same selection set via model: multiple. Recognizer engine = native math default + DI override + Configurator card, no protocol minted (minimize-lock-in). Ship a demo over a file-grid / board surface. File via /new-standard.

## Progress (batch-2026-06-21)

- Pre-flight state-fix: set `locus: frontierui` (was unset → defaulted to we; runtime gesture math/impl
  per #855/#817, like the pan-zoom block #1441 — it composes the existing selection + gesture intents, no
  new WE protocol).
- **Pure math** `fui:blocks/marquee-select/marqueeMath.ts` — `bandRect` (normalized any-direction drag),
  `hitTest`/`hitIds` per mode (`intersect` default | `contain` | `center`, #1406 Fork 2), `resolveSelection`
  (the modifier vocab: replace / add Shift / toggle Ctrl-Cmd / subtract Alt), `modifierFromEvent`,
  `passedThreshold`. DOM-free.
- **Controller** `fui:blocks/marquee-select/MarqueeSelect.ts` — `createMarqueeSelect(surface, options)`:
  Pointer Events + `setPointerCapture` (never HTML DnD), draws the band overlay past the drag threshold,
  AABB hit-tests via the core, applies the modifier-resolved selection, edge auto-scroll. **A11y-parity
  invariant (#1406):** `extendByKeyboard(itemId, mods)` reproduces any marquee selection via the same
  modifier semantics (APG range-extend). Registered in `fui:src/_data/blocks.json`.
- **Demo** `fui:demos/marquee-select-demo.html` — a 24-tile board; drag to band-select, modifier keys,
  Ctrl+Space keyboard toggle. Verified live on :3001: a band over the top-left quadrant selected 6 tiles.
- 11 unit tests `fui:blocks/__tests__/unit/marquee-select/marqueeMath.test.ts` (band geometry, 3 modes,
  4 modifiers, threshold, hitIds). FUI `check:standards` → 0 errors; typecheck clean.
