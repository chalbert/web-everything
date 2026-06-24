---
kind: story
size: 3
parent: "1656"
locus: plateau-app
status: resolved
blockedBy: []
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1656
tags: [dev-browser, ide-bridge, chrome-extension, plateau]
---

# IDE-bridge transport adapter over chrome.runtime for the dev-browser extension

The dev-browser funnel-MVP's first real tool (#1656 S2): carry the existing transport-agnostic BridgeRequest/BridgeResponse frames (#577/#676) panel→service-worker→host over chrome.runtime.sendMessage, reusing the built protocol at plateau:src/dev-browser/ide-bridge/vscode-extension/protocol.ts. Jump-only — transport plumbing for the existing jump(location) call, NOT the #1652 element-resolver. blockedBy the #1671 scaffold. Demoable: from the panel, a jump opens the file in VS Code via the existing host server.

## Progress (batch-2026-06-23-1725-1665) — DONE

Built the chrome.runtime IDE-bridge transport (the #1656 S2 first real tool), carrying the #577 BridgeRequest/BridgeResponse frames panel → service-worker → host. #1671 scaffold verified present (`plateau:src/dev-browser/chrome-extension/`).

- `plateau:src/dev-browser/ide-bridge/vscode-extension/chromeRuntimeTransport.ts` — the tested adapter, three injected seams: `createChromeRuntimeTransport(runtime)` (PANEL: a `BridgeTransport` posting frames via `chrome.runtime.sendMessage`, injected into `createVscodeExtensionProvider` so `provider.jump(location)` flows unchanged), `createBridgeRelay(forwardToHost)` (SERVICE-WORKER: a `chrome.runtime.onMessage` listener forwarding frames + keeping the channel open for the async response per MV3, degrading errors to `ok:false`), and `createFetchHostTransport(endpoint, fetch)` (SW → HOST leg over HTTP). Reuses the #577 `plateau:src/dev-browser/ide-bridge/vscode-extension/protocol.ts` verbatim.
- `plateau:src/dev-browser/ide-bridge/vscode-extension/chromeRuntimeTransport.test.ts` — 7 tests: jump round-trips panel→worker→host, `provider.jump` flows unchanged (resolves on ok, throws on `ok:false`), host-rejection degrades, non-bridge messages ignored, the HTTP host leg POSTs + parses + degrades.
- `plateau:src/dev-browser/chrome-extension/background.js` — the MV3 service worker now registers the relay (plain JS mirroring the tested TS contract — the worker isn't bundled from TS), forwarding `we-ide-bridge` frames to the host's `127.0.0.1:<port>/bridge` localhost server (port read from storage when the host announces it, else a default).

Jump-only transport plumbing (the #1652 element-resolver that supplies the location is a separate slice). Cleared the stale `blockedBy: 1671`. Full plateau suite green (56 files / 457 tests).
