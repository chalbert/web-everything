---
kind: story
size: 5
parent: "1396"
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
tags: []
---

# native-first gesture recognizer behavior — compute recognition on Pointer Events + touch-action with DI override

Build the default gesture recognizer behavior for the #1428 gesture intent: native-first recognition computed on Pointer Events (+ multi-pointer for pinch/rotate) and touch-action / overscroll-behavior opt-outs, exposed as a behavioral DI / Ambient-Intent seam so the engine (native math vs Hammer.js vs @use-gesture) is swappable. Mirrors hover-intent keeping its mechanic out of the intent. Recognition only — effects live elsewhere (pinch→#1393 viewport, swipe→carousel paging, long-press→contextmenu/command, pan/drag→data-transfer/reorder).

## Pre-flight state-fix (batch-2026-06-21) — locus→frontierui + size 5→8 (mis-flagged + outgrew)

Cascade-freed by #1428 (gesture intent, resolved) and pulled into a batch top-up, then released after
pre-flight:
- **Locus corrected `→ frontierui`.** This is an **impl** (a behavior that *computes* gesture recognition
  on Pointer Events) — runtime, not a contract — so per the constellation statute (#855/#817, WE =
  contracts only; runtime/impl → FUI) it belongs in frontierui, gated there. It had `locus: we`
  (defaulted); set `locus: frontierui`. The gesture *intent* (#1428, the contract) correctly stayed WE.
- **Size 5 → 13 (outgrew).** A FUI grep found **no existing gesture/pointer-recognizer substrate** — this
  is a fully-greenfield engine: native-first recognition for tap · double-tap · long-press · pan · swipe ·
  pinch · rotate (incl. multi-pointer pinch/rotate math) + `touch-action`/`overscroll-behavior` opt-outs +
  the swappable DI/Ambient-Intent seam. That is a focused-session engine build (mirrors #1236 being
  re-sized for greenfield breadth), not a batch-tail item — bumped to 13 so it drops Tier-A and routes to a
  dedicated FUI session. No design fork; purely locus + effort. blockedBy cleared (#1428 resolved).
  (batch-2026-06-21 re-pre-flight: the earlier note said "bumped to 8", but story·≤8 stays in the batch
  pool — corrected to 13 to actually drop Tier-A, honoring the documented "focused-session engine" intent.)

## Split (2026-06-21, `/split 1429`) — re-sized 13 → 5, this is now Slice A

Sliced by recognition mechanism (report `we:reports/2026-06-21-backlog-split-analysis.md`). #1429 stays a
`story` under #1396 (already-parented edge case — no epic conversion) and is now **Slice A**: the
recognizer behavior scaffold + the swappable engine **DI / Ambient-Intent seam** (native-math default,
mirroring `fui:plugs/webbehaviors/viewportPresence.ts`) + `touch-action` opt-out wiring + the a11y-parity
hook + gesture-event dispatch + the three **discrete single-pointer** recognizers (tap · double-tap ·
long-press). Continuous/multi-pointer/edge gestures are sibling stories under #1396 that `blockedBy` this
slice (the DI seam they consume lands here, keeping #1430's `blockedBy: 1429` honest):

- **B** — continuous single-pointer (pan · swipe), `blockedBy: 1429`.
- **C** — multi-pointer (pinch · rotate · two-finger-pan), `blockedBy: 1429` (⟂ B).
- **D** — edge/overscroll path (edge-swipe · pull-to-refresh + `overscroll-behavior`), `blockedBy: B`.

Files: `fui:plugs/webbehaviors/GestureAttribute.ts` (new `CustomAttribute` subclass),
`fui:plugs/webbehaviors/gestureRecognizer.ts` (new engine module), `fui:plugs/webbehaviors/index.ts`,
`fui:plugs/webbehaviors/CustomAttributeRegistry.ts`; demo `fui:demos/gesture-tap-press-demo.html`.

## Progress (batch-2026-06-21-1429-1487)

Built Slice A in frontierui:
- **`fui:plugs/webbehaviors/gestureRecognizer.ts`** (new) — the swappable recognition engine + the
  DI / Ambient-Intent seam. `GestureRecognizerEngine` type (host + config + dispatch → disposer);
  `createNativeGestureRecognizer` native-math default (zero deps); `setGestureRecognizerEngine` /
  `resolveGestureRecognizerEngine` swap an incumbent (Hammer.js / @use-gesture) wholesale. Recognizes
  the three discrete single-pointer gestures (tap · double-tap · long-press) on Pointer Events with
  native-first thresholds (`DEFAULT_THRESHOLDS`: longPress 500ms, doubleTap 300ms, move-tol 10px),
  deterministic (same input → same gestures). Models `fui:plugs/webbehaviors/viewportPresence.ts` (factory seam, recognition
  only — no effect baked in).
- **`fui:plugs/webbehaviors/GestureAttribute.ts`** (new) — the `gesture` `CustomAttribute` (e.g.
  `gesture="tap longpress"`; bare ⇒ all three). Interaction-driven surface ⇒ honours `inert`
  (activate/deactivate). Parses the gesture set, instantiates the resolved engine, sets the
  `touch-action: manipulation` opt-out (restored on teardown), dispatches recognized gestures as
  bubbling/composed DOM events (`tap`/`doubletap`/`longpress`), and provides the keyboard a11y-parity
  floor (Enter/Space ⇒ tap, ContextMenu/Shift+F10 ⇒ longpress). Re-wires on `gesture` attr change.
- **`fui:plugs/webbehaviors/index.ts`** — exported `GestureAttribute` + the engine seam/types.
- **`fui:plugs/webbehaviors/__tests__/unit/gestureRecognizer.test.ts`** (new) — 10 tests: tap,
  move-cancel, long-press, long-press-consumes-pointer, early-release, double-tap, held-single-tap,
  determinism, engine-default, engine-swap-and-restore. All green.
- **`fui:demos/gesture-tap-press-demo.{html,ts}`** (new) — three pads (tap/double-tap, long-press,
  all-three) reflecting recognized-gesture events into a live log; self-bootstraps the registry.

`fui:plugs/webbehaviors/CustomAttributeRegistry.ts` needed no change — registration is the consumer's `registry.define('gesture',
GestureAttribute)` (the demo does this); the seam the siblings (B/C/D) consume is the exported engine,
which lands here. Siblings #1430 (B) / C / D stay `blockedBy: 1429`.
