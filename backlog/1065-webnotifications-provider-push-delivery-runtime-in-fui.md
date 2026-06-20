---
kind: story
size: 5
parent: "1024"
status: resolved
blockedBy: ["1064"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webnotifications/index.ts"
tags: []
---

# webnotifications provider — push-delivery runtime in FUI

Slice B of webnotifications impl epic #1024 (blockedBy slice A contract). Implement the push-delivery provider runtime in FUI over the platform Push/Notifications API (native-first), conforming to the WE contract; swappable provider.

## Resolution (batch-2026-06-19)

Built in `fui:plugs/webnotifications/` (headless runtime → plug):

- `fui:plugs/webnotifications/provider.ts` — `NativeWebPushProvider`, native Web Push over the platform `PushManager` (injected): `subscribe`/`unsubscribe` drive the Push API; `send` records a `queued` receipt (the actual VAPID-signed delivery is the producer's server — a browser can't push to itself). Plus `assertDeliveryReceipt` (trust-boundary check) + `PushUnavailableError`.
- `fui:plugs/webnotifications/registry.ts` — `CustomPushRegistry`, the by-id swap point (native `web-push` default; FCM/OneSignal/Novu hubs plug in), `resolve` + a seam-validated `send`.
- `fui:plugs/webnotifications/index.ts` — `createDefaultPushRegistry()` seeding the native provider.

Conforms to `@webeverything/contracts/push-delivery` (FUI→WE arrow). Added the WE distribution seam (`we:contracts/push-delivery.ts` re-export of `we:notifications/push-contract.ts` + `./push-delivery` subpath) + the FUI `fui:tsconfig.json`/`fui:vite.config.mts` path-maps + the `webnotifications` `fui:src/_data/plugs.json` entry. Covered by `fui:plugs/webnotifications/__tests__/webnotifications.test.ts` (9 tests). FUI `check:standards` green.
