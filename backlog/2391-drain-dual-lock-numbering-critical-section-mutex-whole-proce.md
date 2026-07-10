---
kind: story
size: 5
parent: "2387"
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
tags: []
---

# Drain dual-lock: numbering-critical-section mutex + whole-process drain lease

Two locks for the drain. (1) A TTL-bounded numbering-critical-section mutex wrapping the number+publish step at every land call site (we:scripts/lane-drain.mjs finalizeLand, we:scripts/merge-ai-prs.mjs land, we:scripts/pr-land.mjs) so at most one drain assigns an NNN — enforcing the sole-serial-writer invariant (#2288/#2290), with a crashed holder expiring by TTL. (2) A distinct whole-process drain lease (O_EXCL create + TTL heartbeat) held for a drain full lifetime, for push-at-close to check. Fixes a latent concurrent-numbering race that exists today. Tests: concurrent lands serialize with no duplicate NNN; a second drain launch no-ops on a held lease; a stale lease is reclaimable.
