---
kind: epic
parent: "1255"
status: resolved
dateOpened: "2026-06-15"
dateResolved: "2026-06-22"
graduatedTo: none
tags: [embedding, iframe, components, docs, mechanism, capability]
relatedReport: reports/2026-06-15-728-backlog-split-analysis.md
crossRef: { url: /backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/, label: "#604 — WE block-page consumer of this capability" }
---

# Component embedding capability — embed a live component example in a docs page (iframe v1, alternatives for overlay/modal cases, DI-mount future)

The cross-cutting home for the *mechanism* of embedding a live, interactive component example inside a
docs/marketing page — distinct from any one consumer ([#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/)
is the WE-block-page consumer). Many use cases (YouTube/Facebook-style third-party embeds, and our own
component-example case) and many mechanisms. v1 = an iframe to a separately-hosted demo (the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/)
`fuiDemo` shortcode) — for the WE→FUI case also the **only** mechanism consistent with [#700](/backlog/700-component-converter-playground-placement/)
(no cross-repo import — the [we-fui-embed-boundary](docs/agent/platform-decisions.md#we-fui-embed-boundary) rule). Known limit: an iframe clips to its box, so a demo's modal/overlay can't cover the
host page — a slice investigates alternatives and the eventual DI-mount path.

Decided in [#707](/backlog/707-reconcile-604-s-we-renders-real-fui-blocks-framing-with-the-/) (the #604↔iframe
reconciliation): the embed *mechanism* is a general concern with many approaches, so it gets its own epic
rather than being baked into #604. #604 stays the WE-docs *application* (a live FUI demo on every block
page) and **consumes** this capability at v1 = iframe.

## Why this is its own epic (not part of #604)

- **Many use cases, many mechanisms.** "Embed a live thing in a page" spans third-party embeds
  (YouTube/Facebook-style `<iframe>` + oEmbed), and our first-party component-example case. The right
  mechanism differs per case; collapsing it into #604 (one consumer) would hide that axis.
- **The mechanism outlives any one consumer.** #604 is *one* application; a marketing page, a protocol
  page, or a future product surface may embed the same way. The capability is the shared home.
- **iframe is v1, not forever.** It's the simplest to stand up and (for WE→FUI) the only #700-consistent
  option today, but it carries real limits (below). Keeping the mechanism in its own epic gives the
  v1→alternatives→DI evolution a place to live without re-litigating #604.

## v1 — iframe (the `fuiDemo` mechanism)

- Reuse the [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/) `fuiDemo`
  Eleventy shortcode (`we:.eleventy.js:38`): a sandboxed, FUI-branded `<iframe>` pointing at a
  separately-hosted demo. No cross-repo import — consistent with the docs-rendering boundary.
- Simplest to put in place; the demo is plainly a deliverable of whoever hosts it (FUI keeps provenance).

## Known limitation — overlay/modal components → [#732](/backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r/)

An iframe clips its content to the frame box, so a component that renders a **modal, popover, toast, or
any overlay meant to cover the host page** cannot escape the frame — it shows only within the demo's box.
Fine for "see the component work"; wrong if the overlay should feel native over the docs page. The escape
mechanism is a real fork (oversized/auto-resizing frame · `postMessage`-to-parent overlay protocol ·
defer to the DI-mount path) — carved out as the decision card
[#732](/backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r/). The iframe v1 ships
for every non-overlay demo regardless of how #732 rules.

## Future — non-iframe / DI component mount (DELIVERED)

The DI/in-document mount path that this section framed as gated is now built: the cross-repo isolation
boundary was relaxed for an in-document DI mode ([#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/),
resolved) and the FUI embed SDK gained a Shadow-DOM in-document render mode
([#786](/backlog/786-mode-c-fui-embed-sdk-gains-a-shadow-dom-in-document-render-m/), resolved), so
overlays can render natively rather than clipping to an iframe box.

## Slicing note (RESOLVED — scope delivered by children)

Sliced umbrella (size-less; children carried the points). See
[we:reports/2026-06-15-728-backlog-split-analysis.md](../reports/2026-06-15-728-backlog-split-analysis.md).
All carved children resolved; the epic resolved 2026-06-22.

- **Children (all resolved):**
  - [#732](/backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r/) — overlay/modal
    escape (`decision`).
  - [#807](/backlog/807-build-the-fui-owned-embed-sdk-skeleton-render-mode-axis-b1-f/) — FUI-owned embed
    SDK skeleton / render-mode axis (the generic embed primitive beyond `fuiDemo`).
  - [#764](/backlog/764-b2-native-host-backdrop-overlay-mode-for-the-fui-embed-sdk/) +
    [#808](/backlog/808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d/) — overlay-escape
    build + end-to-end exercise (the post-ruling overlay slice).
  - [#765](/backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo/) +
    [#786](/backlog/786-mode-c-fui-embed-sdk-gains-a-shadow-dom-in-document-render-m/) — DI / Shadow-DOM
    in-document mount.
- **Out of scope (no consumer — a different capability, not undelivered scope):**
  - *Third-party oEmbed adapter* (YouTube/Facebook-style) — no consumer surface today; file fresh under a
    real consumer if one appears.
- **Shipped v1:** the `fuiDemo` iframe (`we:.eleventy.js:38`, [#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/)).
