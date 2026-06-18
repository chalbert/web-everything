# Mode-C host→FUI config transport — prior-art survey (decision #881)

**Date:** 2026-06-17
**Grounds:** backlog #881 (decide the WE→FUI mode-C host-config transport for dogfooded chrome),
gating #865 (migrate WE-docs site chrome to FUI components), under the dogfooding epic #777.
**Builds on the real trees:** the mode-C SDK (#786), the chrome blocks (#870), the in-document
boundary relaxation (#765).

## The question

Mode C (#786) mounts a FUI component in WE's own DOM behind a shadow root with **no config channel**:
the SDK calls `mod.mountInDocument(root)` with only the `ShadowRoot`
([`fui:frontierui/embed/in-document.ts:89`](../../frontierui/embed/in-document.ts), contract at
[`fui:frontierui/embed/contract.ts:72-74`](../../frontierui/embed/contract.ts)). The dogfooded WE-docs
chrome (#865) needs WE to supply its **nav tree / brand / footer** — WE-owned site information
architecture (content) — to FUI's `app-shell` / `sectioned-nav` / `button` blocks (#870), which
already expose `mount*(root, config)` factories
([`fui:AppShell.ts:144`](../../frontierui/blocks/app-shell/AppShell.ts),
[`fui:SectionedNav.ts:120`](../../frontierui/blocks/sectioned-nav/SectionedNav.ts),
[`fui:Button.ts:119`](../../frontierui/blocks/button/Button.ts)). The constellation docs-rendering
boundary (#765) forbids baking WE's IA into a FUI module. So **how** does host config cross the
WE→FUI mode-C seam at mount time? It's a reusable cross-repo convention — every future mode-C host
with host-specific config inherits it.

## Grounding wrinkle the survey had to resolve

`AppShellConfig` takes **live DOM `Node`s**, not serializable data: `nav?: Node`, `footer?: Node`,
`headerControls?: Node[]` ([`fui:AppShell.ts:29-43`](../../frontierui/blocks/app-shell/AppShell.ts)). But
mode C has **no host→module JS handoff point** — the SDK imports the module and calls
`mountInDocument(root)`; the host never gets a reference to call a factory with live Nodes. The only
host-reachable handle inside the module is `root.host` (the mount-point element) and whatever the host
left on/in it in the DOM. **Therefore any transport that rides the existing SDK is inherently
DOM-mediated and must carry a *serializable* projection** of the config; the generic FUI module
deserializes it and rebuilds the `Node` tree via the sub-block factories (`mountSectionedNav`,
`mountButton`) before calling `mountAppShell`. This is true of every non-invasive option and is the
load-bearing shape of the decision: define a **JSON-serializable `ChromeConfig`** schema (brand
strings + nav-link data + footer data), not pass `AppShellConfig` directly.

## What the survey found — four prior-art families

The host→component configuration space (browser platform + third-party embed kits) splits four ways:

1. **`data-*` attribute JSON (declarative, on the mount point).** The dominant third-party-widget
   convention — Stripe Elements, Cloudflare Turnstile, countless analytics embeds receive config from
   the host purely via `data-*` attributes. Standards-compliant, fully decoupled, no globals, degrades
   cleanly. Con: attributes are strings, so JSON must be `JSON.parse`d, and deep structures inflate via
   HTML entity-encoding of quotes.
2. **`<script type="application/json">` config sidecar (declarative, inside the mount point).** The
   canonical platform pattern for handing structured config to a script/component without attribute
   limits — used by JSON-LD, Inertia's `data-page`-vs-script-tag debate, many web-component init
   recipes. Same parse step, but **no entity-encoding overhead** (a measured case dropped a payload
   from 179→98 chars) and reads naturally for a deep nav tree. It is the **ergonomic refinement of
   family 1**, not a rival channel: still DOM-mediated, still serializable, still degrades.
3. **JS properties / typed argument (imperative).** The web-component-native way to pass complex
   objects — set a property or call a factory with a typed object. This is what a *contract change*
   (`mountInDocument(root, hostConfig?)`) would buy: a first-class typed argument, no DOM scraping. But
   it requires a host→module JS handoff point that mode C does not have today, so it means **changing
   the #786 contract + SDK + every consumer**.
4. **Light-DOM declarative HTML the module reads/enhances (the "HTML web component" pattern).** The
   host emits real `<a>` nav links / footer markup as light-DOM children of the mount point; the module
   reads/enhances them. Notable because the same markup doubles as the **no-JS SSR baseline** — but
   #865 explicitly keeps the hand-written `we:base.njk` chrome as that baseline and scopes PE fallback out
   of #881, so this is a variant to note, not adopt now.

## How this maps onto #881's forks

- **Fork 1 (transport channel).** Families 1+2 = the card's **Option A** (host writes config as data on
  the mount point; a generic FUI module reads `root.host` and calls the #870 factories) — the survey
  *refines* A by adding the `<script type="application/json">` sidecar as the recommended carrier for
  the deep nav tree, dissolving A's lone residual (JSON-in-attribute ergonomics). Family 3 = **Option B**
  (extend the contract) — coherent but costs a contract change for a need only chrome has today; a clean
  *later* promotion. The card's C (WE-specific FUI-hosted module) stays **rejected on the #765
  boundary**; D (global) stays strictly worse than per-mount-point locality. → **A holds, strengthened.**
- **Fork 2 (mount granularity).** Prior art doesn't move it: `app-shell` is the composing block and
  static chrome has no independent-lifecycle need, so **one mount point / one config blob (A)** holds.

## Net effect on the decision

The survey **confirms A and dissolves its residual** rather than reshaping the fork — but it adds a
concrete, load-bearing implementation constraint (serializable `ChromeConfig` projection + `<script
type="application/json">` carrier) that the prepared item now records, so the build (#865) inherits the
*shape* of the config contract, not just the channel choice.

## Sources

- [Creating semantic sites with Web Components and JSON-LD — Chrome for Developers](https://developer.chrome.com/blog/creating-semantic-sites-with-web-components-and-jsonld)
- [Using a script tag instead of a data attribute to pass initial data — Inertia.js discussion #1389](https://github.com/inertiajs/inertia/discussions/1389)
- [Pass Object into Web Component Property via Element Attribute — Svelte #3381](https://github.com/sveltejs/svelte/issues/3381)
- [How to Pass Data into a Static JavaScript File Using data-* Attributes — DEV](https://dev.to/zahra_mirkazemi/how-to-pass-data-into-a-static-javascript-file-using-data-attributes-2im7)
- MDN: [`data-*` attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes) · [`<script type>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type)
