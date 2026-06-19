---
type: idea
workItem: story
size: 3
parent: "1003"
locus: frontierui
status: open
blockedBy: ["1012"]
dateOpened: "2026-06-19"
tags: []
---

# webanalytics: reference vendor adapters (Segment/Mixpanel/GA4) — FUI impl

Slice B of #1003 (locus: frontierui). AnalyticsBackend/CustomTracker impls resolving through the injector chain: Segment (near-verbatim — the contract is the Segment analytics SDK shape), Mixpanel, GA4. Each maps identify/track/page/group onto the vendor SDK; vendor SDKs are optional peer/dev deps (the #935 XState-adapter pattern). Per WE=contracts the vendor wrappers are impl, home is FUI; only the contract crosses the seam, components never import a vendor SDK directly.

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
