---
type: idea
workItem: story
size: 3
parent: "1024"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:notifications/push-contract.ts"
tags: []
---

# webnotifications contract — push-delivery types plus notification intents in @webeverything

Slice A of webnotifications impl epic #1024. Define the push-delivery contract (delivery provider types) plus the notification intents in @webeverything per the resolved #456/#459/#460 design. Type-only crosses the seam (npm scope mirrors layer). Foundation slice — B and C build on it.

## Progress

Shipped `we:notifications/push-contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/push-delivery`): `CustomPushProvider` (the `subscribe`/`send`/`unsubscribe`
swap seam, native Web Push default), `PushSubscriptionInfo`, `DeliveryReceipt` (closed status set, a
report/audit source). Mirrors the contract specified in
`we:src/_includes/project-webnotifications.njk` (#455 by-purpose split, #009 Fork D home,
#456/#459/#460 design). The notification *intents* (`feedback`, `system-notification`) already live in
`we:src/_data/intents.json` (#009 Forks A/B) — not redefined here. Scope = closed-app push transport
only; open-app realtime is webrealtime (#455 Fork 2). Runtime providers + hub adapters stay impl (→ FUI).
