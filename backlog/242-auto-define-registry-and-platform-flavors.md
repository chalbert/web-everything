---
kind: story
status: resolved
dateOpened: "2026-06-09"
blockedBy: ["241"]
size: 5
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: blocks/renderers/auto-define/CustomAutoDefineRegistry.ts
tags: [components, custom-elements, auto-define, registry, platform-config, open-extension]
parent: "227"
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-auto-define-strategy, label: Auto-Define Strategy Protocol }
---

# Auto-Define registry (extends `CustomRegistry`) + platform config flavors

Successor build to the #227 ruling. Implements the **open registry** and the **config-extends-platform**
default model so the default-strategy selection lives in config, never in the tool.

## Scope

- **Registry extends core `CustomRegistry`** (`we:plugs/core/CustomRegistry.ts`) — own → extended chain,
  **no `#defaultName` baked into the tool**. Do NOT copy `CustomRenderStrategyRegistry`'s
  first-registered-wins default (that's the anti-pattern #243 fixes).
- **Platform config flavors** — ship fully-defined flavors a project extends:
  - `strict-explicit` — default = `explicit` (native baseline, no inference)
  - `lazy-dom` — default = on-first-use DOM-presence (MutationObserver dynamic-import)
  - `build-parsed` — registration resolved at build time (parse HTML usage, inject imports / manifest)
  - A project picks one by extending it; per-scope override via the inheritance chain.
- **Open extension hook** — authors register a custom `AutoDefineStrategy` (e.g. server-driven,
  convention-URL) that coexists conflict-free. Standardize the contract + resolution rules, not the
  list.
- **Scope token** — reserve a `RegistryScope` token for the Scoped Custom Element Registries proposal
  (per-shadow-root); default `global`. Thin, like `RenderScope` is today.

## Done when

- Registry extends `CustomRegistry`; resolving the default walks the extended platform-config chain.
- All three platform flavors registered + selectable by extension; a project sets its default by
  extending one, with a per-scope override test.
- A custom strategy registers and resolves without forking; conflict-free coexistence test.
- The `lazy-dom` DOM-presence strategy implemented as the reference inferring strategy (the CSS-Tricks
  MutationObserver pattern cited in #227).

Depends on #241 (contract + helper). The build-parse strategy's HTML-usage resolution (Custom Elements
Manifest / `unplugin`-style) can be its own follow-up if it grows past this item.

## Progress

- **Status:** resolved (2026-06-10)
- **Registry — `we:blocks/renderers/auto-define/CustomAutoDefineRegistry.ts`:** `CustomAutoDefineRegistry`
  extends the core `CustomRegistry<AutoDefineStrategy>` (own → extended chain), `localName =
  'customAutoDefine'`. **No tool-baked default** — deliberately NOT the `CustomRenderStrategyRegistry`
  shape: `define(strategy, asDefault?)` only touches the default when `asDefault` is passed (no
  first-registered-wins), `setDefault(key)` gives a per-scope override, and `defaultKey` resolves own →
  *extended config's* default (nearest-config-wins). A bare registry has `defaultKey === null` and
  `resolve()` throws `UnknownAutoDefineError`.
- **Platform-config flavors:** `createStrictExplicitFlavor` (default `explicit`), `createLazyDomFlavor`
  (default `lazy-dom`, explicit still available), `createBuildParsedFlavor` (default `build-parsed`) —
  each a fully-defined registry a project extends (`new CustomAutoDefineRegistry({ extends: [flavor] })`)
  to inherit strategies **and** default. `AUTO_DEFINE_FLAVORS` exposes the three by name for discovery.
- **lazy-dom reference inferring strategy — `we:lazyDomStrategy.ts`:** the CSS-Tricks MutationObserver
  pattern (cited in #227) reified — `key 'lazy-dom'`, `trigger 'first-use'`, a `resolve` (convention
  `./{tag}.js`, overridable) plus `createDomPresenceObserver(strategy, root, { import })` that scans the
  initial tree and watches for undefined custom-element tags, importing each tag's defining module on
  first DOM presence. Importer is injectable (testable without a real module graph); a non-inferring
  strategy yields a no-op observer.
- **build-parsed — `we:buildParsedStrategy.ts`:** kept thin (per the item note) — `resolve` looks a tag up
  in a build-emitted manifest (`createBuildParsedAutoDefine(manifest)`); unknown → `undefined`.
- **Open extension:** a custom `AutoDefineStrategy` (e.g. server-driven) registers and resolves through
  the same chain conflict-free, and a project can make it the default by extension — coexistence tested.
- **Scope token:** the `RegistryScope` reserved by #241 is threaded through each strategy's
  `define(tag, ctor, scope?)`; default scope stays global (thin, per scope).
- **Tests:** `we:blocks/__tests__/unit/renderers/autoDefineRegistry.test.ts` (16) — no-default / extends-a-flavor
  default inheritance / per-scope override / custom-strategy coexistence / lazy-dom DOM-presence (initial
  + MutationObserver-added) / build-parsed manifest. Full unit suite green (2009).

### Follow-on (captured, not blocking)

`build-parsed`'s real HTML-usage scan (Custom Elements Manifest / `unplugin`-style build step that emits
the manifest + injects imports) is still a stub here — the runtime resolution against a manifest is
done; the build-time *producer* of that manifest is the follow-up the item flagged.
