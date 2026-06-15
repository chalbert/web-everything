---
type: idea
workItem: story
size: 8
status: resolved
blockedBy: ["576"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "plateau-app/src/dev-browser/ide-bridge/vscode-extension/ (protocol + browser provider + WorkspaceEdit/conflict handler core + live-API adapter, wired into createDefaultIdeBridge); publishable extension shell → #676"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, plateau, two-way-sync]
---

# Deep two-way VS Code extension — emit active projects + coordinate patch work (carved from #562 Fork 2)

Carved from [#562](562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac.md) Fork 2 (ruling **A**,
separation bias): the **richest IDE-bridge provider**, kept out of the must-have substrate
([#576](576-ide-bridge-provider-registry-passive-file-line-jump-file-sys.md)) and given its own home so the
foundation stays shippable and this layer is independently prioritized.

A VS Code extension running a **localhost HTTP/WS server** the dev-browser tab talks to, providing the
two-way capabilities the passive/FS-Access providers can't:

- **Apply patches** into the live workspace via `WorkspaceEdit` / `workspace.applyEdit` (undoable, event-firing)
  rather than a raw file write.
- **Emit which projects are open / active** (`workspace.workspaceFolders`, per-window) so the browser knows
  where a deployed app's source lives.
- **Two-way coordination** — conflict with unsaved edits, concurrent-fix arbitration, editor↔browser sync,
  custom `vscode://publisher.ext/…` URI routing (`registerUriHandler`).

Precedent: **Stagewise** (Express+WS in the extension host). Registers as the top-precedence provider in
#576's bridge registry when installed. **Constellation:** Plateau dev-browser product (#475/#091). Grounded in
[`source-awareness-substrate`](/research/source-awareness-substrate/). Size 8 — candidate for a `/split` pass
(server+protocol / patch-apply / active-project model / conflict handling are natural slices).

## Progress

- **2026-06-15 — built the testable spine (plateau-app).** Landed under
  `src/dev-browser/ide-bridge/vscode-extension/`, filling the `VSCODE_EXTENSION` precedence slot #576
  reserved:
  - **`protocol.ts`** — the transport-agnostic browser↔extension wire contract (versioned `hello`
    handshake, `listActiveProjects`, `jump`, two-way `patch` with an optional `baselineHash` for conflict
    detection), one source of truth for both halves.
  - **`provider.ts`** — the browser-side `createVscodeExtensionProvider` (precedence 40, `['jump','patch']`),
    forwarding over an injected `BridgeTransport` (HTTP/WS-agnostic); `isAvailable()` is the `hello`
    round-trip so the registry degrades to the substrate when the extension isn't running. Plus
    `listActiveProjects` (the "emit active projects" capability beyond jump/patch).
  - **`host.ts`** — the extension-host handler core `handleBridgeRequest(req, host)`: `WorkspaceEdit`
    patching (undoable, event-firing, not a raw write), workspace-folder emit, and **conflict arbitration**
    (refuses a patch when the live document's hash no longer matches the browser's `baselineHash` — the
    two-way coordination the substrate can't offer). Pure aside from the host calls; never throws.
  - **`host-adapter.ts`** — `createVscodeHost(vscode, version)` binding the live API through a structural
    `VscodeApi` seam (imports NO `vscode` module, so it compiles + tests inside plateau-app), plus
    `createBridgeHandler` and the `djb2` conflict hash.
  - **Wiring:** `createDefaultIdeBridge({ vscodeExtension: { transport } })` registers it on top,
    availability-gated.
  - **Tests:** 12 new tests (handler core: patch/active-projects/conflict-refuse/conflict-apply/no-workspace;
    provider: availability handshake, precedence, conflict-as-thrown-error; registry: wins-when-available +
    degrades-when-down). Full plateau-app suite green (154/154).
  - **Carried follow-up (the publishable shell):** the ~30-line `activate()` that registers a localhost
    HTTP/WS server piping frames through `createBridgeHandler` + the `registerUriHandler` for
    `vscode://publisher.ext/…` routing — the only part needing a real extension host to run — is scaffolded
    as a follow-up. The protocol, browser provider, handler core, and adapter (the whole testable spine)
    ship here. graduatedTo: `plateau-app/src/dev-browser/ide-bridge/vscode-extension/`.
