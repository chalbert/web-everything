---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-05-31"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: intent:focus-containment
tags: [gap-analysis, intent, protocol, a11y, focus]
---

# Decide on Focus & Announcements intent / a11y protocol (gap #6)

Focus-trap, roving tabindex, `inert`, and live-region announcements live **scattered** across `modal`, `type-ahead`, and `selection` but are owned nowhere. A `focus` intent or small a11y protocol would centralize them. Native: `inert`, `aria-live`, focus management, `:focus-visible`.

## Triage context

- **Kind**: Intent and/or Protocol
- **Native anchor**: `inert`, `aria-live`, roving tabindex, focus management
- **Native-first**: ◆ medium · **Gap**: ◆ medium · **Effort**: ◆ medium
- **Rank**: 6

## Open call

Intent vs protocol vs both — and which existing intents (`modal`, `type-ahead`, `selection`) re-point at it.

## Decision (2026-06-08)

The gap is **mostly already resolved** by intents that shipped after this item was triaged:

- **Roving/virtual tabindex + arrow-within** → owned by the **`focus-delegation`** intent.
- **Live-region announcements** → owned by the **`live-region-status`** intent.

What remains genuinely unowned is **focus containment** — `trap`, `restore`-on-close,
`initialFocus`, and `inert`-ing the background — which today lives only inline inside the
**`modal`** intent's "Focus Management" block, reusable nowhere.

**Ruling:**

1. **Intent, not protocol.** Focus containment is behavioral UX vocabulary mapping to native
   `inert` + focus management; it has no vendor-implemented registry/contract, so it is not a
   Protocol. This also keeps it consistent with its two a11y siblings (`focus-delegation`,
   `live-region-status`), which are already intents.
2. **A new `focus-containment` intent, separate from `modal`.** Modal is not the only surface
   that traps (anchored popovers in modal mode, drawers, sheets do too), so trapping must be a
   standalone, composable intent — not buried in `modal`. Confirmed with the user: focus behavior
   is an intent and should be separate from the modal.
3. **Re-point `modal`** to compose `focus-containment` (drop its inline trap/restore/initial
   block). `type-ahead` and `selection` already delegate focus *movement* to `focus-delegation`
   and announcements to `live-region-status`, so they need no change.

This makes the follow-through an agent-ready build: author the `focus-containment` intent +
re-point `modal`.

## Progress

- **Status:** resolved — `focus-containment` intent authored; `modal` re-pointed; validator green.
- **Branch:** docs/standard-authoring-workflow
- **Done:** Added the `focus-containment` intent to `src/_data/intents.json` (dimensions
  `trap` / `background` (native `inert`) / `initialFocus` / `restore`, with research + interface
  protocol). Re-pointed the `modal` intent to compose it (dropped its inline trap/restore block and
  inline `FocusStrategy` interface; `mode: modal` defaults to trap+inert, `modeless` to none).
  `npm run check:standards` is 0-error (31 intents); `/intents/focus-containment/` renders 200.
- **Outcome:** Gap #6 was already ~2/3 covered by the shipped `focus-delegation` (movement) and
  `live-region-status` (announcements) intents; the remaining containment concern is now the third
  a11y intent. Resolved as **intent, not protocol**; **separate from modal**.
- **Leftover:** #187 — reciprocal Anchor↔Focus-Containment cross-link (one-directional today).
