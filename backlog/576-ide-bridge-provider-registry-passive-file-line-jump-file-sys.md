---
kind: story
size: 5
status: resolved
blockedBy: ["562"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/dev-browser/ide-bridge — IdeBridgeRegistry (runtime-DI provider registry) + vscode://file passive-jump provider + File System Access patch-write provider (Chromium-only, degrades to jump); VS Code extension slot reserved for #577
locus: plateau-app
tags: [dev-browser, ide-bridge, file-system-access, plateau, provider-registry]
---

# IDE-bridge provider registry — passive file:line jump + File System Access patch-write

The bridge half of [#562](/backlog/562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac/) (ratified
2026-06-14). A runtime-DI **provider registry** the dev-browser consults to *act on the repo* once a resolver
([#575](/backlog/575-source-anchor-self-description-contract-resolver-provider-re/)) has yielded `file:line`.
Per #562 Fork 2 (ruling **A**), this item ships the **must-have substrate** — the two providers that need no
extension install:

- **Passive `file:line` jump** — `vscode://file/{abspath}:{line}:{col}` (and `cursor://`, JetBrains Toolbox
  analogues). Universal, zero-install, one-way (open-at-location, no patching).
- **File System Access patch-write** — `showDirectoryPicker()` → hold a `FileSystemDirectoryHandle` → resolve
  node→file → write the patch via `createWritable()`. Zero-install, zero-server, works from a **deployed**
  HTTPS tab; **Chromium-only**, so it degrades to passive-jump on other browsers.

Registry precedence (full chain; the richest provider lands in #577, dev-only providers later): **VS Code
extension** (two-way, if installed) → **FS Access** → **`vscode://file`** → **dev-server `launch-editor`**
(localhost dev only). **Degradation:** no extension + non-Chromium → `vscode://file` jump only.

The richest provider — the **deep two-way VS Code extension** — is carved to
[#577](/backlog/577-deep-two-way-vs-code-extension-emit-active-projects-coordina/) (separation bias). The runtime
analogue already in-tree is the dev-server `/__dev-panel/selection` bridge
([we:tools/dev-panel/vite-plugin.ts:260-281](../tools/dev-panel/vite-plugin.ts#L260)). **Constellation:** Plateau
dev-browser product (#475/#091). Grounded in [`source-awareness-substrate`](/research/source-awareness-substrate/).
