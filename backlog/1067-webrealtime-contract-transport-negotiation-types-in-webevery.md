---
kind: story
size: 3
parent: "1025"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:realtime/contract.ts"
tags: []
---

# webrealtime contract — transport-negotiation types in @webeverything

Slice A of webrealtime impl epic #1025. Define the transport-negotiation contract (negotiate WebSocket / SSE / WebTransport behind one contract) in @webeverything per the resolved #458 design. Type-only crosses the seam. Foundation slice — B and C build on it.

## Progress

Shipped `we:realtime/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/transport-negotiation`): `CustomTransportProvider` (the `connect` swap seam,
native SSE/WebSocket default), `Connection` (optional `send` for bidirectional only), `TransportKind`
(native-first floor order). Mirrors the contract specified in
`we:src/_includes/project-webrealtime.njk` (#458 design, #455 by-purpose split). Open-app delivery only;
closed-app push is webnotifications. Runtime negotiating provider + WebTransport probe + hub adapters
stay impl (→ FUI). The 3 open questions (mid-session re-negotiation, reconnect ownership vs
webreliability, message envelope) stay carved out — payload kept opaque.
