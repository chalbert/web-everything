---
bornAs: xg6y7we
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-12"
tags: []
---

# Heartbeat the whole-process drain lease during a long sweep, not just per watch pass

PR #441 review finding (accepted with follow-up): a leased one-shot sweep never heartbeats — heartbeatDrainLease only runs at the top of each watch pass — so a full sweep running past the 15-min lease TTL goes stale mid-run and a concurrent drain reclaims it, re-opening the #2424 double-drain window for >15-min sweeps. Fix: heartbeat inside sweepOnce (e.g. per couple landed) so a live sweep keeps its lease fresh; unit-test the heartbeat call sites.
