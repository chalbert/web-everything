# Platform-standards watch (#1257) — review run 2026-06-20 (first run, L0→L1)

First execution of the platform-standards watch via `/review-program`. This is the program's L0→L1
graduation (defined → skill-assisted). A first run catches the *accumulated* backlog of platform
movement; subsequent runs re-sweep only the delta since this date and are idempotent.

## Orient

- **Program:** #1257 — Platform-standards watch. Two fronts: **A (conformance)** WE standards defer
  to native equivalents (native-first floor #031); **B (currency)** a new native capability shipped.
- **Prior state:** childless program, no prior children, no prior review. Front-A metric not built
  (L0). After this run #1257 becomes a *storied ongoing* program.
- **Lenses swept:** specs+Baseline, a11y/APG, TC39/JS. (All three declared lenses covered.)

## Front-B delta — capabilities that crossed a threshold

| Native capability | Status (mid-2026) | WE standard touched | Action filed |
|---|---|---|---|
| Customizable `<select>` / `appearance: base-select` | Chrome/Edge 135 stable, ~96% use, **not yet Baseline** | droplist/dropdown/multi-select/tree-select | re-eval parked **#291** |
| CSS anchor positioning | All engines (FF 147 stable Jan 2026, Safari 26), approaching Baseline | anchor intent (#149 used floating-ui) | **#1262** |
| Popover API | **Baseline Widely Available** (Apr 2025) | disclosure/dialog/overlay intents | **#1261** |
| `command`/`commandfor` invokers | Shipping (Chromium) | command intent (#299, webcommands #016) | **#1263** |
| Same-document View Transitions | **Baseline Newly Available** (Oct 2025, FF 144) | view-transitions protocol (#015) | **#1264** |
| Scroll-driven animations (`scroll-timeline`/`view-timeline`) | Maturing; Interop 2026 focus | webscroll project (#014) | **#1265** |
| APG combobox pattern update (aria-controls) | Updated 2025 | combobox/dropdown/tree-select/autocomplete intents | **#1266** |

**TC39/JS lens:**
- Stage 4 (shipping) 2025–26: Iterator helpers, Set methods, `using`/explicit resource management,
  `Error.isError`, `Array.fromAsync`, `RegExp.escape` → runtime native-first cleanup → **#1268**.
- Signals proposal (early stage, very active) → future native substrate for webexpressions → **#1269**.
- Temporal (target 2027) and Decorators (Stage 3) → **tracked, not filed** (native-first triggers on
  availability, not on proposal stage). Revisit as they near Stage 4.

## Items filed (9) — all under #1257

#1261 popover resolver · #1262 anchor positioning strategy · #1263 invoker commands · #1264 view
transitions · #1265 scroll-driven animations · #1266 APG combobox reconcile · #1267 front-A metric
(L0→L1 step) · #1268 ES built-ins audit · #1269 Signals watch.

**Not filed (deduped):** base-select → existing parked **#291** (flagged for re-evaluation, trigger
now near, not duplicated). Temporal/Decorators → tracked above.

## Front-A read

Not yet quantifiable — the conformance metric does not exist (that is #1267). Qualitatively, items
#1261–#1265 are all cases where a native equivalent shipped while WE's stance predates it: exactly
what front A exists to catch. Building #1267 makes the *next* run quantitative.

## Coverage / caveats

- All three declared lenses swept. Depth was breadth-first (threshold crossings), not exhaustive per
  spec — a deeper per-standard pass happens when each filed item is worked.
- Baseline/ship-status figures are point-in-time (mid-2026) from the sources below; the worked items
  must re-verify exact Baseline status at implementation time.

## Sources

- [Customizable select — MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select) · [DebugBear](https://www.debugbear.com/blog/customizable-select-with-native-html)
- [CSS anchor positioning — Chrome for Developers](https://developer.chrome.com/blog/anchor-positioning-api) · [OddBird update](https://www.oddbird.net/2025/10/13/anchor-position-area-update/)
- [Popover API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) · [Popover reached Baseline](https://www.jomaendle.com/blog/html-popover)
- [Same-document view transitions Baseline — web.dev](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available) · [View transitions 2025 — Chrome](https://developer.chrome.com/blog/view-transitions-in-2025)
- [Scroll-driven animations — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines) · [Interop 2026 — CSS-Tricks](https://css-tricks.com/interop-2026/)
- [ARIA APG combobox pattern — W3C](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [TC39 finished proposals](https://github.com/tc39/proposals/blob/main/finished-proposals.md) · [TC39 Stage 4 2025 — InfoQ](https://www.infoq.com/news/2025/06/tc39-stage-4-2025/) · [TC39 Signals proposal](https://github.com/tc39/proposal-signals)
