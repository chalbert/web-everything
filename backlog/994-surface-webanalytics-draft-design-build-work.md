---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1003-implement-web-analytics-customtracker-contract-reference-ada.md
tags: []
---

# Surface webanalytics (draft) design + build work

webanalytics is status:draft with a spec page (analytics-vocabulary protocol) but only passing backlog mentions, no owning item. Review the draft, confirm direction, and surface its design/build work as tracked items.

## Outcome (batch-2026-06-18)

Reviewed the spec (`we:src/_includes/project-webanalytics.njk`), the `analytics-vocabulary` protocol
(`we:src/_data/protocols.json`), and `we:src/_data/analytics.json`. **Direction confirmed — settled, not
a design fork.** The vocabulary is fixed to the Segment Spec and the `CustomTracker`/`AnalyticsBackend`
contract is already documented; the spec's §status names the *adapter ecosystem* as the next deliverable.
So there's no decision to make — only build. Confirmed zero impl under `plugs/`/`blocks/`.

Surfaced one item:
- **#1003** (build epic) — canonicalize the `CustomTracker` contract (incl. the `group()` B2B method
  that `we:src/_data/analytics.json` has but the spec table omits) as `@webeverything` types, then build FUI
  injector-resolved reference adapters (Segment/Mixpanel/GA4/self-hosted), composition seams (traces /
  events), and a swap-the-backend conformance demo.

No design item created (nothing to ratify); the only contract wrinkle (`group()`) is a trivial
canonicalization folded into #1003's first slice, not a fork.
