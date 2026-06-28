---
kind: story
size: 3
parent: "1294"
status: resolved
locus: frontierui
graduatedTo: "fui:plugs/webanalytics/provider.ts"
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: [webanalytics, relocation, constellation-placement]
---

# Relocate the analytics runtime (provider) to FUI

Slice 1 of the analytics relocation cascade (#1294). Move the executable analytics runtime — provider from we:analytics/provider.ts — out of WE per #1282 to fui:analytics/, importing the contract via @webeverything/contracts/analytics (we:analytics/contract.ts stays in WE). Register the fui:analytics alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.

## Progress

- **Status:** resolved
- **Branch:** main
- **Done:**
  - WE: `we:contracts/analytics.ts` (the type-only re-export of `we:analytics/contract.ts`) already exists and `./analytics` is already in `we:contracts/package.json` exports — the published FUI→WE arrow (#872) was in place, so no WE source change was needed beyond this status splice.
  - FUI: the analytics runtime impl already lives in FUI at `fui:plugs/webanalytics/provider.ts` (the native-first `NoopTracker` default), ported earlier under #1297/#1014 alongside the swap registry (`CustomTrackerRegistry`), the reference vendor adapters (segment/mixpanel/ga4, #1013) and the conformance tests. It imports the contract via `@webeverything/contracts/analytics` (not a local contract) — the W1 deliverable shape, just at the existing `plugs/webanalytics/` home rather than a fresh `fui:analytics/` dir (intl #1914 needed a new dir; analytics already had a FUI home).
  - FUI alias `@webeverything/contracts/analytics` → WE `we:analytics/contract.ts` was already registered in `fui:vite.config.mts` + `fui:tsconfig.json`; the missing third registration — `fui:vitest.config.ts` — is added here (mirrors the intl/webpolicy entries, the #804-2a vitest half) so the relocated runtime + its tests resolve the contract from the sibling WE source under vitest, not via incidental node resolution of the on-disk package.
- **Next:** all done — FUI vitest green (webanalytics 30/30 + intl 12/12, 47 with neighbors). The WE `we:analytics/provider.ts` runtime + the `we:demos/analytics-conformance-demo.ts` stay in place (deleted in #1924, the W4 delete slice) so each slice ships independently — the W1/W4 split (mirrors #1799→#1802 for webpolicy).
- **Notes:** Per the W1/W4 split, W1 *establishes* the FUI runtime + the published contract arrow and does NOT delete the WE runtime; that is #1924's job. Found at resolve time that the FUI runtime + two of the three config registrations pre-existed (#1297/#1014), so the live gap this slice actually closed was the `fui:vitest.config.ts` alias.
