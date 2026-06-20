---
kind: story
size: 3
parent: "192"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Research-freshness foundation schema + badge scaffold

Slice A of the research-freshness ruling (#441). Add lastReviewed + reviewHorizon + the revision-chain fields (supersedes/supersededBy and a superseded status value) to the we:researchTopics.json registry schema. Render current+history and a freshness-badge scaffold on /research/ (we:src/research.njk, we:src/research-topic-pages.njk). Foundation only — staleness derivation (#477) and supersedes-as-new-report flow (#478) build on this. Keep three distinct dates: dateOpened, last-changed, lastReviewed. Unblocks epic #192 slices.

## Progress

Foundation schema + scaffold delivered (2026-06-13):

- **Schema/validator** ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs)) — added `superseded` to `RESEARCH_STATUSES`; a global `RESEARCH_REVIEW_HORIZON_DEFAULT = 'P6M'` fallback; and a foundation validation block that checks `lastReviewed` is an ISO date, `reviewHorizon` an ISO-8601 duration, and that `supersedes`/`supersededBy` resolve to known topic ids with a bidirectional-pointer + `superseded`-status warning. Staleness *derivation* against the horizon is deliberately left to #477.
- **Render** — new shared macro [we:src/_includes/research-freshness.njk](../src/_includes/research-freshness.njk) exporting `freshnessBadge(topic)` (review-state badge with `data-freshness` / `data-last-reviewed` / `data-review-horizon` hooks for #477 to compute fresh/stale) and `revisionHistory(topic, researchTopics)` (bidirectional supersedes/supersededBy chain). Wired into the `/research/` card grid ([we:src/research.njk](../src/research.njk)) and the topic detail page ([we:src/research-topic-pages.njk](../src/research-topic-pages.njk), which now surfaces Opened / Last reviewed / Review horizon + the badge + a revision-history card).
- **Seed exemplar** — stamped `lastReviewed: 2026-06-12` + `reviewHorizon: P6M` on the `research-freshness-model` topic so the badge has live data; other topics render "Not reviewed" gracefully.
- **Verified** — `check:standards` 0 errors; live :8080 renders `data-freshness="reviewed"` + `data-last-reviewed="2026-06-12"` on both the card grid and topic page.

Three distinct dates kept separate (dateOpened ≠ last-changed ≠ lastReviewed). Follow-ons #477 (staleness derivation + warn-only rule) and #478 (refresh-as-new-report + supersedes render) already scaffolded; both build on these hooks.
