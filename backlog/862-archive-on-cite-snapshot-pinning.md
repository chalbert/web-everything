---
type: idea
workItem: story
size: 3
parent: "583"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "scripts/pin-reference-snapshots.mjs + src/_data/referenceSnapshots.json (npm run pin:references — archive-on-cite drift baselines, wired into the #585 sweep)"
tags: []
---

# Archive-on-cite snapshot pinning

On citing an external reference, pin an archived snapshot so a later 404/move degrades gracefully (dogfood Layer 1). Unblocked build against the resolved #584 convention + #597 registry substrate.

## Progress

- **Resolved 2026-06-17.** Built `scripts/pin-reference-snapshots.mjs` (`npm run pin:references`): for
  each #597-indexed URL it pins a snapshot into `src/_data/referenceSnapshots.json` — a
  whitespace-insensitive content **hash** (the drift baseline) + the closest **Wayback** archive URL
  (the graceful-degradation fallback). The store is a committed, **immutable** baseline; pinning is
  idempotent (an existing pin is never re-probed or moved unless `--repin=<url>`), with `--limit`/`--home`
  to bound a run.
- **Closed the drift loop:** wired the #585 sweep to auto-load these hashes as `baselines` and to
  read+hash a page body **only** when a baseline exists for it (no wasted bandwidth otherwise) — so
  `content-drift` is now real detection, not inference. Verified end-to-end: pinned 4 corpus sources
  (all with archive fallback), then a sweep reported `4 drift baseline(s)` and compared them.
- **Tested:** `hashBody`, `parseArchiveResponse`, and the idempotent `pinReferences` merge are pure —
  10-case offline suite (`scripts/__tests__/pin-reference-snapshots.test.mjs`, green) with the most
  weight on idempotence (an existing pin must not move) + `--repin`/`--limit`/failure paths; the sweep's
  26-case suite still green after the probe change. Documented in `docs/agent/reference-retirement.md`
  (§ "Archive-on-cite").
