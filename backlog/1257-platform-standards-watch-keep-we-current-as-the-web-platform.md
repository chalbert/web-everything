---
kind: epic
ongoing: true
relatedReport: reports/2026-06-20-program-platform-standards-watch.md
status: open
dateOpened: "2026-06-20"
tags: []
---

# Platform-standards watch

A front-B currency program (with a front-A conformance arm) that keeps Web Everything aligned to the moving web platform. Front A: every WE standard with a native equivalent defers to it — native-first (#031) as a living check, not a snapshot. Front B: when a new native capability ships (TC39/WHATWG/W3C, with Baseline and a11y/APG as lenses), evaluate impact on WE — adopt and repoint, demote a redundant polyfill to opt-in, or flag an obsoleted/enabled intent. Currently L0: the metric, sweep, and cadence are not yet built. Keystone of the evergreen vision (#099 consumes its output).

## The two fronts

- **Front A — conformance (internal):** every WE standard that has a native platform equivalent defers to it. This is the native-first floor (#031) made a *living* check instead of a one-time assertion. Metric (to build): count of WE standards with a native equivalent that do **not** yet repoint to it.
- **Front B — currency (external):** a new native capability shipped. Discovery (to build): a sweep over spec trackers (TC39 / WHATWG / W3C), **Baseline** advancement data, and **a11y/APG** updates — three lenses on one engine — that files items when the platform moves. Each hit is triaged: adopt & repoint · demote a now-redundant polyfill to opt-in · flag an intent/block the platform just obsoleted or just enabled.

## Maturity & status — currently L0

Per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/) this is a genuine two-front program, but at **L0 / aspirational**: the goal and discovery story exist; the metric, sweep, and cadence are not built. L0→L1 carve (near-term slices):

1. Define the front-A metric and wire it into the standards gate.
2. Build the front-B discovery sweep (specs + Baseline + APG lenses), runnable by hand.
3. Wire the cadence/trigger; graduate L1→L2 (scheduled) only after a manual track record (the #315→#367 pattern).

## Why it's the keystone

native-first is WE's defining stance and is meaningless without this watch — without front B it is a snapshot, not a living position. It is also the **fuel for the evergreen app** ([#099](/backlog/099-evergreen-app-vision/)): #099's front B is "consume this watch's output and adopt it." Sibling watches in the currency portfolio: gap-sweep (#315, design-system landscape) and reference-liveness (#192, web decay).

## Review log

- **2026-06-20 — first run (L0→L1).** Swept lenses: specs+Baseline, a11y/APG, TC39/JS. Front-B delta: 7 native capabilities crossed availability thresholds since "always" (first run catches the accumulated backlog; future runs are idempotent). Filed 9 slices — #1261 popover · #1262 anchor positioning · #1263 invoker commands · #1264 view transitions · #1265 scroll-driven animations · #1266 APG combobox · #1267 front-A metric · #1268 ES built-ins audit · #1269 Signals watch — and flagged parked #291 (base-select) for re-evaluation (trigger now near). Front-A metric not yet built (carved as #1267). Temporal/Decorators tracked, not filed (pre-Stage-4). Report: `we:reports/2026-06-20-program-platform-standards-watch.md`. **Next run:** re-sweep deltas since 2026-06-20 (idempotent); revisit Temporal/Decorators as they near Stage 4.
