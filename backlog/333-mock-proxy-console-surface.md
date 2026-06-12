---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["332"]
dateOpened: "2026-06-11"
tags: [mock, proxy, dev-service, console, self-run-tool]
---

# Mock/proxy console surface (latency/fault/conditional overrides)

Build the console surface over the self-run mock/proxy dev-server: a config editor plus a live call monitor exposing latency, fault, and conditional-response overrides, the `mock | proxy | record` response-kind, and per-service toggles. Ships in the free self-run tier (the hosted call-history/broker is the deferred upsell). Ratified in #107 (Fork 2): the console ships with the self-run tier so developers can drive overrides locally without a hosted service. Blocked on the dev-server provider (#332) it instruments.
