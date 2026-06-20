---
kind: task
status: resolved
blockedBy: ["577", "685"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app/src/dev-browser/ide-bridge/vscode-extension/activate.ts
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, packaging, plateau-app]
---

# VS Code extension publishable shell — activate() + localhost HTTP/WS server + URI handler

Package the #577 testable spine as an installable VS Code extension: an activate() that stands up a localhost HTTP/WS server piping each frame through createBridgeHandler(createVscodeHost(vscode, version)), plus registerUriHandler for vscode://publisher.ext/… routing, and the extension manifest (engines.vscode, contributes). This is the only part that needs a real extension host to run — the protocol, browser provider, handler core, and live-API adapter already ship in plateau-app/src/dev-browser/ide-bridge/vscode-extension/. Verify end-to-end against a running dev-browser tab.

**Blocked on its test harness (#685).** plateau-app's `npm test` (Vitest) never loads an extension host, so it cannot run `activate()` / `registerUriHandler` / the manifest. Per the agent-runnable-verification rule (`we:docs/agent/testing.md`), this end-to-end claim needs the `@vscode/test-electron` Extension-Development-Host harness as a resolved dependency — `blockedBy: ["685"]`. Build the shell against that harness so activation is a reproducible green, not a manual F5.

## Progress

- **2026-06-15 — built + verified (reproducible green, both lanes).** The publishable shell:
  - `plateau:bridge-server.ts` — a dependency-free `node:http` localhost server that pipes each JSON `BridgeRequest`
    through `createBridgeHandler(createVscodeHost(vscode, version))`. (HTTP transport; the protocol is
    transport-agnostic, so a WS upgrade is a no-new-dep enhancement, not required.)
  - `plateau:activate.ts` — the host-only shell: builds the live host from the real `vscode` API, starts the bridge
    server, `registerUriHandler` for `vscode://publisher.ext/jump?file=…&line=…&col=…`, a
    `plateauIdeBridge.showPort` command, and tears the server down on dispose. Returns `{ activated, port }`.
  - `plateau:protocol.ts` gains `jumpRequestFromUriQuery(path, query)` (the deep-link → jump-request parser, on the
    shared wire contract).
  - `extension/` — the publishable manifest (`engines.vscode`, `main`, `onStartupFinished`, the command) +
    `we:tsconfig.json` compiling the shell to CJS (`plateau:out/vscode-extension/activate.js`).
- **Verified two ways:**
  - **Fast lane (locus gate, `npm test`):** `plateau:bridge-server.test.ts` — the real server over a REAL loopback
    socket (`@vitest-environment node`): hello handshake, `listActiveProjects`, 404 wrong-method/path,
    400 bad-body, + the `jumpRequestFromUriQuery` cases. Full plateau-app Vitest **161/161 green**.
  - **Host lane (`@vscode/test-electron`, #685):** extended `plateau:__host-tests__/runner.mjs` with a second pass
    that compiles `extension/` and launches the Extension Development Host against it; new
    `plateau:real-suite/real-shell.test.cjs` asserts `activate()` stands up the bridge + returns `{activated, port}`,
    the `showPort` command reports the bound port, and a real `hello` frame round-trips through the in-host
    server. **Ran green here** (VS Code 1.124.2): fixture pass 4/4 + real-shell pass 3/3.
- This closes the host-only surface #134-style note in `plateau:host.ts`/`plateau:host-adapter.ts` deferred to the
  "publishable packaging follow-up". Both blockers (#577 spine, #685 harness) were resolved.
