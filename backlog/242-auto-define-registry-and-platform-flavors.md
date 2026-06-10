---
type: issue
workItem: story
status: open
dateOpened: "2026-06-09"
blockedBy: ["241"]
size: 5
tags: [components, custom-elements, auto-define, registry, platform-config, open-extension]
parent: "227"
relatedProject: webcomponents
crossRef: { url: /projects/webcomponents/#protocol-auto-define-strategy, label: Auto-Define Strategy Protocol }
---

# Auto-Define registry (extends `CustomRegistry`) + platform config flavors

Successor build to the #227 ruling. Implements the **open registry** and the **config-extends-platform**
default model so the default-strategy selection lives in config, never in the tool.

## Scope

- **Registry extends core `CustomRegistry`** (`plugs/core/CustomRegistry.ts`) — own → extended chain,
  **no `#defaultName` baked into the tool**. Do NOT copy `CustomRenderStrategyRegistry`'s
  first-registered-wins default (that's the anti-pattern #243 fixes).
- **Platform config flavors** — ship fully-defined flavors a project extends:
  - `strict-explicit` — default = `explicit` (native baseline, no inference)
  - `lazy-dom` — default = on-first-use DOM-presence (MutationObserver dynamic-import)
  - `build-parsed` — registration resolved at build time (parse HTML usage, inject imports / manifest)
  - A project picks one by extending it; per-scope override via the inheritance chain.
- **Open extension hook** — authors register a custom `AutoDefineStrategy` (e.g. server-driven,
  convention-URL) that coexists conflict-free. Standardize the contract + resolution rules, not the
  list (`[[project_intents_open_design]]`).
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
