---
kind: story
size: 3
parent: "1003"
locus: frontierui
status: resolved
blockedBy: ["1012"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webanalytics/index.ts"
tags: []
---

# webanalytics: reference vendor adapters (Segment/Mixpanel/GA4) — FUI impl

Slice B of #1003 (locus: frontierui). AnalyticsBackend/CustomTracker impls resolving through the injector chain: Segment (near-verbatim — the contract is the Segment analytics SDK shape), Mixpanel, GA4. Each maps identify/track/page/group onto the vendor SDK; vendor SDKs are optional peer/dev deps (the #935 XState-adapter pattern). Per WE=contracts the vendor wrappers are impl, home is FUI; only the contract crosses the seam, components never import a vendor SDK directly.

## Resolution (batch-2026-06-19)

Built in `fui:plugs/webanalytics/` (the analytics runtime home, mirroring WE `we:plugs/webanalytics/`; a plug not a `blocks/` family, since trackers are headless — no element, so no demo obligation):

- `fui:plugs/webanalytics/segment.ts` — `SegmentTracker`, the near-verbatim 1:1 pass-through (the contract vocabulary IS the Segment Spec, so every method maps positionally with no re-ordering).
- `fui:plugs/webanalytics/mixpanel.ts` — `MixpanelTracker`, idiom mapping (`identify`→`identify`+`people.set`; `page`→a `Page Viewed` event; `group`→`set_group`/`get_group().set`).
- `fui:plugs/webanalytics/ga4.ts` — `GA4Tracker` over `gtag` (`identify`→`set user_id`/`user_properties`; `page`→`page_view` event; `group`→a `user_properties` association).
- `fui:plugs/webanalytics/index.ts` — re-exports the three + their injected-SDK structural types.

Every adapter satisfies `CustomTracker` from `@webeverything/contracts/analytics` (the FUI→WE arrow, the WE-side seam having landed) and drives an **injected** vendor SDK — no `@segment/*` / `mixpanel-browser` / Google import crosses the seam, so FUI stays dependency-free and the SDKs are optional peer/dev deps (the #935 pattern). Added the `@webeverything/contracts/analytics` path-map to `fui:tsconfig.json` + `fui:vite.config.mts` (mirroring `./guard`; vitest needs none — the import is type-only/erased) and the `webanalytics` `fui:src/_data/plugs.json` catalog entry. Covered by `fui:plugs/webanalytics/__tests__/analytics.test.ts` (13 tests, mocked SDKs). FUI `check:standards` green.

> **Blocked-in-fact (batch-2026-06-18 pre-flight).** The vendor adapters are FUI impls of the
> `CustomTracker` contract, but that contract was only just created in WE (#1012) and **does not exist in
> FUI yet** (no `fui:analytics/`, no `fui:plugs/webanalytics/`, no `@webeverything/contracts/analytics`).
> The adapters can't implement a contract FUI lacks. Prerequisite: replicate the #1012 contract into FUI
> (byte-replication interim, like `fui:plugs/webvalidation/`, or the published package — the #700/#872
> distribution seam) BEFORE building Segment/Mixpanel/GA4. Not batchable until then.

> **WE-side seam landed (batch 2026-06-19-parallel-1149).** The `@webeverything/contracts/analytics`
> distribution entry now exists — `we:contracts/analytics.ts` (type-only re-export of `we:analytics/contract.ts`,
> mirroring `we:contracts/guard.ts`) + the `./analytics` subpath in `we:contracts/package.json`. This is the
> FUI→WE arrow the vendor adapters import (`import type { CustomTracker } from '@webeverything/contracts/analytics'`).
> **Still carried, not resolved**: the item's deliverable is the Segment/Mixpanel/GA4 impls, which are
> `locus: frontierui` code that lands in the FUI repo (`fui:blocks/analytics/` or `fui:plugs/webanalytics/`)
> — out of scope for a WE-worktree-only batch. Remaining FUI work when picked up: add the
> `@webeverything/contracts/analytics` tsconfig/vite alias in FUI (sibling `we:contracts/analytics.ts`,
> mirroring the existing `./guard` alias), then author the three adapters (vendor SDKs as optional peer/dev deps,
> the #935 XState-adapter injected-dependency pattern — host supplies the SDK, FUI stays dep-free).
