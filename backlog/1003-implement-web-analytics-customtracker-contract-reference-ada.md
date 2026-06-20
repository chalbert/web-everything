---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webanalytics/CustomTrackerRegistry.ts"
relatedProject: webanalytics
tags: [webanalytics, build]
---

# Implement Web Analytics — CustomTracker contract + reference adapter ecosystem

Surfaced by #994. webanalytics is `status:draft` with a settled design — the spec
(`we:src/_includes/project-webanalytics.njk`) fixes the vocabulary to the Segment Spec, the
`analytics-vocabulary` protocol is registered (`we:src/_data/protocols.json`,
`ownedByProject: webanalytics`), and `we:src/_data/analytics.json` documents the `CustomTracker` /
`CustomAnalyticsEvent` shapes. The spec's own §status says: "the vocabulary is fixed; the adapter
ecosystem is the next deliverable." So **no design decision is outstanding** — this is a pure build.
Confirmed zero impl (no `analytics` contract/adapter under `plugs/` or `blocks/`).

**Umbrella — sliced 2026-06-18 (`/slice 1003`, partial split).** Decomposed into three batchable
slices that carry webanalytics to graduation, with the composition seam deferred behind its unbuilt
dependencies (see `we:reports/2026-06-18-backlog-split-analysis.md`):

- **#1012** (`story·3`, webeverything) — canonical `CustomTracker` contract + `CustomTrackerRegistry`
  + DI wiring + no-op default + conformance vector (foundational).
- **#1013** (`story·3`, frontierui) — reference vendor adapters (Segment/Mixpanel/GA4); `blockedBy #1012`.
- **#1014** (`story·3`, webeverything) — conformance demo (swap the resolved backend, recording stubs);
  `blockedBy #1012`. Independent of #1013.
- **Deferred — composition seams (Web Traces / Web Events).** Could-not-split: `webtraces`/`webevents`
  are spec-only njk with no `plugs/` runtime impl to correlate trace-IDs against or subscribe to. Land
  those plug impls first, then re-slice (or file as a `blockedBy` follow-up). Off the graduation gate.

Anticipated slices (original decomposition, now superseded by the slices above):

- **Canonicalize the contract shape (first, tiny).** The spec's `AnalyticsBackend` interface lists
  `identify`/`track`/`page`; the `we:src/_data/analytics.json` `CustomTracker` adds `group(groupId, traits?)` for B2B
  account grouping. These should be one canonical contract — `group()` is the superset (the spec table
  just omitted it). Land a single `CustomTracker` contract surface (`@webeverything` type-only) covering
  identify/track/page/group + `CustomAnalyticsOptions` (integrations toggle, timestamp).
- **Reference adapters (FUI impl).** Injector-resolved `AnalyticsBackend`/`CustomTracker` implementations:
  Segment (verbatim), Mixpanel, GA4, and a self-hosted/no-op default. Components resolve the backend
  through the injector chain — never import a vendor SDK directly.
- **Composition seams.** Trace-ID correlation with Web Traces; optional Web Events subscription so
  adapters can instrument off typed events instead of sprinkled `track()` calls.
- **Conformance demo.** A real-browser demo: one call site, swap the resolved backend, assert the same
  events route to each adapter.

Per WE=contracts: the `CustomTracker` contract types → `@webeverything`; the vendor adapters (impl) →
FUI. Graduates webanalytics `draft → poc/active` once a reference adapter ships.
