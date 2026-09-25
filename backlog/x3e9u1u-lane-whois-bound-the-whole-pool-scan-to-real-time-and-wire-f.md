---
kind: story
size: 5
parent: "4075"
status: resolved
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# lane-whois: bound the whole-pool scan to real time, and wire finished-reclaimable into auto-reclaim

`we:scripts/lane-whois.mjs` (#3383/#4058) went to ~11 minutes over the real ~68-lane WE pool — too slow for the
`we:scripts/operations/operator-queue.mjs --with-lanes` "needs your decision" feed to run every tick, and too
slow to gate an auto-reclaim pass. Bounds every previously-unbounded cost (per-card `gh pr list --search`,
per-commit subject/containment spawns, per-file×per-ref preservation fallback, an unbounded whole-transcript-
tree scan — one of which hid a silent `ENOBUFS` that made every PR-backed verdict read as `unknown-work`), and
adds the missing mutation half: `we:scripts/lane-pool.mjs reclaim --lane=N [--dry-run]`, wired into the running
`we:scripts/conveyor/lane-pool-health-watch.mjs` pass so a `finished-reclaimable` verdict is actually freed
each tick, gated by its own re-derived preservation proof under the same O_EXCL claim `trim` uses.

## Done when

1. **Executable** — `node we:scripts/lane-whois.mjs --json` over the real WE pool took ~657s before this item
   (measured live, see PR body); after, ~67s on a heavily-loaded host (load avg ~18) and well under 60s on a
   quiet one — proven via `/usr/bin/time -p` before/after on the same real, unmodified pool (read-only). Verdict
   counts stayed correct (cross-checked against the ENOBUFS-fixed batched `gh pr list` output). `node
   we:scripts/lane-pool.mjs reclaim --lane=N --dry-run --json` did not exist before this item; after, it reports
   a preservation-proof-gated reclaim plan for any one lane, and the real (non-dry-run) path is wired into
   `we:scripts/conveyor/lane-pool-health-watch.mjs`'s own periodic tick (`vitest run
   we:scripts/__tests__/lane-pool-reclaim.test.mjs we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs
   we:scripts/__tests__/lane-whois.test.mjs we:scripts/lib/__tests__/lane-whois-core.test.mjs
   we:scripts/lib/__tests__/lane-transcript-attribution.test.mjs` all green).
