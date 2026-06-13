---
type: issue
workItem: story
size: 2
parent: "192"
status: resolved
blockedBy: ["476"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Research-freshness staleness derivation + warn-only check + reader badge

Slice B of the research-freshness ruling (#441), blocked by #476. Derive stale state from lastReviewed + reviewHorizon with the RFC 5861 grace band (stale-while-shown: past the horizon a topic is flagged for re-review, not hidden). Add a warn-only check:standards rule beside the registry checks (scripts/check-standards.mjs ~L156) — never a CI error. Surface the reader-facing freshness badge on the /research/ card grid and topic pages. Global reviewHorizon fallback applies when a topic declares none.

## Progress (2026-06-13) — resolved

- **One shared derivation** — [scripts/lib/research-freshness.cjs](../scripts/lib/research-freshness.cjs): pure, `now`-injected `deriveResearchFreshness(topic)` → `{ state: 'fresh'|'stale'|'unreviewed', dueDate, horizon, lastReviewed }` + a calendar-correct `addIsoDuration` (Y/M/W/D, via `setUTCMonth`/`Year` so `P6M` lands the same day-of-month). RFC 5861 grace band: past `lastReviewed + horizon` ⇒ `stale` (flagged, never hidden); boundary day counts as still-fresh. **Authored as CJS** because Eleventy 2.0.1 rejects an async config — so the sync config can `require` it directly, while the ESM rules module re-exports its bindings (one source, two module systems). `RESEARCH_REVIEW_HORIZON_DEFAULT = 'P6M'` now lives here, imported by check-standards.mjs (removed its duplicate const).
- **Warn-only gate rule** — [scripts/check-standards.mjs](../scripts/check-standards.mjs): inside the existing research-freshness block, a `stale` topic emits a `warn(...)` ("re-review and bump lastReviewed") — **never `err`**, per the ruling. The seeded `research-freshness-model` topic is fresh (due 2026-12-12), so the live gate stays quiet.
- **Reader badge** — [src/_includes/research-freshness.njk](../src/_includes/research-freshness.njk) now derives via a new `researchFreshness` Eleventy filter ([.eleventy.js](../.eleventy.js)) and styles three states: green *Reviewed*, amber *Review due* (warning-triangle icon), muted *Not reviewed*; exposes `data-freshness` / `data-review-due` hooks. Verified by an isolated Eleventy build: card grid + topic page render `data-freshness="fresh"` with title "next review due 2026-12-12"; unreviewed topics degrade gracefully.
- **Tests** — 6 new cases in [scripts/__tests__/check-standards-rules.test.mjs](../scripts/__tests__/check-standards-rules.test.mjs) (fresh/stale boundary, P6M fallback, W/D/Y durations, malformed-duration null). Gate green (0 errors); full rules suite 84/84.
