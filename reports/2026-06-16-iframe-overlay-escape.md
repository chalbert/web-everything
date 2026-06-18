# Embedded-demo overlay escape — how an iframed demo's modal covers the host page

**Date**: 2026-06-16
**Point**: The reason an iframed demo's overlay can't cover the host docs page is a *platform constraint* (the top layer is per-document), not an effort tradeoff — so the genuine #732 call is the escape mechanism, with auto-resize a solved reuse and the protocol home settled by #728.
**Research page**: `/research/iframe-overlay-escape/`
**Prepares**: decision [#732](../backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r.md)
---

## Question

`#732` (a carved fork of the embed-mechanism epic `#728`): a demo embedded via the `fuiDemo`
shortcode (`we:.eleventy.js:38`) renders in a sandboxed, fixed-height `<iframe>`. A component that opens a
modal/popover/toast can't escape that box to cover the host docs page. Decide the escape mechanism among
(A) oversized/auto-resizing frame, (B) postMessage-to-parent overlay protocol, (C) defer to the DI-mount
path — and name the concrete first trigger.

## Recommendation

The survey reshaped the A/B/C-as-equals framing into **one genuine fork plus three settled elements**:

- **Genuine fork — the escape mechanism.** Recommended **A-contained baseline + B1-promote on opt-in**.
  *B2 (native host backdrop) rejected* as over-built for a "see it run" demo; *C (DI mount) unavailable*
  (gated on reopening `#700`). Confidence **med** — B1 vs B2 is where judgment actually lives.
- **Supported by default** — an auto-resize handshake rides along once any channel exists; reuse the
  iframe-resizer / oEmbed `postMessage` height shape, never mint a WE resize protocol.
- **Forced invariant** — origin-validated `postMessage` (allowlist the FUI demo host).
- **Settled by #728** — the overlay message contract stays shortcode-local/unregistered until a *second*
  embed consumer appears (today there is one: `we:component.njk:235`), then registers as a `webembed`-style
  protocol.

## Key Findings

1. **The blocker is the per-document top layer — a security boundary, not effort.** `<dialog>.showModal()`
   + `::backdrop` and the Popover API paint into a *document's* top layer; an iframe is its own document,
   so its top layer is confined to the frame. No bigger frame or extra code overcomes this.
2. **The Dialog block is the concrete trigger.** `fui:blocks.json:3286` — the Dialog family's thesis is
   "native-first top-layer mount via `<dialog>` `showModal`/`::backdrop`, never `position:fixed`." Run it
   inside `fuiDemo` and the backdrop dims only the iframe. So the Dialog family (modal/drawer/sheet) is
   the first `#604` block that visibly breaks — the trigger #732's acceptance asks to name.
3. **Resize is a solved, de-facto-standard protocol.** iframe-resizer (davidjbradshaw, v5) — child posts
   content size, parent resizes, `MutationObserver`/`ResizeObserver`-driven, child-initiated to bypass
   cross-origin. oEmbed's `rich` type nominally requires fixed height, but Twitter/Instagram-class
   providers post height over `postMessage` instead. → reuse the message shape; don't mint a WE protocol.
4. **The overlay concern splits into B1 vs B2.** B1 = host promotes the existing frame to a fixed
   full-viewport layer (Intercom messenger model; one boolean message). B2 = host renders the
   backdrop/positioning natively (Stripe-style; geometry + focus-trap contract). The original item
   collapsed both into one "B".
5. **Origin validation is mandatory.** Overlay + postMessage-spoof are active payment-skimmer vectors
   (The Hacker News, Sep 2025). A fixed rule under every fork, not a branch.
6. **Protocol home is premature today.** One overlay consumer (`we:component.njk:235`;
   `we:autocomplete.njk:10` is a *contained* droplist). #728's slicing note already rules: carve the generic
   embed primitive only when a real second consumer appears. So the contract stays shortcode-local now.

## Classification (per-fork pass)

| Q | Answer |
|---|---|
| Layer | Shortcode = devtools; overlay contract = a *future* Protocol candidate |
| Protocol or impl detail? | Resize = reuse existing protocol; overlay = no registry entry until 2nd consumer (#728) |
| Fixed or dimension? | Per-demo dimension — `fuiDemo` gains an opt-in overlay flag |
| Most-permissive default? | Resize **on**; overlay-escape **off / opt-in** |
| Seam | Overlay traverses the frame boundary; dimension owned by the embed mechanism (host owns the frame) |

## Files Created/Modified

| File | Action |
|------|--------|
| `we:src/_data/researchTopics.json` | Added `iframe-overlay-escape` registry entry |
| `we:src/_includes/research-descriptions/iframe-overlay-escape.njk` | New research write-up |
| `we:reports/2026-06-16-iframe-overlay-escape.md` | This report |
| `backlog/732-…overlay-modal-escape….md` | Rewritten to prepared-fork shape; `preparedDate` stamped |
