---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "project:webrealtime"
tags: []
---

# Author the webrealtime project + transport-negotiation protocol (WS/SSE/WebTransport/poll)

Ratified in #455 Fork 2: mint a webrealtime project owning a transport-negotiation protocol for open-app server-to-client delivery — a CustomTransportProvider seam with SSE and WebSocket native-first defaults, WebTransport capability-gated (Chrome/Edge only, no Safari, graceful degradation), long-poll/poll as the degradation floor. Mirrors Socket.IO/SignalR/Centrifugo auto-negotiation. The currently-unowned realtime family gets a home; named per the realtime/pub-sub vocabulary, not push.
