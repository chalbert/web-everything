# WE↔FUI in-document mount — relaxing the isolation boundary for the trusted pair

**Date**: 2026-06-16
**Point**: Whether WE should relax its absolute "never render FUI block code in its own document; always iframe" boundary to allow an in-document (Shadow-DOM / DI) mount of FUI components — *mode C* — for the fully-trusted WE↔FUI pair. The load-bearing finding is that the platform's own framing puts iframe isolation squarely on the *cross-organization untrusted* case, and a Shadow-DOM-mounted component can drive `<dialog>.showModal()` / Popover into the **host document's top layer natively** — the one fidelity an iframe structurally cannot deliver. So the boundary's "never" is a cross-org rule; the WE↔FUI exception is principled, not a hole.
**Research page**: `/research/we-fui-in-document-mount/`
**Prepares**: decision [#765](../backlog/765-relax-the-we-fui-isolation-boundary-for-an-in-document-di-mo.md)
---

## Question

`#765` (carved from the overlay-escape ruling [#732](../backlog/732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r.md), itself a child of the embed epic [#728](../backlog/728-component-embedding-capability-embed-a-live-component-exampl.md)): the constellation states an **absolute** docs-rendering boundary — *"WE never imports or renders FUI block code in its own document"* (`we:docs/agent/demo-workflow.md:31`); WE surfaces a FUI block only by embedding its FUI-hosted demo through the sandboxed `fuiDemo` iframe (`we:.eleventy.js:38`). #732 ruled that overlay escape is solved *host-side over the iframe* via a FUI-owned embed SDK (modes A / B1 / B2), and recorded a fourth mode — **C, an in-document / DI mount** that drops the iframe and mounts the FUI component directly in WE's host DOM — as *"no longer never: a future trust-gated option for the WE↔FUI pair only,"* explicitly deferred to its own boundary decision. #765 is that decision: **relax the boundary to sanction mode C, or keep the iframe wall absolute?**

## Recommendation

The survey holds the decision at **one genuine fork plus a guard-invariant list** — it does not fan into "support all":

- **Genuine fork — relax the boundary, or keep it absolute.** Recommended **relax, narrowly gated**: sanction mode C as a *future, trust-gated, WE↔FUI-only, runtime-SDK-delivered, Shadow-DOM-isolated, opt-in* render mode. Confidence **med-high** — the platform framing and the complete intra-constellation trust support it, but it does puncture a stated *absolute* invariant for a *fidelity-only* gain (A/B1/B2 already cover escape), so a reasonable architect could prefer to keep "never" clean. This is the one call that needs human judgment.
- **Forced invariants if relaxed (ratify, don't weigh).** runtime FUI-published SDK bundle only, *never* the #700-ruled-out build-time source import · WE↔FUI only (a third-party site iframes forever) · **Shadow-DOM-encapsulated** mount required (light-DOM is the worse-on-merit branch) · opt-in render mode, iframe (A) stays the *default* even for WE docs · impl stays FUI-owned (a render mode of the same embed SDK, impl→FUI).
- **Settled by #732 / #700** — C is *not* needed for escape (A/B1/B2 suffice; C buys fidelity only); C rides the runtime SDK, not source import; the render-mode axis already exists on the embed SDK.

## Key Findings

1. **Shadow DOM scopes style + DOM, but is not a JS/security sandbox.** Page CSS can't reach into the shadow tree and shadow styles don't leak out; `document.querySelector` can't see internals. But JS is *not* isolated — there is one shared global scope, and `closed` is "not a strong security mechanism" ([MDN — Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)). Inheritable CSS props and custom properties pierce *in* by design — the intended theming channel ([open-wc — Styles Piercing Shadow DOM](https://open-wc.org/guides/knowledge/styling/styles-piercing-shadow-dom/)). So encapsulation is structural, not a trust boundary — which is exactly why it fits a *trusted* pair.
2. **The decisive fidelity gain is native and iframe-impossible.** A `<dialog>` (or popover) *inside a shadow root* can `showModal()` / `showPopover()` and **promote to the host document's top layer**, painting above all page content — true even for a closed shadow root ([Open UI — Popover explainer](https://open-ui.org/components/popover.research.explainer/)). The top layer ignores DOM position, makes the rest of the page `inert`, and `::backdrop` covers the whole viewport ([MDN — Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)). An iframe structurally *cannot* do this (its top layer is its own document's). So C gets native, page-covering overlays with **zero coordination** — no postMessage/promote/backdrop protocol — where A/B1/B2 simulate it host-side.
3. **Every micro-frontend in-document model assumes first-party / same-org trust.** single-spa, Module Federation, and Web Components mount independently-built UI into one shared document and one shared global runtime; none sandboxes, and the docs frame teams "within reason as defined by the organization" ([single-spa — Recommended setup](https://single-spa.js.org/docs/recommended-setup/); [freeCodeCamp — iframes to Module Federation](https://www.freecodecamp.org/news/how-microfrontends-work-iframes-to-module-federation/)). The composition spectrum runs document-boundary (iframe, strong isolation) → lifecycle (single-spa) → runtime-module (Module Federation) — *decreasing isolation, increasing integration fidelity*.
4. **Embed vendors iframe the untrusted surface, script the trusted orchestration.** "An iframe is inherently more secure than a script… embedding a script is an act of faith — you are giving it full access" ([roboleary](https://www.roboleary.net/blog/code-embeds/)). Stripe/Checkout put *sensitive* card fields in iframes for origin isolation + reduced PCI scope, while a host-mounted script orchestrates ([Code Driven Dev](https://codedrivendevelopment.com/posts/payment-provider-embeds)). The explicit axis: "Shadow DOM gives you CSS isolation and DOM scoping without an iframe boundary, but not cross-origin isolation or a separate JS context… Isolation buys safety, tight integration buys UX" ([Appmixer](https://www.appmixer.com/blog/javascript-sdk-vs-iframe)).
5. **Iframe isolation is *for* cross-org untrusted content.** Iframes exist "to render untrusted content… while preventing harm outside the frame" ([arxiv — Content Inclusion security](https://arxiv.org/pdf/2001.03643/)); a first-party in-process script runs with the embedding origin's full privileges, which is why first-party functionality that can't work boxed-in is mounted in-document. This is the platform's own justification for the WE↔FUI exception: WE's "never" is a cross-org rule, and WE↔FUI is one constellation, same author, complete trust.
6. **Residual risks survive even a trusted in-document mount** (Shadow DOM mitigates some, not all): inheritable-CSS / custom-property bleed remains *by design*; shared globals + duplicate-runtime collisions are not a Shadow-DOM concern ([single-spa](https://single-spa.js.org/docs/recommended-setup/)); `customElements.define` is one-shot per tag name per document (two definitions throw); first-party in-process code is a supply-chain surface CSP can't sandbox ([w3c — CSP Embedded Enforcement](https://www.w3.org/TR/csp-embedded-enforcement/)). These are the cost the "keep absolute" branch weighs against the fidelity gain.

## Classification (per-fork pass)

| Q | Answer |
|---|---|
| Layer | #765 is an **architecture / governance** ruling (a constellation boundary policy), spawns no entity. The mount itself is **impl→FUI** — a render mode of the FUI embed SDK (settled #732). |
| Protocol or impl detail? | Neither — a trust/isolation policy. The render-mode axis {iframe A/B1/B2, in-document C} is a dimension of the FUI embed SDK, not a new protocol. |
| Fixed or dimension? | The render mode is a per-demo/per-surface **dimension** (#732). The genuine call is the *policy*: does the boundary admit C at all. |
| DI-injectable? | C *is* the DI/in-document mount; isolation technique (Shadow vs light DOM) is an SDK impl choice — Shadow DOM is forced (dominates on merit). |
| Most-permissive default? | For the boundary, "allow C (gated)" is more permissive; iframe-only is the conservative opt-in. But isolation is the standing invariant, so the relaxation is *narrow*: C opt-in, iframe-default. |
| Seam | The WE-docs-host ↔ FUI-component seam — the #700 constellation-layering boundary; relaxing it is a deliberate, narrowly-scoped change to that seam. |

## Fork-existence test

Both branches are coherent end-states — yet this is **not** "support both," because the constellation states a **policy/invariant**: either *"WE never renders FUI code in-document"* is absolute, or it carries *"…except the trust-gated C mode for WE↔FUI."* Those cannot both be the stated rule. So it is a genuine either/or (case b) — one real fork. The guard conditions (runtime-SDK-only, WE↔FUI-only, Shadow-DOM, opt-in) are forced invariants that make the "relax" branch coherent, not separate weighs; light-DOM is the broken branch of the isolation sub-question (forced to Shadow DOM).

## Files Created/Modified

| File | Action |
|------|--------|
| `we:src/_data/researchTopics.json` | Added `we-fui-in-document-mount` registry entry |
| `we:src/_includes/research-descriptions/we-fui-in-document-mount.njk` | New research write-up |
| `we:reports/2026-06-16-we-fui-in-document-mount.md` | This report |
| `backlog/765-…relax-the-we-fui-isolation-boundary….md` | Rewritten to prepared-fork shape; `preparedDate` stamped |
