---
kind: story
size: 3
parent: "1003"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webanalytics/CustomTrackerRegistry.ts"
tags: []
---

# webanalytics: canonical CustomTracker contract + registry + DI + no-op default + conformance vector

Foundational slice of #1003. Following the `we:guard/` precedent: type-only `we:guard/contract.ts`-style contract (CustomTracker/CustomAnalyticsEvent/CustomAnalyticsOptions; identify/track/page/group; page() arg order aligned to the Segment analytics SDK) as the @webeverything/contracts half; CustomTrackerRegistry mirroring `we:plugs/webguards/CustomGuardRegistry.ts` (define/resolve(key?) with a default key); add customTrackers to ProviderTypeMap (`we:plugs/webinjectors/InjectorRoot.ts`); a runtime no-op/self-hosted default provider (native-first floor like `we:guard/provider.ts`) + a conformance vector asserting identify/track/page/group route through the resolved backend. Leaves a demoable state (default + green vector), not a registry with no consumer.

## Progress (batch-2026-06-18)

Shipped the foundational webanalytics seam, mirroring the `we:guard/` precedent:
- `we:analytics/contract.ts` — type-only contract half (`@webeverything/contracts/analytics` candidate):
  `CustomTracker` (identify/track/page/group), `CustomAnalyticsEvent`/`Identity`/`Options`,
  `AnalyticsTraits`/`Properties`. `page` arg order aligned to the Segment SDK (`category, name, …`).
  Encodes the fire-and-forget (non-trust-crossing → no `assert*`) ruling.
- `we:analytics/provider.ts` — runtime half: `NoopTracker` native-first silent default + contract re-export.
- `we:plugs/webanalytics/CustomTrackerRegistry.ts` — runtime plug extending core `CustomRegistry`
  (`define`/`resolve`/`defaultKey` + four Segment routing helpers + `UnknownTrackerError`),
  `createDefaultTrackerRegistry()` pre-loaded with the no-op default.
- `we:plugs/webanalytics/index.ts` — plug entry re-exporting the vocabulary.
- `customTrackers` added to `ProviderTypeMap` (`we:plugs/webinjectors/InjectorRoot.ts`).
- Conformance vector `we:plugs/webanalytics/__tests__/CustomTrackerRegistry.test.ts` (8 tests) +
  unplugged-mode proof `we:plugs/webanalytics/__tests__/unit/webanalytics.unplugged.test.ts` (#606
  dual-mode) — both green: identify/track/page/group route through the resolved backend + Segment page
  arg order + injector-chain `extends`. Leaves a demoable state (default + green vector), not a
  consumerless registry.
