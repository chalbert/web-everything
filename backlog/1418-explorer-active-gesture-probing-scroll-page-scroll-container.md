---
kind: story
size: 5
locus: frontierui
status: open
dateOpened: "2026-06-21"
tags: []
---

# Explorer active gesture probing: scroll page + scroll-containers, drag, scrollIntoView off-screen candidates, with gesture-time layout oracles

The explorer is **click-only** today: it fires `click` on viewport-visible candidates (`fui:tools/explorer/playwrightDriver.ts` — selector set + `getBoundingClientRect()` visibility gate at ~L17/L101, click at ~L124), and runs Layer-1 oracles only on *settled* states after each click (`fui:tools/explorer/explorer.ts` ~L78/L104). It never scrolls, drags, or observes layout mid-gesture, and it skips off-screen/clipped candidates. So a class of defects is invisible — bad scrolling, content reachable only by scrolling, or overflow *masked by* `overflow:hidden` that a real drag/scroll would expose (the WE-site case, see #1412). Add an active gesture repertoire plus gesture-time layout observation.

## Scope

1. **Scroll the page and scroll-containers.** During exploration, scroll the document and any element with a scrollable overflow (`scrollHeight/scrollWidth > client*` and computed `overflow` ≠ `visible`) through its range. Treat scroll as a first-class exploration action, not just a precondition for clicking.
2. **Reveal off-screen candidates.** `scrollIntoView()` candidates that fail the current viewport visibility gate, then interact — instead of dropping them (today's `getBoundingClientRect()` filter discards everything below the fold).
3. **Drag gestures.** Pointer drag (press → move → release) on draggable / resizer / slider / pannable surfaces. Dragging frequently exposes content or overflow a static or click-only pass cannot — e.g. the Spec Explorer resizer, splitters, carousels, map/canvas pans.
4. **Gesture-time oracles.** Observe layout *during and after* scroll/drag, not only on settled post-click states. New signals: content reachable only by scrolling a region the design didn't intend to scroll; a horizontal scroll that exists *despite* `overflow:hidden` (programmatically scrollable region — the `scrollWidth` residue #1412 documents); scroll position that jumps/resets unexpectedly; a drag that drags the whole page or reveals clipped chrome.
5. **Keep it bounded & deterministic** per the existing GATE/EXPLORE profiles — gestures must respect `maxStates`/`maxDepth` budgets and the deterministic candidate ordering (no flakiness from gesture timing).

## Why this matters here

The WE-site fix (`we:src/css/style.css` → `html { overflow-x: hidden }`) *masks* the off-canvas overflow for users but leaves a 49px programmatically-scrollable region. A click-only, static-`scrollWidth` explorer either misses it or false-positives on it (#1412); an explorer that actually **scrolls and drags** is the robust way to tell a real defect from intentional clipping. User-requested capability, 2026-06-21.

## Notes

- Underlying tool is the FUI-owned explorer (epic #1167); `locus: frontierui`.
- Complements #1412 (refine the static `no-broken-layout` heuristic). #1412 fixes the *signal*; this adds the *gestures* that generate richer signals. They share the same oracle/probe files.
</content>
