---
type: decision
workItem: story
size: 2
parent: "728"
status: active
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-iframe-overlay-escape.md
tags: []
---

# Overlay/modal escape for embedded demos — iframe box vs. host-rendered overlay

**Prepared — ready to ratify.** A demo embedded via the `fuiDemo` shortcode renders in a sandboxed,
fixed-height `<iframe>`; a component that opens a modal/popover/toast can't escape that box to cover the
host docs page. The survey
([`/research/iframe-overlay-escape/`](/research/iframe-overlay-escape/), report
[`2026-06-16-iframe-overlay-escape.md`](../reports/2026-06-16-iframe-overlay-escape.md)) established the
per-document top-layer constraint and the three host-side realizations of escape (A / B1 / B2).

This does **not** pick one mechanism. Applying the fork-existence test, A, B1 and B2 are each a coherent
end-state — none is flawed, so WE mandates none. The decision is therefore **one forced invariant**
(escape is host-side realized over an origin-validated channel) plus **one configurable dimension** (the
escape strategy ∈ {A, B1, B2}, default **A-contained**, B1/B2 supported opt-ins). Picking B1 to *build
first* is prioritization, filed separately — not a standards call. The iframe v1 ships for every
non-overlay demo regardless of how this rules.

## Why it can't escape — a platform constraint, not effort

The blocker is that **the top layer is per-document**. The platform's overlay primitives —
`<dialog>.showModal()` + `::backdrop` and the [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
— paint into a *document's* top layer; an iframe is its own document, so its top layer is confined to the
frame (a security boundary — no iframe content can paint outside its box). The decision decomposes along
three axes, each pinned to the real tree:

- **The frame boundary** — `fuiDemo` (`.eleventy.js:38`) emits a sandboxed iframe
  (`sandbox="allow-scripts allow-same-origin"`, fixed `style="height:${h}px"`, `.eleventy.js:48`); the
  `.fui-demo` wrapper clips with `overflow:hidden` (`src/css/style.css:1657-1662`). There is **no
  host↔demo message channel today** — the iframe is fully static.
- **The trigger** — the [Dialog block](/blocks/dialog/) (`src/_data/blocks.json:3286`) is "native-first
  top-layer mount via `<dialog>` `showModal`/`::backdrop`, never `position:fixed`." Run it inside
  `fuiDemo` and its backdrop dims only the iframe → the **Dialog family (modal/drawer/sheet) is the first
  [#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) block that visibly
  breaks** (the concrete trigger acceptance asks to name).
- **The consumers** — `component.njk:235` is the only overlay-capable consumer;
  `autocomplete.njk:10` is a *contained* droplist popover, not a host-covering overlay.

### Recommended ruling at a glance

| Element | Ruling | Note |
|---------|--------|------|
| **Invariant** | Escape is **host-side realized** over an origin-validated channel | Forced by the per-document top layer — ratify, don't weigh |
| **Dimension** | Escape strategy ∈ **{A, B1, B2}**, default **A-contained** | B1/B2 both supported opt-ins; WE mandates none |
| **Build order** | **B1 first**, B2 deferred | Prioritization, not a fork — filed as a separate build item |
| **C (DI mount)** | **Unavailable** | Genuinely won't work today — gated on ruled-out #700 |

## Fork — escape strategy is a dimension, not a one-of pick

**Crux:** given the per-document top-layer constraint, an overlay can cover the host page only if
*host-side* code realizes it (the host owns its own top layer). The demo signals across the frame
boundary (`.eleventy.js:48`); the host acts. Three host-side realizations exist — and by the
fork-existence test each is a coherent end-state, so they're the **values of one configurable dimension**,
not rivals to choose between:

- **A — contained / auto-resize only.** Grow the frame to fit (the resize handshake below); the overlay
  renders inside the enlarged frame box. *Cannot* cover host chrome above/around the frame (the platform
  constraint). The honest end-state for demos whose overlay fits within the frame's region. **Default.**
- **B1 — host promotes the existing frame.** The demo posts `overlay-open`/`overlay-close`; the host
  toggles a class restyling the frame to `position:fixed; inset:0; z-index:…`. The demo paints its own
  backdrop inside the now-full-viewport frame, so it covers everything. One message, a host class toggle,
  no new backdrop contract. Prior art: the **Intercom messenger** (a launcher iframe the host promotes to
  a fixed full-viewport overlay). The end-state for a demo that just needs to cover the page cheaply.
- **B2 — host renders the backdrop natively.** The demo posts overlay intent + geometry; the host paints
  *its own* `<dialog>`/popover backdrop, positions the frame, and hands off the focus trap. Most "native
  over the docs page" feel. Prior art: Stripe-style web-component-wraps-iframe with rich bidirectional
  `postMessage`. The end-state for a demo that needs the host's *own* chrome around the overlay.

**Ruling: don't pick one — expose the strategy as the per-demo opt-in dimension, default A-contained.** A
is honest and free for the common case (every demo gets it); B1 and B2 are both legitimate opt-ins a demo
author selects by need. WE mandates no single mechanism — the support-all-coherent rule: a fork branch is
real only if it's flawed or won't work, and none of A/B1/B2 is.

- *Deferred-on-priority — B2 (native host backdrop):* **not rejected** — a coherent end-state for a demo
  that wants the host's own chrome (geometry-synced frame + handed-off focus trap). It's simply heavier
  than B1, so its **build** is lower priority, not its merit. "Over-built / not worth it" is a cost
  argument — that's prioritization (a what-to-build-next call), never a fork branch. Filed as a
  separately-prioritized build item; the dimension reserves its slot today so adding it later isn't a
  breaking change (see the enum flag below).
- *Unavailable — C (DI mount):* the one genuine won't-work. Routing overlay-heavy demos to a future
  Shadow-DOM/DI mount is gated on reopening the cross-repo import seam
  [#700](/backlog/700-component-converter-playground-placement/), which was ruled out — out of reach
  today, viable only as "wait," and A+B1 makes waiting unnecessary.

---

## Context

### Supported by default (not decisions)

- **Auto-resize handshake rides along.** Once any host↔demo channel exists, default it **on** (the child
  posts content size, the host resizes the frame) — content-sized beats brittle fixed pixel heights
  across themes/viewports (Q6 most-permissive). **Reuse** the de-facto `postMessage` shape —
  iframe-resizer (davidjbradshaw v5) or oEmbed's real-world height-message pattern — **never mint a WE
  resize protocol** (minimize-lock-in: a protocol is the single escapable lock). This is the "A baseline,"
  not a rival of B1.
- **Overlay-escape is a per-demo opt-in dimension** (Q4), default **A-contained** — the `fuiDemo`
  shortcode gains an optional `overlay` flag. Make it an **enum**, not a boolean: `overlay="promote"`
  (B1) | `overlay="backdrop"` (B2), absent ⇒ A. An enum reserves B2's slot now so shipping it later isn't
  a breaking flag change (most-flexible default — expose the whole axis, not a boolean half of it). Most
  demos omit the flag and don't pay the channel/promote cost.

### Forced invariant (ratify, don't weigh)

- **Origin-validated `postMessage`.** Any host listener must validate `event.origin` against the FUI demo
  host allowlist and ignore unvalidated messages. Overlay + postMessage-spoof are active payment-skimmer
  vectors (The Hacker News, Sep 2025). Fixed under every fork.

### Settled by #728 (protocol home)

- The overlay message contract stays **shortcode-local / unregistered** until a *second* embed consumer
  appears — per #728's own slicing ruling ("carve the generic embed primitive only when a real second
  consumer appears"; today there is one, `component.njk:235`). Register a `webembed`-style protocol in
  `src/_data/protocols.json` *then* (no embed/overlay protocol exists there today). Minting it now is
  premature lock-in for a single WE↔FUI channel (Q2).

### Harvest target (the "more global" view)

- **Escape-an-embedded-frame-overlay is a cross-cutting paradigm**, not a docs-only trick — Intercom
  (promote), Stripe (host backdrop), chat widgets and embedded checkout are all the same shape. So the
  A/B1/B2 dimension is a candidate **`embedded-overlay-escape` intent/capability**, with A/B1/B2 as its
  registered resolver strategies (harvest the cross-cutting paradigm, not just the one-off fix). Don't
  mint it now — the fuiDemo
  Dialog demo is its *first* consumer; **promote the dimension to a registered capability/intent when a
  second consumer appears**, which is the same trigger #728 already sets for protocol registration. The
  ruling here (a dimension, not a one-mechanism pick) is exactly what lets it graduate cleanly later.

## Acceptance (decision done when)

- [ ] Invariant ratified: escape is host-side realized over an origin-validated channel; the concrete
      trigger named: the **Dialog family** (`blocks.json:3286`) is the first #604 block to break.
- [ ] Escape strategy ratified as a **dimension** (A default; B1, B2 supported opt-ins; C unavailable) —
      not a one-mechanism pick. B2's build deferred-on-priority, filed as its own item.
- [ ] #728 §"Known limitation" points here (done at carve time); the post-ruling build slice (B1) carved
      under #728, with the `overlay` enum flag + origin-validated channel on `fuiDemo` (`.eleventy.js:38`).
- [ ] Protocol registration **and** `embedded-overlay-escape` intent promotion both deferred until a
      second embed consumer appears (per #728).
