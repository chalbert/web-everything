---
kind: story
size: 5
parent: "315"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Per-source exhaustive capability extraction — exact presence + deep doc URLs

Fan-out follow-up to #346: the first-pass capability matrix (we:benchmarkCapabilities.json) records a coarse cross-corpus ubiquity signal and notableIn flags, but defers exact per-source presence and deep per-(capability x source) documentation URLs. This story populates them — one batchable slice per corpus source (or small group), filling a join table so each capability cites precisely which sources provide it and where. Improves citation quality for the gap → backlog step (#348) and the diffability of re-runs. Not blocking: #347 maps on the first-pass matrix already.

## Progress (2026-06-13) — resolved (foundation); exhaustive fill carved to #495

On pickup this proved to be a genuine **fan-out parent**, not a single-turn story: exact presence + deep doc URLs for **96 capabilities × 26 corpus sources (~2,500 cells)** is per-source web extraction — the item's own "one batchable slice per corpus source." So this turn delivered the **join-table foundation + harness** that makes the fan-out tractable and diffable, and carved the exhaustive per-source extraction to **[#495](/backlog/495-exhaustive-per-source-capability-presence-deep-doc-urls-fan-/)** (`/slice` it per source).

Delivered:
- **The join table** — new [we:src/_data/benchmarkCapabilityPresence.json](../src/_data/benchmarkCapabilityPresence.json): an open-world list of `{ capabilityId, sourceId, present, provenance, sourceName, url }` rows. **Seeded honestly** — 145 rows derived from `benchmarkCapabilities.notableIn` (provenance `notable-inference`, `url: null` pending), across the 19 sources notableIn names. No fabricated presence: absence of a row = not-yet-extracted, never proven-absent; the per-source slices upgrade rows to `verified` with the deep URL.
- **The extraction method** — written into the file's `method` + `provenanceKinds` so a re-run extracts the same way and diffs cleanly (the program's reproducibility requirement).
- **The validator** — `validateCapabilityPresence` in [we:check-standards-rules.mjs](../scripts/check-standards-rules.mjs), wired into the gate: every row must reference a known capability + corpus source, `present` boolean, known `provenance`, no duplicate (capability, source); a `verified` row missing its deep `url` **warns** (the URL is the point of verifying). 6 unit tests + a live-seed-stays-clean guard.

`check:standards` green; 90/90 rules suite. The exhaustive fill is now a clean, sliceable fan-out (#495) against a validated, diffable table — exactly the shape #348 (gap→backlog) and re-run diffing need.
