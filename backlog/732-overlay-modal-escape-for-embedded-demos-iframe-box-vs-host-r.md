---
type: decision
workItem: story
size: 2
parent: "728"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Overlay/modal escape for embedded demos — iframe box vs. host-rendered overlay

A demo's modal/popover/toast can't escape the iframe box to cover the host docs page. Decide the escape
mechanism: (A) oversized/auto-resizing frame; (B) postMessage-to-parent overlay protocol (host renders
the overlay); (C) defer overlay-heavy components to the #700-gated DI-mount path. v1 fuiDemo iframe ships
for non-overlay demos regardless.

The carved-out fork of [#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/)
(the embed-mechanism epic). v1 — the `fuiDemo` iframe at `.eleventy.js:38` (sandboxed `allow-scripts
allow-same-origin`, clips content to `style="height:${h}px"`) — works for "see the component run" but an
overlay meant to cover the host page shows only inside the demo's box. This decides only the **escape
mechanism**; the iframe v1 ships for every non-overlay demo regardless of how this rules.

## Forks

- **A — oversized / auto-resizing frame.** A `postMessage` resize handshake (demo reports content size →
  WE grows the iframe). Cheapest; keeps the boundary pure. Limit: still clips to *some* box — a true
  full-page modal/backdrop can't cover host chrome above/around the frame.
- **B — `postMessage`-to-parent overlay protocol.** The demo posts an "open overlay" message; the WE host
  page renders the backdrop/positioning natively. Overlays feel native over the docs page, no shared
  runtime. Cost: a new bidirectional message contract WE and FUI both implement (a small protocol).
- **C — defer overlay-heavy components to the DI-mount path.** Don't solve it under the iframe; route
  modal/popover demos to the future Shadow-DOM/DI mount. **Gated on reopening #700** (cross-repo import),
  so out of reach today — viable only as "wait."

## Default (to ratify)

**B — the `postMessage`-to-parent overlay protocol**, *if* an overlay-heavy block actually needs a
native-feeling overlay before the DI path exists; otherwise **A** as the zero-protocol stopgap. C is not
available until #700 reopens. Prepare via `/prepare 732` (survey iframe-resizer / oEmbed `postMessage`
prior art) before ratifying.

## Acceptance (decision done when)

- [ ] Escape mechanism ratified among A / B / C, with the concrete trigger (which #604 block first needs it).
- [ ] #728 §"Known limitation" points here (done at carve time); the post-ruling build slice carved under #728.
