---
type: decision
workItem: story
size: 2
parent: "728"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
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
(escape is host-side realized over an origin-validated channel), implemented by a **FUI-owned embed SDK WE
loads** (the Facebook-/Stripe-/oEmbed embed model — impl→FUI, not WE-authored host glue), plus **one
configurable dimension** (the escape strategy ∈ {A, B1, B2}, default **A-contained**, B1/B2 supported
opt-ins). Picking B1 to *build first* is prioritization, filed separately — not a standards call. A fourth
mode, **C (in-document / DI mount)**, is out for general consumers but recorded as a **future trust-gated
option for the WE↔FUI pair only** (see the C bullet) — not needed for escape, pursued for fidelity. The
iframe v1 ships for every non-overlay demo regardless of how this rules.

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
| **Ownership** | The host-side escape impl is a **FUI-owned embed SDK WE loads**, not WE-authored host glue | The Facebook-/Stripe-/oEmbed embed model: impl→FUI |
| **Dimension** | Escape strategy ∈ **{A, B1, B2}**, default **A-contained** | Render modes of one FUI embed SDK; B1/B2 both supported opt-ins; WE mandates none |
| **Build order** | **B1 first**, B2 deferred | Prioritization, not a fork — filed as a separate build item |
| **C (DI mount)** | **Out for general consumers; a future trust-gated mode for WE↔FUI** | Not needed for escape (A/B1/B2 suffice); a fidelity option, gated on relaxing the isolation boundary |

## Fork — escape strategy is a dimension, not a one-of pick

**Crux:** given the per-document top-layer constraint, an overlay can cover the host page only if
*host-side* code realizes it (the host owns its own top layer). The demo signals across the frame
boundary (`.eleventy.js:48`); host-side code acts.

**Who owns that host-side code? FUI, not WE — the embed model.** When a site embeds a Facebook Like
button it doesn't `npm install` Facebook's UI lib; it drops in an embed (a tag + `sdk.js`) and **Facebook
owns the implementation** of everything that embed does, including the overlays that escape the button's
box. The host-side glue is the *provider's* code running on the page, shipped as an embed SDK. Same here:
the overlay-escape coordination is **implementation of the embed**, so it's a **FUI-owned embed SDK that
WE loads** (the FB-/Stripe-/oEmbed shape; same ownership as the iframe-resizer host half cited below) —
*not* glue hand-written into WE's eleventy templates. WE authors no overlay logic; it loads the FUI embed
loader and drops the tag. This is impl→FUI, and — being a **runtime, versioned, FUI-published bundle
behind a stable embed contract** — it never touches the build-time WE→FUI *source* import #700 ruled out
(no module import, no fixture drift).

Three host-side realizations exist — and by the fork-existence test each is a coherent end-state, so
they're the **render modes of one FUI embed SDK**, not rivals to choose between:

- **A — contained / auto-resize only.** The SDK grows the frame to fit (the resize handshake below); the
  overlay renders inside the enlarged frame box. *Cannot* cover host chrome above/around the frame (the
  platform constraint). The honest end-state for demos whose overlay fits within the frame's region.
  **Default.**
- **B1 — the SDK promotes the existing frame.** The demo posts `overlay-open`/`overlay-close`; the FUI
  embed SDK (running host-side) toggles a class restyling the frame to `position:fixed; inset:0; z-index:…`.
  The demo paints its own backdrop inside the now-full-viewport frame, so it covers everything. One
  message, a class toggle, no new backdrop contract. Prior art: the **Intercom messenger** (a launcher
  iframe the provider promotes to a fixed full-viewport overlay). The end-state for a demo that just needs
  to cover the page cheaply.
- **B2 — the SDK renders the backdrop natively.** The demo posts overlay intent + geometry; the FUI embed
  SDK paints *its own* `<dialog>`/popover backdrop in the host doc, positions the frame, and hands off the
  focus trap. Most "native over the docs page" feel. Prior art: Stripe-style web-component-wraps-iframe
  with rich bidirectional `postMessage`. The end-state for a demo that needs the host's *own* chrome
  around the overlay.

**Ruling: don't pick one — expose the strategy as the per-demo opt-in dimension, default A-contained,
implemented by the FUI-owned embed SDK.** A is honest and free for the common case (every demo gets it);
B1 and B2 are both legitimate opt-ins a demo author selects by need. WE mandates no single mechanism — the
support-all-coherent rule: a fork branch is real only if it's flawed or won't work, and none of A/B1/B2 is.

- *Deferred-on-priority — B2 (native host backdrop):* **not rejected** — a coherent end-state for a demo
  that wants the host's own chrome (geometry-synced frame + handed-off focus trap). It's simply heavier
  than B1, so its **build** is lower priority, not its merit. "Over-built / not worth it" is a cost
  argument — that's prioritization (a what-to-build-next call), never a fork branch. Filed as a
  separately-prioritized build item; the dimension reserves its slot today so adding it later isn't a
  breaking change (see the enum flag below).
- *Out for general consumers; a future trust-gated mode for WE↔FUI — C (DI / in-document mount):*
  A/B1/B2 keep the component in an **iframe** and have the SDK coordinate escape host-side. C drops the
  iframe and mounts the FUI component **directly in the host's own DOM** (Shadow-DOM / DI mount) — then
  overlays escape *natively*, with zero coordination, because the component shares the host's top layer.
  The render-mode spectrum, ordered isolation↓ / trust-required↑ / fidelity↑:

  | Mode | Boundary | Trust needed | Who |
  |------|----------|--------------|-----|
  | A / B1 / B2 | iframe content; SDK coordinates escape | low (sandbox + origin-validated channel) | **any** site embedding a FUI component |
  | **C (in-document)** | component mounts in host DOM; native escape | **complete** — FUI runs with host page privileges | **only a fully-trusted host = WE itself** |

  For a third-party site the iframe is the right answer **forever** — it must not run FUI in-process. But
  **WE↔FUI is one constellation, same author, complete trust**, so for WE's *own* docs C becomes reachable
  — delivered as the **in-document render mode of the same FUI embed SDK** (still a runtime FUI-published
  bundle, *not* the build-time source import #700 ruled against). Two honest caveats: (1) it **relaxes the
  isolation boundary** the constellation currently states absolutely (*"WE never renders FUI block code in
  its own document"*) — impl→FUI still holds, but the iframe wall comes down for the trusted pair; that's
  a deliberate boundary change to ratify separately, not assumed here. (2) it is **not needed for escape**
  — A/B1/B2 already cover the page; C buys only *fidelity* (real component in the real page, zero
  coordination) at the cost of isolation (a demo JS error / CSS bleed can now reach WE's docs; Shadow DOM
  mitigates, not eliminates). So: **filed as a future, trust-gated, WE-only option**, no longer "never,"
  but explicitly out of scope for this ruling. (The older "gated on reopening #700" framing was too
  soft — #700 ruled out *source import*; C rides the *runtime SDK* instead.)

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

- **Origin-validated `postMessage` — but FUI is a trusted sibling, not a third party.** The host listener
  validates `event.origin` against the FUI demo host allowlist and ignores unvalidated messages — that
  guards the *channel* against a spoofed sender, and stays fixed under every mode. What it is **not** is a
  statement that FUI is untrusted: the general-web payment-skimmer vector (overlay + postMessage-spoof,
  The Hacker News, Sep 2025) is a **cross-organization** trust problem, and **WE↔FUI is one constellation,
  same author — complete trust**. So loading FUI's embed SDK (host-side code with page privileges) is an
  accepted intra-constellation dependency, not a supply-chain risk; origin-validation defends the boundary
  against *outsiders*, it doesn't treat FUI as one. (This trust is exactly what makes C reachable for WE —
  see the C bullet.)

### Settled by #728 (protocol home)

- The overlay message contract is **owned by the FUI embed SDK** (impl→FUI), and stays
  **shortcode-local / unregistered** as a WE-side *protocol* until a *second* embed consumer appears — per
  #728's own slicing ruling ("carve the generic embed primitive only when a real second consumer appears";
  today there is one, `component.njk:235`). Register a `webembed`-style protocol in
  `src/_data/protocols.json` *then* (no embed/overlay protocol exists there today). Minting it now is
  premature lock-in for a single WE↔FUI channel (Q2). Note the SDK *implements* the contract; the WE-side
  protocol entry, when it lands, only *describes* it — WE never owns the impl.

### Harvest target (the "more global" view)

- **Escape-an-embedded-frame-overlay is a cross-cutting paradigm**, not a docs-only trick — Intercom
  (promote), Stripe (host backdrop), chat widgets and embedded checkout are all the same shape. So the
  A/B1/B2 dimension is a candidate **`embedded-overlay-escape` intent/capability**, with A/B1/B2 as its
  registered resolver strategies (harvest the cross-cutting paradigm, not just the one-off fix). Don't
  mint it now — the fuiDemo
  Dialog demo is its *first* consumer; **promote the dimension to a registered capability/intent when a
  second consumer appears**, which is the same trigger #728 already sets for protocol registration. The
  ruling here (a dimension, not a one-mechanism pick) is exactly what lets it graduate cleanly later.

## Ruling (2026-06-16)

**Ratified.** Three settled elements, no open fork:

1. **Invariant — escape is host-side realized over an origin-validated channel, implemented by a
   FUI-owned embed SDK that WE loads** (the Facebook-/Stripe-/oEmbed embed model; impl→FUI, not
   WE-authored eleventy glue). The channel validates `event.origin` against outsiders, but FUI is a
   **trusted intra-constellation sibling**, not a third-party supply-chain risk. The concrete trigger is
   the **Dialog family** (`blocks.json:3286`) — the first #604 block whose `::backdrop` visibly dims only
   the iframe.
2. **Dimension — escape strategy ∈ {A, B1, B2}, render modes of one FUI embed SDK, default A-contained;
   B1 and B2 both supported opt-ins via an `overlay` enum flag** (`promote` / `backdrop`, absent ⇒ A). WE
   mandates no single mechanism. **B1 builds first** (carved under #728); **B2 is deferred-on-priority,
   not rejected** → filed as **[#764](/backlog/764-b2-native-host-backdrop-overlay-mode-for-the-fui-embed-sdk/)**.
3. **C (in-document / DI mount) — out of scope here, recorded as a future trust-gated option for the
   WE↔FUI pair only.** It rides the runtime SDK (not the #700-ruled-out source import) and would relax the
   constellation's isolation boundary, so it is its own decision → filed as
   **[#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/)**. Not needed for
   escape (A/B1/B2 cover it); a fidelity option only.

The **`embedded-overlay-escape` intent promotion** and the **`webembed` protocol registration** both stay
deferred until a second embed consumer appears (per #728). `graduatedTo: none` — this decision informs the
#728 build slices and the two spin-offs (#764, #765); it is not itself a shipped entity.

## Acceptance (decision done when)

- [ ] Invariant ratified: escape is host-side realized over an origin-validated channel, implemented by a
      **FUI-owned embed SDK WE loads** (not WE-authored host glue); the concrete trigger named: the
      **Dialog family** (`blocks.json:3286`) is the first #604 block to break.
- [ ] Escape strategy ratified as a **dimension** of render modes (A default; B1, B2 supported opt-ins) —
      not a one-mechanism pick. B2's build deferred-on-priority, filed as its own item.
- [ ] **C (in-document / DI mount)** recorded as a *future trust-gated mode for WE↔FUI only*, out of scope
      for this ruling, and explicitly gated on a separate decision to relax the isolation boundary (it
      rides the runtime SDK, not the #700-ruled-out source import). Filed as its own item.
- [ ] #728 §"Known limitation" points here (done at carve time); the post-ruling build slice (B1) carved
      under #728, with the `overlay` enum flag + origin-validated channel on `fuiDemo` (`.eleventy.js:38`).
- [ ] Protocol registration **and** `embedded-overlay-escape` intent promotion both deferred until a
      second embed consumer appears (per #728); the contract's impl is FUI-owned, the WE protocol entry
      only describes it.
