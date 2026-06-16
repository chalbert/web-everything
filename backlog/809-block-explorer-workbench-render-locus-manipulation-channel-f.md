---
type: decision
workItem: story
size: 3
status: resolved
parent: "746"
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-block-explorer-manipulation-channel.md
tags: [webdocs, block-explorer, boundary, locus, embed-sdk, render-mode, decision]
---

# Block-Explorer workbench: render-locus + manipulation-channel for live theme/trait/inspect (#746 cluster)

> **Ratified 2026-06-16 — chrome decoupled from distribution; Fork 1 dissolved, Fork 2 → B (FUI-owned).**
> The framing of *both* original forks was superseded in discussion. The deciding requirement: the
> workbench chrome (switcher / trait panel / inspect panels) must be **embeddable on third-party sites
> with the component**, not locked to WE's docs. The resolution separates **chrome** from
> **distribution**:
>
> - **iframe + chrome** — a **FUI-owned, FUI-hosted workbench**: chrome + block served same-origin
>   *inside* one iframe, embeddable on any site (WE included). All live theme/trait/inspect happens
>   here, intra-FUI, host-side DOM — **no WE↔FUI channel**.
> - **in-document, no chrome** — mode C (#765/#786) is the **bare-component** distribution: the real
>   FUI component mounted inline in the host DOM, *no* workbench chrome.
>
> **Fork 1 (manipulation channel) → DISSOLVED** (not "A"). There is no cross-boundary manipulation
> channel to choose: manipulation lives only where the chrome lives (inside the FUI iframe, same-origin
> with the block). Mode C is re-cast as the *no-chrome* distribution, not the channel — so neither the
> old 1-A (mode C as channel) nor 1-B (iframe message protocol) is the answer; the question was
> mis-posed once chrome is FUI-hosted.
>
> **Fork 2 (locus) → B (FUI-owned workbench).** The chrome is a FUI product that ships with the iframe
> distribution; the four slices (#749/#750/#755/#806) re-home to **FUI-locus**.
>
> **Residual that stays WE:** #755's WE-**standards** introspection — intent→ARIA mapping, token
> provenance (#747/#364), the #092 provider↔consumer graph — is WE data and cannot ride to third-party
> sites. It stays a **WE-docs overlay** rendered *around* the embedded FUI workbench, from WE's data.
> Third-party embedders get the full component workbench minus WE's standards panels (WE-docs-specific
> anyway). `impl→FUI` is honoured throughout: FUI owns the rendering *and* the workbench that drives it;
> WE renders no FUI block code.

**Grounding (✓ ready to ratify):** the four #746 children that *manipulate the rendered FUI block*
(#749 live theme switch · #750 live trait toggle · #755 inspection devtools · #806 exploded view) all
reach **into** a running block — set its theme, flip its attributes, read its computed styles / ARIA
tree / shadow DOM — a reach the cross-origin `fuiDemo` iframe (#727) forbids. No design existed yet for
the *channel*; surveyed the live-workbench prior art (Storybook's manager↔preview iframe + postMessage
channel; open-wc's in-document `api-viewer`; the platform's custom-property/`getComputedStyle`/same-origin
mechanics) and published [`/research/block-explorer-manipulation-channel/`](/research/block-explorer-manipulation-channel/)
(report [`2026-06-16-block-explorer-manipulation-channel.md`](../reports/2026-06-16-block-explorer-manipulation-channel.md)).
**Two genuine forks** below, each with a **bold** recommended default. This is a wiring + ownership call
over **already-built** substrate (mode C shipped in #786 on the #807 embed SDK, sanctioned by #765) — it
mints no new WE entity.

## The axis

Two orthogonal axes the decider rules on, pinned to the real tree:

- **Channel (Fork 1)** — how the control surfaces drive *and inspect* the block. The escape need is
  already solved (modes A/B1/B2, #732/#807); this is the *manipulation + inspection* channel.
  In-document **mode C** is built: `frontierui/embed/in-document.ts:63` (`mountInDocumentPoint` →
  `attachShadow` at `:76`/`:82`, demo opts in via `mountInDocument`, origin trust-gate `setTrustedOrigins`
  at `:40`); the `EmbedMountModule` contract lives in `frontierui/embed/contract.ts`; WE's `fuiDemo`
  shortcode already emits a mode-C **mount-point `<div>`** (`.eleventy.js:65-72`,
  `data-embed-mode="in-document"` + `data-embed-src`) vs the default sandboxed **iframe**
  (`.eleventy.js:81`, `sandbox="allow-scripts allow-same-origin"`, cross-origin to `FUI_DEMO_BASE`). The
  iframe-message alternative would instead grow the embed SDK's guest↔host postMessage contract
  (`frontierui/embed/embed-guest.ts` / `embed-host.ts`) into a full bidirectional manipulation protocol.
- **Locus (Fork 2)** — who *owns* the control chrome (switcher, trait panel, inspect panels). #746 says
  the workbench "lives in FUI"; the four slices are filed **WE-locus**. The boundary rule is `impl→FUI`
  (`docs/agent/demo-workflow.md:31`), sharpened by #765 to an *ownership* rule (FUI owns the impl **and**
  its rendering) — *not* an iframe-mechanism mandate. This sets where #749/#750/#755/#806 live and whether
  they need re-homing.

### Per-fork classification (the 7-question pass)

Run once for the cluster (the two forks share the workbench object): **(1) layer** — the *rendered block*
is FUI impl (mode-C SDK does the rendering, `impl→FUI` untouched per #765); the *control/devtools chrome*
that drives and introspects it is **WE documentation tooling** (WE consumes FUI as a no-leakage client).
**(2) protocol or intent dimension?** — Fork 1-A mints **no protocol** (host-side DOM: set custom
properties, set attributes, `querySelector`/`getComputedStyle`); Fork 1-B *would* grow the existing embed
postMessage contract into a bidirectional manipulation protocol — a cost, not a goal. Neither is an intent.
**(3) expose the whole axis?** — n/a; this picks one channel + one owner, not an author-facing dimension.
**(4) fixed mechanic or dimension?** — a fixed mechanic: the workbench standardizes on **one** channel the
four slices target (not a per-demo knob — though mode C remains a per-demo *opt-in render mode* under
#765's iframe-default rule). **(5) DI-injectable?** — no; the channel is the host driving its own mounted
component. **(6) most-permissive default?** — n/a (not a config axis). **(7) seam between concerns?** —
honour separation: the *block render* (FUI) and the *workbench tooling* (WE) are distinct homes; the #755
inspectors introspect **WE standards** (intent→ARIA, token provenance, the #092 provider↔consumer graph),
squarely the standard's domain.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| **1 — manipulation channel** | **In-document (mode C)** — host-side custom-property/attribute/shadow-query drive + inspect, zero new protocol | Grow the iframe embed SDK into a bidirectional manipulation protocol | **med-high** — mode C covers all four subsets; the iframe branch is *broken for inspection* across the cross-origin wall |
| **2 — control-UI locus** | **WE docs chrome** drives the FUI-rendered block; slices stay WE-locus (no re-homing) | FUI-owned workbench component WE embeds | **med** — softens #746's "lives in FUI" wording; reconciled as *rendering* = FUI, *tooling* = WE |

## Fork 1 — manipulation channel: in-document (mode C) vs iframe message protocol

**Crux:** all four slices reach *into* the running block. CSS **custom properties pierce the shadow
boundary by design** and `getComputedStyle()` returns resolved values — so host-side, theming (#749) is
"set `--token` on the mount" and inspection (#755 "why this token") is "read the resolved value," both
**zero protocol**. But the `fuiDemo` iframe is **cross-origin** (`.eleventy.js:81`, `FUI_DEMO_BASE` :3001);
under the **same-origin policy** the host cannot read its DOM/computed-styles/ARIA at all — only a
cooperating guest can marshal each datum over postMessage, and a computed-style cascade / full ARIA tree /
token-provenance trace barely survive the wire. Storybook proves an iframe channel works for *pushing
args in* (theme/trait) but is silent on inspection; open-wc's `api-viewer` is a *shipping* in-document
workbench (live knobs over props/attrs/slots + CSS-custom-property + shadow-part panels) — the reference
design for A.

- **A — standardize the workbench on mode C (in-document mount)** *(recommended)*. The block renders in
  WE's own DOM behind a shadow root (`frontierui/embed/in-document.ts:76`, built #786, ratified #765,
  WE↔FUI-only). WE sets theme via CSS custom properties on the shadow host, toggles traits via attributes,
  and inspects via shadow-DOM queries + `getComputedStyle` — all host-side, **zero new protocol**. *Merit:*
  maximal fidelity, simplest channel, reuses the just-built mode C, and is the *only* branch that satisfies
  the inspection subset (#755/#806) the cross-origin wall otherwise forbids. *Cost:* every manipulable demo
  must be mode-C capable (export `mountInDocument`, `frontierui/embed/in-document.ts:20`), and it leans on
  the trust-gated #765 exception rather than the default iframe.
- **B — keep the iframe and grow an explicit manipulation protocol.** Extend the embed SDK contract
  (`frontierui/embed/contract.ts`, `embed-guest.ts`/`embed-host.ts`) with `set-theme` / `set-trait` /
  `inspect` host→guest messages over the origin-validated channel #807 built. *Merit:* keeps the default
  isolation boundary; works for any embedder. *Cost:* a much larger bidirectional protocol, and — the
  decisive flaw — inspection (computed styles / ARIA / token trace) is **awkward-to-impractical** to
  marshal across the frame, so it cannot cleanly serve #755/#806. Storybook's Controls are one-way arg
  push for exactly this reason.

**Recommended default: A — mode C.** It is the higher-fidelity channel #765 already sanctioned for this
trusted pair, needs no new protocol, and is the only branch that covers all four subsets (B is *broken for
inspection* across the cross-origin wall — a flaw, not just extra work). Confidence **med-high, not high**,
because B is a legitimate end-state for the *theme/trait-push* subset alone, and A does require every
manipulable demo to be mode-C capable. *Red-team note for the deciding agent:* the skeptic will argue B
preserves the default isolation boundary and avoids the per-demo `mountInDocument` requirement — answer
with #755/#806's inspection need, which the same-origin policy makes structurally unreachable over a
cross-origin iframe (`api-viewer` host-side vs Storybook's inspection-silent channel).

### Concrete: the same two user actions written each way

Two representative slices — **#749 "set the theme"** and **#755 "why is this token this value?"** —
make the structural difference visible.

**A (mode C).** The block is mounted in WE's own DOM behind a shadow root
(`frontierui/embed/in-document.ts:82`), so WE's docs JS holds a real element reference:

```js
// WE docs chrome, host-side. `host` is the shadow-root mount.
// #749 set theme — custom properties pierce the shadow boundary by design:
host.style.setProperty('--color-primary', preset.primary);
// #755 "why this token" — read the *resolved* value straight off the rendered node:
const btn = host.querySelector('fui-button');
const resolved = getComputedStyle(btn).getPropertyValue('--color-primary'); // "#0b5fff"
const ariaRole = btn.shadowRoot.querySelector('[role]'); // full ARIA introspection, live
```

Zero protocol — read/write the live DOM directly.

**B (iframe + message protocol).** The block is cross-origin; the same-origin policy means WE
**cannot touch** `iframe.contentDocument`. Every datum must be marshalled by a cooperating guest:

```js
// #749 push works (one-way, like Storybook Controls):
frame.contentWindow.postMessage({ v:1, type:'set-theme', tokens:{...} }, FUI_ORIGIN);
// #755 must round-trip, and the guest must pre-decide what to serialize:
frame.contentWindow.postMessage({ v:1, type:'inspect', selector:'fui-button' }, FUI_ORIGIN);
window.addEventListener('message', e => {
  if (e.origin !== FUI_ORIGIN) return;
  // a live getComputedStyle handle / DOM node CANNOT cross the wire — only a snapshot the
  // guest chose to copy. "now show the sibling's resolved padding" = another round-trip.
});
// + a whole second program inside the FUI demo (embed-guest.ts) to answer each message type.
```

The crux in code: in A inspection is *"read the node"*; in B it is *"design a serialization
protocol for every introspectable fact, and accept only snapshots the guest pre-decided to send."*
That's why B serves #749/#750 (push args in) but structurally cannot serve #755/#806.

## Fork 2 — manipulation-UI locus: WE docs chrome vs FUI-owned workbench component

**Crux:** #746 states the workbench "lives in FUI"; the slices are filed WE-locus. The constellation rule
is `impl→FUI` (`docs/agent/demo-workflow.md:31`) — but #765 sharpened it to an **ownership** rule (FUI owns
the *impl and its rendering*), *not* a mandate that every adjacent surface be FUI-owned. Both Storybook
(manager chrome vs preview render) and `api-viewer` separate the tool's **control chrome** from the
**documented component** — the chrome is the *tool's* product, distinct from the artifact it documents.

- **A — WE docs chrome drives the FUI-rendered block** *(recommended)*. The switcher/trait-panel/inspect
  panels are **WE documentation tooling**; they drive the FUI block (rendered by the mode-C SDK — `impl→FUI`
  untouched) via the Fork-1 channel. The slices stay **WE-locus**; no re-homing. *Merit:* the #755
  inspectors introspect **WE standards** (intent→ARIA mapping, design-token provenance, the #092
  provider↔consumer graph) — squarely the standard's domain, not the impl's; WE consuming FUI blocks is the
  constellation's normal consumer relationship; and with Fork 1-A the block already mounts in WE's DOM
  driven host-side, so the driver *is* WE host code. *Cost:* it softens #746's "lives in FUI" wording (see
  reconciliation below).
- **B — a FUI-owned workbench component WE embeds.** The control surfaces are a FUI component (reusable
  product-grade workbench, Storybook-like) that WE embeds. *Merit:* literal consistency with #746's wording
  and product-reuse beyond WE docs. *Cost:* it pushes WE-standards-introspection tooling (#755's intent→ARIA
  / token-trace / #092 graph) into the impl repo, inverting the standard↔impl layering; and a FUI-owned
  control chrome embedded into a mode-C WE-DOM mount is awkward double-embedding.

**Recommended default: A — WE docs chrome; slices stay WE-locus.** #746's "lives in FUI" is **reconciled,
not overridden**: the block *rendering* lives in FUI (mode-C SDK, `impl→FUI` intact), and the chrome's UI
**primitives** may later render *from* FUI components under the separate, blocked dogfooding epic #777 — a
rendering-primitive concern, not an ownership/locus one. So no slice re-homes. Confidence **med** — a
reasonable architect could keep the whole workbench FUI-owned for product reuse; the call rests on the
inspectors being WE-standards introspection and on #765's ownership-not-mechanism sharpening. *Red-team
note:* the skeptic cites #746's plain wording + workbench reuse value; answer with the layer test (who owns
intent→ARIA / token-provenance / the #092 graph?) and the #777 reconciliation that preserves dogfooding
without moving ownership.

### Concrete: where #749's theme switcher physically lives

**A (WE docs chrome).** The control lives in WE; it drives the mode-C-mounted FUI block via the
Fork-1A host-side code above:

```
webeverything/                              frontierui/
  src/…/block-explorer/                        embed/in-document.ts   ← renders block (impl→FUI)
    theme-switcher.ts   ← WE owns the UI       blocks/button/demo.ts  ← exports mountInDocument
    inspect-panel.ts    ← WE owns the UI         (only FUI-side add: per-demo opt-in)
  (reads WE-standard data already here: intent→ARIA, token provenance, the #092 graph)
```

**B (FUI-owned workbench component).** The whole control surface is an FUI component WE embeds:

```
frontierui/                                 webeverything/
  workbench/theme-switcher.ts ← FUI owns       embeds <fui-workbench>
  workbench/inspect-panel.ts  ← FUI owns
    ↑ but this panel must read intent→ARIA / token-provenance / the #092 graph — WE-STANDARD
      data — so FUI now reaches into standard internals (inverts the layer). Plus: under
      Fork 1-A the block is already in WE's DOM, so wrapping it in a FUI-owned control
      component re-embedded into that same WE mount is awkward double-embedding.
```

The tell: follow where `intent→ARIA` / `token-provenance` / the `#092 graph` data lives — it is
WE-standard data, so the panel that displays it wants to sit next to it (WE). Homing it in FUI means
the impl repo reaches into standard internals.

---

## Context

### Forced invariants if ratified (ratify, don't weigh)

- **Mode C stays a per-demo opt-in; iframe stays the default** (#765). Fork 1-A standardizes the
  *workbench's* channel on mode C — it does **not** make mode C the default for non-manipulable demos;
  those stay sandboxed iframes (`.eleventy.js:81`). A demo becomes manipulable by opting into mode C and
  exporting `mountInDocument`.
- **Runtime SDK only — never the #700 source import** (#765/#700). Mode C is a render mode of the
  FUI-published embed SDK; no `frontierui` alias, no cross-repo source import. The manipulation is host-side
  DOM against the SDK-mounted shadow host, not an imported component.
- **WE↔FUI only — third parties iframe forever** (#765). The in-document channel is scoped to the trusted
  pair; a third-party embedder uses the iframe (+ message protocol if it ever needs manipulation).
- **`impl→FUI` is untouched.** Both forks keep block *rendering* in FUI. Fork 2-A places only the
  *documentation/devtools chrome* in WE — WE mints no block impl.

### Settled upstream (not part of this call)

- **Escape is already solved.** Modes A/B1/B2 (#732/#807) cover overlay escape; this decision is about
  *manipulation + inspection*, a different need.
- **Mode C exists.** #786 built it on #807's SDK; this is a wiring/ownership call, not a build decision —
  it mints no new entity.
- **The #092 provider↔consumer graph is one model surfaced twice.** #755's wiring graph shares data with
  the #748 anatomy view and #092 — not duplicated (already noted in #755).

### On ratification → downstream (as ruled — chrome/distribution split, Fork 2 → B)

> **Note (2026-06-16):** the forks below were superseded by the ratified ruling in the banner at the top.
> The A/B option text and the "Recommended path at a glance" table are retained as the *reasoning trail*
> that led there — the binding outcome is: chrome is a **FUI-owned, FUI-hosted workbench** delivered via
> the **iframe + chrome** distribution; **mode C is the no-chrome bare-component distribution**; there is
> **no WE↔FUI manipulation channel** (Fork 1 dissolved).

This decision unblocks the four `blockedBy: 809` slices. As ruled:

- **#749 (live theme) / #750 (live trait) / #806 (exploded view)** build as part of the **FUI-owned
  workbench** (FUI-locus): chrome + block same-origin inside the iframe distribution, manipulation
  host-side intra-FUI. Re-home from WE-locus to **FUI**.
- **#755 (inspection devtools)** splits at the layer seam: the *rendered-component* inspection (ARIA as
  rendered, computed styles, source, event log) lives in the **FUI workbench**; the *WE-standards*
  panels (intent→ARIA mapping, token provenance #747/#364, the #092 provider↔consumer graph) stay a
  **WE-docs overlay** rendered around the embedded workbench from WE's own data (a small focus/selection
  sync from workbench→overlay is a #755 build detail, not a new manipulation protocol).
- **Distribution:** `docs/agent/demo-workflow.md` records the two FUI distributions — *iframe + chrome*
  (the workbench, embeddable anywhere) and *in-document mode C, no chrome* (#765/#786, the bare component
  inline). A WE block "do" page embeds the iframe-workbench and wraps it with the WE-standards overlay.
- **Filing:** the FUI-owned workbench is an **FUI build**; file/track it FUI-side before the re-homed
  slices proceed. `impl→FUI` and npm-scope-mirrors-layer hold (workbench = `@frontierui`; WE overlay =
  `@webeverything`).

Surfaced 2026-06-16 (batch-2026-06-16) when the cluster pre-flighted as "batchable" (all `blockedBy`
resolved) yet was un-buildable across the boundary. The four items now `blockedBy` this decision so the
loader stops mis-reporting them as agent-ready. **Prepared 2026-06-16** — prior-art survey +
classification done, `/research/block-explorer-manipulation-channel/` published; both forks at DoR with
bold defaults (`✓ ready to ratify`). Making the call is `/next decision`'s job.
