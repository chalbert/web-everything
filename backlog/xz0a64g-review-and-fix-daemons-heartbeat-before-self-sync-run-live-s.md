---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/daemon-self-sync.mjs", "we:scripts/lib/main-staleness.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Review and fix daemons: heartbeat before self-sync, run live-smoke checks in parallel, fetch main once per tick

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Findings R1, F1 (batch it). Measured 2026-09-24: review-daemon lease heartbeats 341 s apart (interval 120 s); fix-dispatch mean tick about 232 s. we:scripts/lib/daemon-live-smoke.mjs runLiveSmoke (lines 198-219) runs its checks serially and checkReconcileDryRun (161-174) loops the 3 repos serially, each with a 30-60 s budget; the loop heartbeats only after tickOnce returns. fix-dispatch fetches the same clone up to 4 times per tick (self-sync plus assertMainNotStale per repo, we:scripts/lib/main-staleness.mjs line 160). Fix shape: heartbeat before self-sync and smoke; Promise.all the independent smoke checks and per-repo dry runs; reuse the self-sync fetch for the staleness check. HAND-OFF: we:scripts/lib/daemon-self-sync.mjs and we:scripts/lib/daemon-live-smoke.mjs are owned by the in-flight automatic-rebuild worker, so this card is filed uncleared; clear it once that work lands. Done when: tests prove parallel smoke and a single fetch; LIVE proof: 20 review-daemon heartbeat intervals after deploy, p50 under 180 s, samples in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
