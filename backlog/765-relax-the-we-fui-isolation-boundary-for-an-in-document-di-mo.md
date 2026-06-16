---
type: decision
workItem: story
size: 3
parent: "728"
status: resolved
blockedBy: ["732"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
relatedReport: reports/2026-06-16-we-fui-in-document-mount.md
tags: [embedding, isolation-boundary, shadow-dom, in-document-mount, constellation, trust, decision-prep]
---

# Relax the WE-FUI isolation boundary for an in-document (DI mount) FUI embed in WE docs

> **Ratified 2026-06-16 — A (relax, narrowly gated).** Mode C is sanctioned as a future trust-gated,
> WE↔FUI-only, runtime-SDK, Shadow-DOM-isolated, opt-in render mode of the FUI embed SDK, bounded by the
> forced invariants below. **Sharpened crux:** the call does **not** puncture the *ownership* boundary —
> FUI's own SDK still does the rendering (impl→FUI is untouched); what relaxes is the *iframe-mechanism*
> requirement only (WE may host the FUI-rendered component in-document behind a shadow root instead of
> behind an iframe). Reframed that way the change is narrower than the original "changes a stated
> absolute" hedge implied. Residual risks (custom-property/inheritable CSS bleed through the shadow
> boundary, duplicate runtime, one-shot `customElements.define` collisions) are accepted as bounded by
> opt-in + iframe-default + single SDK load — they cost fidelity-surface hygiene, not correctness.
> **Spin-off:** the mode-C build is filed as a separately-prioritized child under #728, gated `blockedBy`
> this item; `docs/agent/demo-workflow.md` and the constellation boundary memory record the exception.

**Prepared — ready to ratify.** No new design exists yet; this is a **boundary-policy** call, grounded in
a prior-art survey published as [`/research/we-fui-in-document-mount/`](/research/we-fui-in-document-mount/)
(report [`2026-06-16-we-fui-in-document-mount.md`](../reports/2026-06-16-we-fui-in-document-mount.md)). The
constellation states an **absolute** docs-rendering boundary — *"WE never imports or renders FUI block code
in its own document"* (`docs/agent/demo-workflow.md:31`); WE surfaces a FUI block only by embedding its
FUI-hosted demo through the sandboxed `fuiDemo` iframe (`.eleventy.js:38`). [#732](/backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r/)
ruled overlay escape is solved *host-side over the iframe* (modes A / B1 / B2 of a FUI-owned embed SDK) and
recorded a fourth mode — **C, an in-document / DI mount** — as *"no longer never: a future trust-gated
option for the WE↔FUI pair only,"* deferred here. This item carries **one genuine fork** with a **bold**
recommended default, plus a guard-invariant list; it is *not* an escape need (A/B1/B2 cover that) — a
**fidelity-only** option costing isolation.

The concern decomposes into one orthogonal axis the decider actually rules on — **the boundary policy** —
with everything else forced or settled upstream. Pinned to the real tree: the boundary statement lives at
`docs/agent/demo-workflow.md:31` (*"per the docs-rendering boundary, WE never imports or renders FUI…"*);
the only embed seam today is the `fuiDemo` shortcode (`.eleventy.js:38`) — a sandboxed iframe
(`sandbox="allow-scripts allow-same-origin"`, fixed `style="height:${h}px"`, `.eleventy.js:48`) whose
`.fui-demo` wrapper clips with `overflow:hidden` (`src/css/style.css:1657`); there is **no `frontierui`
alias** in WE's build (the #700-ruled-out source import). The trigger block is the Dialog family
(`src/_data/blocks.json:3286`), whose native top-layer overlays are what an in-document mount would let
escape natively — the fidelity gain. Mode C rides a **runtime, FUI-published SDK bundle** (a render mode of
the same embed SDK #732 settled), never that build-time source import.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| **1 — boundary policy** | **Relax, narrowly gated** — sanction mode C as a future trust-gated, WE↔FUI-only, runtime-SDK, Shadow-DOM-isolated, opt-in render mode | Keep the iframe wall **absolute** (never C; A/B1/B2 cover escape) | **med-high** — punctures a *stated absolute* invariant for a *fidelity-only* gain |

## Fork 1 — relax the isolation boundary, or keep the iframe wall absolute

**Crux:** the constellation's boundary is stated as an **absolute** (`docs/agent/demo-workflow.md:31`). #732
already realized the embed SDK that escapes overlays *over* the iframe (A/B1/B2) — so escape is solved. Mode
C drops the iframe and mounts the FUI component **directly in WE's host DOM** (Shadow-DOM / DI): overlays
then escape *natively* (a `<dialog>`/popover inside a shadow root promotes to the **host document's top
layer**, painting page-wide — iframe-impossible; Open UI Popover explainer, MDN Popover API), with **zero
coordination** — no postMessage/promote/backdrop protocol. The fork is whether to admit that mode at all,
since both "absolute boundary" and "boundary-with-the-C-exception" are coherent end-states but **cannot both
be the stated policy** (the fork-existence test's genuine either/or — not "support both").

- **A — Relax, narrowly gated** *(recommended)*. Sanction C as a **future** render mode, scoped by the
  guard invariants below. *Merit:* native, page-covering overlays with zero coordination; the real
  component in the real page (max fidelity for WE's own dogfooding surface); eliminates the
  postMessage/resize protocol for WE's own docs; aligns with the platform's own framing — iframe isolation
  exists *for cross-org untrusted content*, and same-author first-party code is conventionally mounted
  in-document (every micro-frontend / embed-SDK model presumes same-org trust). WE↔FUI is one constellation,
  same author, **complete trust** — so the exception is principled, not a hole.
- **B — Keep the iframe wall absolute.** Never C, even for WE. *Merit:* a single, clean, easy-to-reason
  isolation invariant ("never" needs no caveats); full isolation (a demo JS error / CSS bleed can't reach
  WE's docs); and escape is *already* covered by A/B1/B2, so C buys only fidelity — a luxury not worth
  puncturing an absolute invariant for. *Residual risks it weighs:* inheritable-CSS / custom-property bleed
  (pierces the shadow boundary by design), shared globals + duplicate runtime, one-shot
  `customElements.define` tag collisions, a first-party supply-chain surface CSP can't sandbox.

**Recommended default: A — relax, narrowly gated.** The platform framing and the complete
intra-constellation trust make the in-document mount the *correct, higher-fidelity* end-state for WE's own
surface, and the guard invariants below keep the relaxation precise rather than blowing the boundary open.
Confidence is **med-high, not high**, because it does change a *stated absolute* invariant for a
*fidelity-only* gain — a reasonable architect could prefer to keep "never" clean and pay the coordination
cost in A/B1/B2 instead. That is the single judgment this decision needs.

*Rejected — light-DOM mount (the isolation-technique sub-branch).* If C is admitted, the mount **must** be
Shadow-DOM-encapsulated, not light-DOM. Shadow DOM dominates on merit: it still gives the native top-layer
overlay escape (the whole point of C) *and* scopes style/DOM, where light-DOM sacrifices all isolation for
no fidelity gain the shadow boundary doesn't already allow (inheritable props/custom properties pierce in by
design). So this is a forced invariant, not a weigh.

---

## Context

### Forced invariants if relaxed (ratify, don't weigh)

These are the guard conditions that make branch A coherent — they are *conditions of the relaxation*, not
separate calls:

- **Runtime SDK only — never the #700 source import.** C is delivered as a **render mode of the FUI-owned
  embed SDK** (a runtime, versioned, FUI-published bundle behind a stable embed contract), exactly as #732
  settled for A/B1/B2. It never reopens the build-time WE→FUI *source* import [#700](/backlog/700-component-converter-playground-placement/)
  ruled out — no `frontierui` alias, no module import, no fixture drift.
- **WE↔FUI only — third parties iframe forever.** The relaxation is scoped to the trusted pair. A
  third-party site embedding a FUI component **must not** run FUI in-process; for it the iframe is the right
  answer permanently. Generalize to any "trusted pair" only when a *second* trusted pair appears (the same
  second-consumer trigger #728 sets for protocol registration) — not pre-emptively.
- **Shadow-DOM-encapsulated mount.** The component mounts inside a shadow root (style/DOM scoping); native
  top-layer escape survives the shadow boundary (Open UI). Light-DOM is rejected (above).
- **Opt-in; iframe stays the default.** C is a per-demo opt-in render mode on the `fuiDemo` axis; iframe (A)
  remains the **default** even for WE docs (isolation-by-default is the safe baseline, per #732's A-contained
  default). A demo opts into C only where fidelity warrants it.
- **Impl stays FUI-owned (impl→FUI).** #765 is an architecture/governance ruling — it spawns **no** WE
  entity. The in-document mount is FUI's SDK implementation; WE only loads the SDK and opts a demo in.

### Settled upstream (not part of this call)

- **C is not needed for escape.** A/B1/B2 (#732) already cover overlay escape host-side; C buys *fidelity
  only* (real component in real page, zero coordination). This decision is the fidelity-vs-isolation call,
  nothing more.
- **The render-mode axis already exists.** #732 framed the escape strategy as a dimension of one FUI embed
  SDK ({A, B1, B2}); C is an additional value of that same render-mode axis, not a rival mechanism.
- **Origin trust posture.** Loading FUI's embed SDK (host-privileged code) is an accepted
  intra-constellation dependency, not a supply-chain risk — the same trust #732 ratified is exactly what
  makes C reachable for WE.

### On ratification → spin-off

This is a *boundary-policy* ruling; it produces no code itself. If ratified **A**, the actual **mode-C build**
(FUI embed SDK gains a Shadow-DOM in-document render mode; `fuiDemo` gains the opt-in) is a
**separately-prioritized** child build under [#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/),
filed at ratification time and gated `blockedBy` this decision — its *priority*, not its existence, is the
open knob (build timing is prioritization, never a fork branch). The constellation boundary memory and
`docs/agent/demo-workflow.md:31` are updated to record the WE↔FUI exception. If ratified **B**, #732's "no
longer never" softens back to "never," and the boundary note is hardened to say so.
