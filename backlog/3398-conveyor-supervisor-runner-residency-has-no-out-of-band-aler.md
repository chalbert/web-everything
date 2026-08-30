---
bornAs: xetlhb5
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-08-30"
tags: []
---

# Conveyor supervisor/runner residency has no out-of-band alerting — only a JSONL log nobody watches

we:skills-src/conveyor/supervisor.mjs writes its restart/backoff/exit history to a JSONL log plus stderr and nothing else — no OS-level notification when it crash-loops to its backoff ceiling, and no signal when the runner sits idle with a non-empty queue for an extended stretch. The sibling drain daemon got exactly this treatment (#2489 health/anomaly detection, #2493 out-of-console launchd alert, both resolved 2026-07-14) after being flagged as a mirror rather than a smoke detector. Nothing extends that precedent to the newer conveyor supervisor, so an unattended, crashed, or silently-stalled dispatcher is invisible until someone thinks to tail its log.

**Landing-order note:** we:skills-src/conveyor/supervisor.mjs does not exist on `main` yet — it lives only on `origin/lane/mechanical-dispatcher`. Check #3383's own "what's still not done" list for that branch's current landing status before designing against this file; its shape may shift before it merges.

## Done when

1. A design is recorded for what "stuck" means for this process (crash-loop past its backoff ceiling; the runner idle with a non-empty queue past some threshold) and how a human is told, out-of-band — a macOS notification the way #2493 did for the drain daemon, or an equivalent that fits this process not yet being installed to launchd.
2. The detection logic, once built, is a pure function over the supervisor's own JSONL history (mirroring `detectAnomalies` in the drain-daemon precedent) — unit-tested against fixtures, not against a real crash-looping process.
