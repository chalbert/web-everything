---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-18"
dateStarted: "2026-07-18"
dateResolved: "2026-07-18"
graduatedTo: "we:src/_data/intents/progress.json (secondaryTrack dimension)"
tags:
  - standards
  - progress
  - ui-primitives
  - console-board
---

# Extend `progress` with an optional secondary/comparison track

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 2). Ratified: **EXTEND** the `progress` intent (`we:src/_data/intents/progress.json`) with an optional **generic secondary/comparison track** — a second fill on the same track, alongside the primary completion fill.

**Native anchor:** `<video>`'s `buffered` vs `currentTime` — the dual-track pattern every media player renders as a lighter "buffered" fill under the played fill. The everyday form is the **YouTube / Netflix scrubber** (light-grey buffered range under the played bar). Other occurrences: download managers (downloaded vs verified), torrent clients (have vs available), CI dashboards (estimated vs actual). A generic secondary/comparison track is therefore a presentation dimension the intent can legitimately own.

**CAVEAT to bake into the contract (do not skip):** keep the app-specific **"claimed-vs-verified" provenance** OUT of the contract. The second track is **generic completion** (a comparison/secondary fill), NOT a trust or data-provenance signal. Claimed-vs-verified is a separate axis — a *binding* an app applies, never a term baked into WE. Extend the generic secondary track; do not re-type `progress` into a provenance intent.

Do **not** unify bar+gauge under one "render dimension" — that re-opens the ratified `progress ≠ meter ≠ status` typing (`we:docs/agent/platform-decisions.md#readout-placement-by-value-type`, #1469/#1410). This is a dimension *on* `progress`, not a new family intent.

**Acceptance:** `we:src/_data/intents/progress.json` gains an optional secondary/comparison-track dimension; the contract states the native `<video>` `buffered`-vs-`currentTime` anchor and explicitly scopes the track to generic completion (provenance kept out); no re-typing of `progress`/`meter`; the definition passes `check:standards`.
