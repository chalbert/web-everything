# Block-Explorer manipulation channel & UI locus — prior-art survey (prep for decision #809)

**Date:** 2026-06-16 · **Prep for:** [#809](/backlog/809-block-explorer-workbench-render-locus-manipulation-channel-f/)
(under Block Explorer epic [#746](/backlog/746-block-explorer-the-interactive-fui-block-workbench-live-them/)) ·
**Companion topic:** the [component-workbench landscape](/research/component-workbench-landscape/) (#624) already
catalogued *which tools* exist and their business models; this survey is the orthogonal, **technical** question
the four manipulating slices (#749/#750/#755/#806) turn on: *how a workbench drives and inspects a **live**
rendered component* — host-side (in-document) vs across an iframe message channel — and *who owns the control
chrome*.

## The question

#727 shipped the per-component **live render** as a sandboxed `fuiDemo` **iframe** (FUI-hosted demo,
`we:.eleventy.js:38`, cross-origin to WE). Four #746 children need to *manipulate* that running block:

- **#749** — swap design systems / tokens live, A/B + token-diff, axis sliders, dark/RTL/container-query.
- **#750** — toggle/activate traits live + a state-machine inspector.
- **#755** — inspection devtools: "why this token" (computed→source), source/ARIA pane (inline axe),
  event log, provider↔consumer graph.
- **#806** — exploded/layered anatomy + toggle-a-piece-off-to-degrade on the running block.

All four reach **into** the rendered block — set its theme, flip its attributes, read its computed styles / ARIA
tree / shadow DOM. The cross-origin `fuiDemo` iframe forbids that reach. So two design axes are open: **(1)** the
manipulation *channel* and **(2)** the control-UI *locus*.

## Prior art surveyed

### 1. Storybook — manager↔preview **iframe + postMessage channel** (the iframe-protocol precedent)

Storybook (the category anchor; [component-workbench landscape](/research/component-workbench-landscape/))
splits a **manager** (the chrome: sidebar, addons, **Controls** panel) from a **preview** that renders the story
**inside an iframe**. The two halves stay in sync over a **postMessage channel** (`@storybook/channels` /
the historical `channel-postmessage` `PostmsgTransport`): selecting a story or changing a **Control** dispatches
an event across the channel; the preview re-renders with the new **args**. Globals/args round-trip the same way
(e.g. `UPDATE_QUERY_PARAMS`, save/restore globals on preview init).

**Load-bearing finding:** Storybook proves an iframe + message protocol works *for pushing inputs **in*** —
args, globals, the selected story. It does **not** do deep host-side **inspection** across the frame: Controls
serialize a fixed, declared arg schema in one direction; the manager never reads the preview's computed styles,
ARIA tree, or shadow DOM. (Damato's "Storybook iframe tango" documents the coordination tax even within this
limited scope.) So Storybook is evidence *for* the iframe channel on the **theme/trait push** subset — and
silent on the **inspection** subset.

### 2. api-viewer (open-wc) — **same-document mount + live knobs** (the in-document precedent)

`api-viewer-element` is a single web component that renders a Custom Elements Manifest as **live docs + a props
playground**, mounting a real instance of the documented component **in the same document**. Its **Knobs** panel
toggles **properties, attributes and slots** on the live instance and updates the code snippet; dedicated panels
surface **CSS Custom Properties** and **CSS Shadow Parts**. It is the closest shipping analog to a WE-native
block workbench — and it is **entirely host-side**: because the component is in the same document, the controls
manipulate and read it directly, with **no message protocol at all**. This is a working reference design for
exactly the in-document (mode-C) channel #809 Fork 1-A proposes.

### 3. The platform: CSS custom properties + `getComputedStyle` vs the same-origin wall

- **Theming is free host-side.** CSS **custom properties pierce the shadow boundary by design** (MDN; Open WC
  "styles piercing shadow DOM"): a host sets `--token: value` on the shadow **host** element and the value flows
  into the component's shadow tree. So "swap the design system" (#749) is, host-side, *set custom properties on
  the mount* — **zero protocol**.
- **Inspection is free host-side.** `Window.getComputedStyle()` returns the **resolved** value of every CSS
  property after cascade — the literal mechanism behind "why this token" (#755). Shadow roots are walkable from
  the host (`element.shadowRoot`, DevTools Elements panel). All of this is plain same-document DOM.
- **The cross-origin iframe forbids all of it.** The `fuiDemo` iframe is **cross-origin** (`FUI_DEMO_BASE` :3001
  vs WE's docs origin). Under the **same-origin policy** the host **cannot** read the iframe's DOM, computed
  styles, or ARIA tree — the browser blocks it. The *only* path is a **cooperating guest** that marshals each
  datum back over postMessage, and even then computed-style cascades, the full ARIA tree, and a token-provenance
  trace are awkward-to-impractical to reconstruct across the wire. (Playwright's own `captureSnapshot` can't
  cross-origin-iframe for the same reason.)

## What this means for #809's forks

### Fork 1 — manipulation channel

| Subset | Iframe + message protocol (B) | In-document / mode C, host-side (A) |
|---|---|---|
| Theme swap (#749) | Works (Storybook proves it) — but needs a `set-theme` message + guest applier | **Set custom properties on the host — zero protocol** |
| Trait toggle (#750) | Works — `set-trait` message + guest applier | Set attributes on the host — zero protocol |
| Inspect / "why this token" / ARIA / degrade (#755/#806) | **Blocked cross-origin**; every datum must be marshaled by a cooperating guest, and computed-style/ARIA/token-trace barely survive the wire | `getComputedStyle` + `shadowRoot` walk **directly** |

The escape need is already solved (modes A/B1/B2, #732/#807) — this is **not** about overlay escape. It is about
*manipulation + inspection fidelity*. Mode C (in-document, **already built** in #786 on the #807 SDK, sanctioned
by #765 for the trusted WE↔FUI pair) gives all four subsets host-side with no new protocol; the iframe-protocol
branch handles theme/trait push but is **broken for the inspection subset** the cross-origin wall forbids. Net:
**A (mode C) is the recommended channel**, with B coherent only for the push-only subset — and `api-viewer` is
the shipping proof that A's full workbench is real, not speculative.

### Fork 2 — control-UI locus

Both api-viewer (controls+render in one element) and Storybook (manager chrome vs preview render) separate the
**tool's own control chrome** from the **documented component**. Mapped onto the constellation: the **rendered
block** is FUI's impl (the mode-C SDK does the rendering — **impl→FUI untouched**, exactly #765's sharpened
crux), while the **control/devtools chrome** that drives and introspects it is **documentation tooling**. The
#755 inspectors in particular introspect **WE standards** — intent→ARIA mapping, design-token provenance, the
#092 provider↔consumer graph — which is squarely WE's (the *standard's*) domain, not FUI's (the *impl's*). WE
consuming FUI blocks as a no-leakage client is the constellation's normal consumer relationship. So the workbench
**tooling** is WE-owned docs chrome (slices stay WE-locus); #746's "lives in FUI" is reconciled as *the block
**rendering** lives in FUI*, and the chrome's UI **primitives** may later render from FUI components under the
separate, blocked dogfooding epic #777 — a rendering-primitive concern, not an ownership/locus one.

## Sources

- Storybook channel / manager↔preview iframe: [storybookjs/storybook channel-postmessage](https://github.com/storybookjs/storybook/blob/1ecf313c5cf518660c6ccf54ef5a5b45ac620bed/lib/channel-postmessage/src/index.ts), [@storybook/channel-postmessage (npm)](https://www.npmjs.com/package/@storybook/channel-postmessage), [Storybook addons docs](https://storybook.js.org/docs/addons), [Storybook iframe tango](https://blog.damato.design/posts/storybook-iframe-tango/)
- api-viewer in-document live playground: [open-wc/api-viewer-element](https://github.com/open-wc/api-viewer-element), [Using the demo](https://api-viewer.open-wc.org/docs/guide/using-demo/), [Elements API](https://api-viewer.open-wc.org/docs/api/elements/)
- Platform mechanics: [MDN getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), [MDN Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [Open WC — styles piercing shadow DOM](https://open-wc.org/guides/knowledge/styling/styles-piercing-shadow-dom/), [CSS-Tricks — styling a web component](https://css-tricks.com/styling-a-web-component/)
