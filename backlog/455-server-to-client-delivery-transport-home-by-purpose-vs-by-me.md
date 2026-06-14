---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [gap-analysis, transport, realtime, push, protocol]
relatedReport: reports/2026-06-11-webpermissions-project.md
preparedDate: "2026-06-12"
---

# Server-to-client delivery transport home — by-purpose vs by-mechanism (push + realtime WS/SSE/WebTransport)

`webresources` homes client-initiated fetch, but the **server→client** transports are unowned: Web Push (closed-app) is provisionally headed to `webnotifications` (#009), while the open-app realtime family (WebSocket, SSE/EventSource, WebTransport, long-poll) has **no home at all**. This card decides the transport home: **(A) by purpose** — push lives in notifications, realtime gets its own `webrealtime`/`webchannels` home; or **(B) by mechanism** — one shared delivery home owns push *plus* realtime behind capability-negotiated providers, with notifications a consumer. Grounded in a 2026-06-12 transport-landscape survey ([relatedReport](../reports/2026-06-11-webpermissions-project.md) addendum). Splits the transport question out of [#009](009-gap-13-webpermissions-project.md) (gap #13 notifications).

## Context — the current transport map

| Transport | Direction / lifecycle | Home today |
|---|---|---|
| Request/response (fetch; polling = repeated fetch) | client-initiated, one-shot | ✅ `webresources` ([projects.json:22](../src/_data/projects.json#L22)) |
| **Web Push** | server→client, **closed-app** (SW + push service + VAPID) | ⏳ provisional → `webnotifications` (#009 Fork C/D) |
| **WebSocket** | bidirectional, open-app | ❌ unowned |
| **SSE / EventSource** | server→client stream, open-app | ❌ unowned |
| **WebTransport** | bidi + datagrams (HTTP/3/QUIC), open-app; no Safari | ❌ unowned |

So the *pull* side is homed; everything *push/streaming and open-app* is homeless. The survey's load-bearing findings: a **hard capability cliff** between closed-app (Web Push) and open-app (WS/SSE/WebTransport) delivery — they are non-fungible (you don't fall back from a live socket to a closed-app push); and the industry **vocabulary** keeps "push" (a notification channel) separate from "realtime/pub-sub" (the live transports — Ably, Pusher, PubNub, Centrifugo).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · home axis** | **(A) by purpose** — push → `webnotifications`; realtime → own home | (B) by mechanism — one transport home, notifications consumes push | **Med** — genuine either/or; the real call on this card |
| **2 · realtime home name + scope** | new **`webrealtime`** project owning a transport-negotiation protocol (WS/SSE native defaults, WebTransport capability-gated, poll degradation) | `webchannels` / `webmessaging`; or defer scope to first build | **Med-high** — concern is real + unowned; name follows pub-sub vocabulary |

## Fork 1 — by-purpose vs by-mechanism (the real call)

Both branches are coherent and mutually exclusive — a genuine decision, not a support-all.

- **(A — recommended) Home transports by purpose.** Push-delivery lives in **`webnotifications`** (its real consumer is notifications; the platform chains push→notification via the user-visible rule). The open-app realtime family gets its **own** home (Fork 2). Two domain-coherent homes; no shared pool. *Why default:* the open/closed cliff means a pooled home has a hard internal split anyway, push's only practical consumer is notifications, and it matches platform + industry factoring.
- **(B) Home transports by mechanism.** One **`webrealtime`/`webdelivery`** home owns *all* server→client live transports — Push **and** WS/SSE/WebTransport — behind capability-negotiated providers; `webnotifications` *consumes* the push transport rather than owning it. *Why tempting:* push is structurally a transport like the others, and transport-from-purpose separation is our standing bias — this is the "cleaner" decoupling. *Cost:* splits push from the notification render it's platform-chained to, and the home still carries the open/closed split internally.

**The pivot:** (A) optimizes for *domain cohesion* (push with its consumer); (B) optimizes for *mechanism cohesion* (all transports together). The capability cliff + push's single consumer tip me to (A), but (B) is defensible if we value the transport-layer purity more.

## Fork 2 — the realtime home (needed under *either* branch)

WS/SSE/WebTransport are unowned regardless of Fork 1 — (A) gives them their own home, (B) makes that home own push too. So this fork stands either way.

- **(recommended) A `webrealtime` project** owning a **transport-negotiation protocol**: a `CustomTransportProvider` seam with SSE and WebSocket as native-first defaults (SSE for server→client streams, WS for bidirectional), **WebTransport capability-gated** (Chrome/Edge only, no Safari — graceful degradation), long-poll/poll as the degradation floor. Mirrors Socket.IO/SignalR/Centrifugo transport auto-negotiation. Name follows the industry "realtime/pub-sub" vocabulary, not "push."
- **(alt) `webchannels` / `webmessaging`** — same shape, different label; `webmessaging` risks colliding with the Channel Messaging API / `postMessage`. `webrealtime` is the least ambiguous.
- **(alt) Defer the protocol scope** to the first real build (e.g. an exercise-app live feature) so the provider contract is grounded in a consumer rather than designed cold.

## Relationship to #009

#009 (gap #13) decides the **notification render/UX domain** — `permission` intent, `system-notification` intent, a `notification-marker` intent family, and `webnotifications` as the render+orchestration home. **This card decides where the push-delivery *transport* lives** (and the realtime family's home). #009's Fork D is **delegated here**; #009 consumes whatever protocol home this card rules. Resolve this card first; #009's push-home line then follows.

## Resolution — 2026-06-13

- **Fork 1 → (A) by purpose.** Transports are homed by their domain, not pooled by mechanism. The **push-delivery protocol lives in `webnotifications`** (its real consumer; the platform chains push→notification via the user-visible rule), and the open-app realtime family gets its **own** home. The capability cliff (closed-app push is non-fungible with open-app streaming) means a pooled home would carry a hard internal split anyway, so (B) bought no cohesion. Push-ownership is built in **[#456](456-author-the-webnotifications-project-push-delivery-protocol-n.md)** (webnotifications + push-delivery protocol).
- **Fork 2 → mint `webrealtime`.** A new project owning a **transport-negotiation protocol** — `CustomTransportProvider` seam, SSE + WebSocket native-first defaults, WebTransport capability-gated (no Safari), long-poll/poll degradation floor. Named per the realtime/pub-sub vocabulary (not "push"). Built in **[#458](458-author-the-webrealtime-project-transport-negotiation-protoco.md)**.

Graduates to builds #456 (push home) and #458 (realtime home). Unblocks #009's push-ownership line.
