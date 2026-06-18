---
type: issue
workItem: task
parent: "136"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
tags: [droplist, anchor, positioning, css-anchor, popover, flip, native]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/149-anchor-positioning-strategy-provider/, label: Positioning strategy provider }
---

# Native `anchored` flip doesn't engage on viewport overflow (position:absolute)

Surfaced closing [#149](/backlog/149-anchor-positioning-strategy-provider/). The native
positioning strategy emits `position-try-fallbacks: flip-block, flip-inline`, but in a
real-browser check (Chromium 148) a surface parked near the **bottom of the viewport**
did **not** flip above its trigger — it overflowed the visible viewport (listbox bottom
872px in a 700px viewport). The JS strategy, positioning `position: fixed` against the
viewport, flips correctly in the same scenario (`data-js-placement` → `top`).

Root cause is a known CSS Anchor Positioning nuance: the browser evaluates
`position-try-fallbacks` overflow against the surface's **containing block**. For a
`position: absolute` surface with no positioned ancestor the containing block is the
initial containing block (document-sized, made tall here by page content), so there is
"room below" in document space and no overflow is detected — even when the surface is
off-screen. Promoting the surface to the Popover top layer alone did not fix it in a
quick probe.

Investigate and pick the native-first fix so `anchored`'s native path flips reliably
at the viewport edge, e.g.:
- pair the surface with the Popover top layer **plus** whatever else position-try needs
  to evaluate against the viewport (it didn't suffice alone — find the missing piece);
- or constrain via `position-visibility` / an explicit fixed-positioned try fallback;
- or document that reliable native flip requires top-layer + X and have `anchored` opt
  surfaces into it when `flip` is requested.

Acceptance: with the **native** strategy, a surface near a viewport edge flips above its
trigger in a real browser (not just emits the fallbacks) — validated in the
`auto-complete-demo` flip card alongside the JS strategy that already passes.

## Progress

- **Status:** resolved (2026-06-07)
- **Repo:** `plateau` (the live auto-complete/anchor sandbox), branch `copilot/glorious-wildcat`
  — NOTE: contradicts the "plateau abandoned" memory; the anchor work is actually here and was
  modified 2026-06-07.
- **Root cause confirmed (Chromium 148 probe):** native strategy used `position: absolute`, whose
  containing block is the ICB / nearest positioned ancestor — `position-try-fallbacks` evaluates
  overflow against *that*, not the viewport, so a surface near the viewport bottom does not flip.
  `position: fixed` makes the containing block the viewport → flip-block engages, AND the browser
  still tracks the anchor on scroll (no script). This is exactly why the JS strategy (already
  `position: fixed`) flips.
- **Fix:** native strategy emits `position: fixed` instead of `absolute`. No popover/top-layer
  coordination needed (top-layer "alone" failed earlier because the `anchor` behavior shows via the
  `hidden` toggle, never `showPopover()`, so the surface never actually entered the top layer).
- **Done:** root-cause probe (absolute vs fixed) in real Chromium; `fui:native.ts` now emits
  `position: fixed`; docstring + demo card-4 copy + `we:anchor.md` note updated; unit assertion
  added (`fui:strategies.test.ts`) + e2e flip test added (`we:e2e/auto-complete-demo.spec.ts`).
  All green: **199 unit + 4 e2e** (Chromium 148), `check:standards` 0 errors.
- **Leftovers filed:** #179 (native `resize` is a no-op), #180 (native `shift` maps to the
  wrong `flip-start` semantics) — both adjacent gaps in the native strategy, out of #161's scope.

### Update (2026-06-08) — fix now lives in Frontier UI (the live impl)

The original fix landed in the abandoned `plateau` prototype. It has since been carried into the
**live reference implementation, Frontier UI**, where the droplist family + `<auto-complete>` now
live: `fui:frontierui/blocks/droplist/positioning/native.ts` emits `position: fixed`. Validated there by
a unit assertion (`fui:positioning/__tests__/strategies.test.ts`) and a real-Chromium e2e flip test
(`fui:blocks/droplist/__tests__/e2e/auto-complete.spec.ts`). The native flip is proven in Frontier UI,
not only plateau.
