---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webanalytics/CustomTrackerRegistry.ts"
tags: []
---

# Reconcile fui:plugs/webanalytics UP to WE (contract-anchored) — close #1014 UnknownTrackerError gap

Audit fui:plugs/webanalytics vs contract+vectors, then add UnknownTrackerError + CustomTrackerRegistry to FUI (proven gap #1014), keeping FUI's ga4/mixpanel/segment trackers. Demo: analytics-conformance-demo.

## Progress

Closed the #1014 gap — FUI shipped the ga4/mixpanel/segment trackers but no swap registry. Per the
`@webeverything/contracts/analytics` ruling ("the runtime impl is FUI's"), ported the analytics runtime
into FUI (sibling of the already-FUI `CustomGuardRegistry`):

- `fui:plugs/webanalytics/provider.ts` — the native-first `NoopTracker` (silent no-op floor) + a re-export
  of the WE-owned contract surface via `@webeverything/contracts/analytics` (types stay WE-owned; runtime
  is FUI's). Mirrors `we:analytics/provider.ts` / `fui:blocks/guard/provider.ts`.
- `fui:plugs/webanalytics/CustomTrackerRegistry.ts` — the `customTrackers` `CustomRegistry<CustomTracker>`
  + `UnknownTrackerError` + `createDefaultTrackerRegistry`, injector-chain-resolvable, with the four
  Segment routing helpers. Throws `UnknownTrackerError` rather than silently substituting (the #1014 gap).
- `fui:plugs/webanalytics/index.ts` — exports the registry/error/factory/NoopTracker + contract types;
  doc updated (registry now FUI's, WE copy retires under #449). FUI's ga4/mixpanel/segment trackers kept.
- Ported the registry unit test (`__tests__/CustomTrackerRegistry.test.ts`, NoopTracker import repointed
  to `./provider`). FUI webanalytics tests green (21). This connects to #1303's `customTrackers` slot in
  `InjectorRoot.ProviderTypeMap`.

FUI `check:standards` red only on the 2 pre-existing notification/signature-pad catalog errors (unrelated,
stepped over).
