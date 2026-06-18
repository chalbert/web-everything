# #932 — Does mode-C boot the WE webbehaviors trait registry in-document?

**Date:** 2026-06-18 · **Type:** decision prep (ratify-shipped-architecture; no greenfield design) ·
**Item:** `we:backlog/932-decide-whether-mode-c-boots-the-we-webbehaviors-trait-registr.md` ·
**Builds:** #934 (chrome-composes-traits epic) · **Parent:** #777 (site as conformance proof)

Prior art is already published — this links it rather than re-surveying:
- `we:reports/2026-06-14-reveal-navigation-disclosure-pattern.md` + `we:src/_includes/research-descriptions/reveal-navigation-menus.njk`
  (the W3C APG Disclosure Navigation pattern the traits implement).
- `we:reports/2026-06-17-881-mode-c-host-config-transport.md` + `we:src/_includes/research-descriptions/mode-c-host-config-transport.njk`
  (the mode-C host-config transport this builds on).

## What the tree actually shows (verified both repos, 2026-06-18)

**The traits exist and implement the pattern the chrome hand-rolls.**
- `fui:blocks/navigation/NavSectionBehavior.ts` — `nav:section`: toggles `aria-expanded`/`aria-controls`,
  wires click + **Enter/Space** (not Escape — see gap below), shows/hides via `ViewEngine`. The controlled
  element is resolved with **`document.querySelector(selector)`** (`fui:blocks/navigation/NavSectionBehavior.ts:47`).
- `fui:blocks/navigation/NavListBehavior.ts` — `nav:list`: roving tabindex (Arrow/Home/End), `orientation`
  horizontal/vertical, `aria-current` sync on route change. Item discovery is **`this.target.querySelectorAll`**
  (root-relative, `fui:blocks/navigation/NavListBehavior.ts:111`).
- Registered via `registerNavigation(attributes)` → `attributes.define('nav:list'|'nav:section', …)`
  (`fui:blocks/navigation/registerNavigation.ts:16-19`).

**The registry runs over shadow roots today.**
- `CustomAttributeRegistry.upgrade(root: RootNode)` / `downgrade(root: RootNode)`
  (`we:plugs/webbehaviors/CustomAttributeRegistry.ts:267,279`), `RootNode = Document | DocumentFragment | ShadowRoot`
  (`we:plugs/core/types.ts:11`). Its `MutationObserver` observes whatever root it is handed.
- Working precedent for `upgrade(shadowRoot)`: `applyScopedRegistryToHost` calls `registry.upgrade(host.shadowRoot)`
  (`we:plugs/webregistries/declarativeRegistry.ts:271`).

**The chrome hand-rolls instead.** `fui:blocks/disclosure-nav/DisclosureNav.ts` builds the nav DOM and calls
`wireDisclosure(nav)` — a block of imperative `addEventListener('click'|'keydown'|'focusin'|'resize')`
(`fui:blocks/disclosure-nav/DisclosureNav.ts` → `wireDisclosure`). Its own docstring states the reason: *"the keyboard/click path is wired
imperatively (the mode-C convention — there is no behavior registry in-document)."* The mode-C chrome module
`fui:embed/chrome-in-document.ts:106` composes `createDisclosureNav(...)`; that factory already imports FUI block
impl, so it is the natural place to also instantiate a registry.

**The boundary — corrected grounding (post-prep amendment, 2026-06-18).** The prep first leaned on #765's crux
+ "FUI already `extends CustomAttribute`." A skeptic pass rightly knocked that over: it conflates an *author-time
class-extension* (contract) with *running the registry engine in-host* (runtime). The **correct, stronger**
footing is the **website ≠ standard** distinction (raised by the user): the boundary (#700/#765/#817) constrains
the *standard artifacts / the webeverything package* — no FUI **source** dependency, unidirectional WE→FUI — not
the docs *website*, which is a downstream consumer free to run FUI + WE standards. Verified the site loads FUI by
**runtime URL** (`we:src/_layouts/base.njk:26,417`, a `{{ links.frontierUrl }}/embed/…` dynamic import), so the
webeverything package has **zero build dependency** on frontierui. A consumer page booting a WE-standard runtime
(webbehaviors) inside the FUI runtime bundle is the dogfood, not a crossing. The residual guard: keep it the
runtime bundle — a build-time `import '@frontierui'` into the eleventy site *would* invert the source direction
(#700/#239) and is the only thing that would actually violate the boundary. The ratified item carries this
re-grounding; this report records the correction.

## The trait gap (decision-relevant: it sizes #934, doesn't block the call)

`nav:section` + `nav:list` cover the disclosure toggle + roving tabindex, but the hand-rolled horizontal
`disclosure-nav` does **four** things the current traits do not:
1. **Sibling-exclusive open** — opening one section closes the others (`closeAll(head)`); `nav:section` is standalone.
2. **Outside click/focus dismiss** — `onOutside` via `composedPath()`; in neither trait.
3. **Responsive desktop-only gating** — `isDesktop()` matchMedia; below the breakpoint panels are CSS-static.
4. **Escape → collapse + refocus head** — `nav:section` wires Enter/Space only, not Escape.

Plus a **shadow-scoping fix**: `NavSectionBehavior.controlledElement` uses `document.querySelector`, which
cannot see a panel that is a sibling **inside the same shadow root** — it must resolve via
`this.target.getRootNode()`.

This is not a reason to keep hand-rolling — it is the dogfood doing its job: the conformance proof has
**surfaced a real gap in the trait library** (the horizontal APG menu pattern is under-served). Composing
forces the trait layer to grow to cover it (a coordinator/menu trait, or `nav:section` enhancements). That is
build scope for #934 and likely a dedicated trait-enhancement child — record it so #934 is not under-sized at 13.

## Calls

1. **Boot the registry; chrome composes traits (Fork 1 → A).** B (stay hand-rolled) is not a coherent
   *end-state*: it makes #777's "site as conformance proof" false (proves "FUI renders a nav," not "WE's stack
   composes one"). It is the *interim* until #934 lands, not a chosen branch. ~90%; residual = trait-gap +
   lifecycle, not direction.
2. **Boundary: no violation (Fork 2 → entitled).** Per #765's crux + every trait already extending the
   webbehaviors `CustomAttribute`. ~95%.
3. **Per-mount registry (Fork 3 → per-mount).** Instantiate in the mode-C module; `upgrade(shadowRoot)` on
   mount, `downgrade(shadowRoot)` in the existing teardown closure. Matches the per-mount teardown contract
   (`mountInDocument(root): () => void`) and the separation bias. Shared-page registry is a later measured
   optimization. ~80%.
