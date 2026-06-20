---
type: idea
workItem: story
size: 5
parent: "1025"
status: resolved
blockedBy: ["1067"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webrealtime/index.ts"
tags: []
---

# webrealtime provider — transport-negotiation runtime in FUI

Slice B of webrealtime impl epic #1025 (blockedBy slice A contract). Implement the transport-negotiation runtime in FUI (negotiate + fall back across WebSocket / SSE / WebTransport behind the WE contract), conforming to the contract; swappable.

## Resolution (batch-2026-06-19)

Built in `fui:plugs/webrealtime/` (headless runtime → plug):

- `fui:plugs/webrealtime/provider.ts` — `NativeTransportProvider`, native-first negotiation over injected platform globals: `probeCapabilities` + `negotiate` walk `prefer` top-down (capability-gated; WebTransport feature-detected) and degrade to the long-poll floor. Connection wrappers for WebSocket (bidirectional), SSE (one-way, no `send` — type-honest, #1025 ruling 2), WebTransport (datagrams), and long-poll (fetch loop). `NoTransportError` when nothing is available.
- `fui:plugs/webrealtime/registry.ts` — `CustomTransportRegistry`, by-id swap (`native` default; Socket.IO/SignalR/Centrifugo hubs plug in), `resolve` with default fallback.
- `fui:plugs/webrealtime/index.ts` — `createDefaultTransportRegistry()` seeding the native provider.

Conforms to `@webeverything/contracts/transport-negotiation` (FUI→WE arrow). Added the WE distribution seam (`we:contracts/transport-negotiation.ts` re-export of `we:realtime/contract.ts` + `./transport-negotiation` subpath) + FUI path-maps + the `webrealtime` `fui:src/_data/plugs.json` entry. Covered by `fui:plugs/webrealtime/__tests__/webrealtime.test.ts` (12 tests). FUI `check:standards` green.
