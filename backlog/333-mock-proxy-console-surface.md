---
type: idea
workItem: story
size: 5
status: resolved
locus: frontierui
blockedBy: ["332"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/tools/mock-server/console.ts — MockConsole façade (config editor for per-service mode/latency/fault overrides) + CallMonitor live monitor + BehaviorOverrideController; server.ts gains onCall/overrides/clock hooks + applyBehaviorOverride
tags: [mock, proxy, dev-service, console, self-run-tool]
---

> **Locus: frontierui (2026-06-13).** #332 (the provider this console instruments) graduated to
> `frontierui/tools/mock-server`; the console is a devtool over that server (cli.ts/server.ts already
> live there), so it builds + gates in **frontierui**, not webeverything. The `mock-contract` protocol
> is the WE standard; the console is its FU-side impl surface. A webeverything `/batch` correctly holds
> it out of the pool — work it in the frontierui repo with its own gate + dev server.

# Mock/proxy console surface (latency/fault/conditional overrides)

Build the console surface over the self-run mock/proxy dev-server: a config editor plus a live call monitor exposing latency, fault, and conditional-response overrides, the `mock | proxy | record` response-kind, and per-service toggles. Ships in the free self-run tier (the hosted call-history/broker is the deferred upsell). Ratified in #107 (Fork 2): the console ships with the self-run tier so developers can drive overrides locally without a hosted service. Blocked on the dev-server provider (#332) it instruments.
