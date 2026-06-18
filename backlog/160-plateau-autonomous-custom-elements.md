---
type: issue
workItem: story
size: 8
parent: "131"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: none
tags: [plateau, custom-elements, runtime, autonomous, injectors, autocomplete]
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Plateau runtime can't host autonomous custom elements (stand-in never delegates)

Surfaced while registering the real `<auto-complete>` element (#138). Plateau replaces
`window.customElements` with an injector-based `CustomElementRegistry`
(`plateau:plateau/src/plugs/custom-elements/CustomElementRegistry.ts`). On `define(name, Class)` it
stores the class's callbacks in a definition **and** registers a native *stand-in*
(`we:getStandInElement.ts`) under that tag. The stand-in only re-hydrates the real class when the
element carries an `is=` attribute (the customized-built-in path, e.g. `<template is="for-each">`).
For an **autonomous** custom element (`class extends HTMLElement` + `customElements.define('auto-complete', …)`,
exactly what the [autocomplete block](/blocks/autocomplete/) spec authors), there is no `is`, so the
stand-in's lifecycle wrappers resolve back to themselves and the real class's `connectedCallback`
**never fires**. Verified in a real browser: a plain `class extends HTMLElement` probe defined under
plateau's bootstrap does not connect; `<auto-complete>` stays an empty shell.

Consequence for #138: `<auto-complete>` is correct, portable, standards-only custom-element code and
runs perfectly in a native registry — its conformance demo (`we:auto-complete-demo.html`, frontierui dev server)
boots **natively** (no plateau bootstrap) and the full "par → arrow → enter" trace + diacritic match
pass. But it cannot yet run inside plateau's full runtime. The demo documents this and stubs the one
runtime hook the composed behaviors need (`node.injectors()`).

Build autonomous-element support into plateau's element model so a `customElements.define('x-foo', Foo)`
autonomous element upgrades and receives `connectedCallback`/`disconnectedCallback`/`attributeChangedCallback`/
form-association callbacks through the stand-in (mirroring the `is=` path, but keyed on the tag rather
than `is`). Then `<auto-complete>` can be registered in `we:bootstrap.tsx` and the demo can boot the real
runtime instead of native + shim.

Already landed as groundwork (same investigation): a guard in `we:Document.patch.ts` so
`document.createElement('<autonomous-tag>')` no longer throws `Object prototype may only be an Object
or null` — native `createElement` already gives the upgraded element its correct prototype, so the
patch now only re-pins the prototype when a matching `window[ctor.name]` global exists.

Acceptance: an autonomous custom element defined under plateau's bootstrap upgrades and runs its
lifecycle callbacks; `<auto-complete>` is registered in `we:bootstrap.tsx` and its demo boots the real
plateau runtime with the full trace green.

## Findings (code-traced 2026-06-07) — this is net-new core plumbing, not a one-line patch

Plateau drives element lifecycle **manually** through its patched insertion methods
(`we:pathInsertionMethods.ts`, wired by `we:Node.patch.ts` / `we:Element.patch.ts` onto
`appendChild`/`insertBefore`/`replaceChild`/`replaceWith`/`prepend`/`after`/…). That code upgrades
*undetermined* nodes (`updateElement`/`upgradeDeep`) and then fires `connectedCallback` **only for
text nodes and comments** (`we:pathInsertionMethods.ts:194`). A grep of every `connectedCallback()`
invocation in the repo confirms: custom **elements** have no generic connect path — lifecycle is
delivered only by *specialized* registries (CustomComment, CustomAttribute, CustomTextNode,
CustomScriptType, CustomContext, CustomTemplateDirective). The familiar `for-each`/`render-if`/
`switch-case` are `CustomTemplateDirective`s (their own registry + connect path), **not** generic
autonomous elements — which is why they work and `<auto-complete>` does not.

Two entry points that must learn autonomous elements:
1. **Browser-parser / `createElement`** → the native stand-in (`we:getStandInElement.ts`). Its
   constructor only rehydrates the real class when an `is=` attribute is present. For autonomous
   elements it must rehydrate by **tag name** (`this.localName`) via
   `getValueInProviderByLocalNameOf(this, 'customElements', this.localName)`. `HTMLRegistry.get`
   already returns the constructor, so the lookup is ready.
2. **JSX / programmatic via patched insertion** → `updateElement`/`upgradeDeep` already construct the
   real class for *undetermined* elements; they just never call the resulting element's
   `connectedCallback`.

Scope to make autonomous elements first-class:
- After an element is upgraded/rehydrated and connected, invoke its `connectedCallback` (today only
  text/comments are called in `pathInsertionMethods`). Mirror for `disconnectedCallback` on removal,
  `attributeChangedCallback` (against the definition's `observedAttributes`), and the form-associated
  callbacks (`formAssociated`/`formReset`/`formStateRestore`) — `<auto-complete>` needs form ones.
- Extend the stand-in constructor for the no-`is` (tag-keyed) case.
- Guard ordering: parent connect must precede child connect (the existing text/comment push-back hints
  at the same concern).
- Regression budget: this touches the hot insertion path — keep the full plateau suite (188) green and
  re-verify the existing template-directive/comment/attribute paths.

A `we:Document.patch.ts` guard already landed (no-throw `createElement` for autonomous tags). When this is
done: register `<auto-complete>` in `we:bootstrap.tsx` and flip `we:auto-complete-demo.ts` from native+shim
to a real `import './main'` boot.

## Progress

- **Status:** resolved (user gave the go to implement on the platform core, behind the test suite).

**Done — the connect half of autonomous-element support, browser-verified:**
- `we:getStandInElement.ts` — the stand-in now rehydrates **autonomous** elements (no `is`) by tag name,
  not just customized built-ins. Guarded on `this.constructor !== Element` (NOT `instanceof`: the
  patched `HTMLElement` carries a static `[Symbol.hasInstance]` that reports true for any element).
- `we:Document.patch.ts` — `createElement('<autonomous-tag>')` now returns the **real** class instance
  (via `Reflect.construct`, which the patched `HTMLElement` maps to a stand-in body + real prototype),
  so callers hold the actual element with no stale reference after connection.
- `we:pathInsertionMethods.ts` — drives `connectedCallback` for autonomous elements on insertion (both the
  JSX/`updateElement` path and the determined-element/`createElement`+append path), via a new
  `isAutonomousElement` guard that excludes customized built-ins / template-directives (so their
  existing paths are untouched — no double-fire).
- `we:CustomElementRegistry.ts` — propagates `formAssociated` + `observedAttributes` to the natively
  registered stand-in so the real element's `ElementInternals`/`setFormValue` participate in forms.
- `we:bootstrap.tsx` — registers `<auto-complete>`; `we:auto-complete-demo.ts` now boots the **real** plateau
  runtime (`import './main'`, no native shim) and routes the #149 positioning-strategy swap through the
  real root injector.

**Verification:**
- Full plateau `vitest` **196/196 green** — no regressions from the hot-path changes.
- In-browser (Playwright, headless Chromium) against the real-runtime demo: a plain autonomous probe
  and `<auto-complete>` both upgrade + run `connectedCallback` (HTML-authored **and** `createElement`);
  the "par → arrow → enter" async trace commits "Parma" + dismisses, status announces "3 results
  available", client `par` shows accented "Pärnu" (Berlin hidden), **zero console errors**.
- A durable vitest guard isn't possible — happy-dom can't boot plateau's patch chain (`HTML_CONSTRUCTORS`
  entries absent); browser-only. Captured as [#168](/backlog/168-plateau-in-browser-test-harness/).

**Leftovers → new items:**
- [#167](/backlog/167-autonomous-element-lifecycle-completeness/) — the rest of the lifecycle
  (`disconnectedCallback` on removal, `attributeChangedCallback`, form reset/restore callbacks); only
  **connect** landed here.
- [#168](/backlog/168-plateau-in-browser-test-harness/) — a plateau Playwright/e2e harness so the
  autonomous lifecycle + autocomplete demo are guarded in CI, not by hand.

**Graduated to** `none` — autonomous custom-element lifecycle fix in the legacy plateau repo (now abandoned): we:getStandInElement.ts + we:Document.patch.ts + we:pathInsertionMethods.ts + we:CustomElementRegistry.ts; superseded in the live constellation by fui:frontierui/plugs/webregistries/CustomElementRegistry.ts + fui:frontierui/plugs/core/utils/pathInsertionMethods.ts.
