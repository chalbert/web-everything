---
bornAs: xx2zvaz
kind: story
size: 2
status: open
dateOpened: "2026-07-12"
tags: []
---

# Heartbeat the whole-process drain lease on one-shot sweeps in merge-ai-prs

The #2449 always-on whole-process lease in we:scripts/merge-ai-prs.mjs heartbeats only inside the watch loop; a ONE-SHOT full/label sweep holds the lease for its whole run but never heartbeats it, so a sweep that outlives the lease TTL (a deep multi-repo blockedBy cascade) reads STALE and a second full drain reclaims it mid-run — the exact #2424 double-drain the lease exists to prevent. Fix: heartbeat during the one-shot sweep too (per-PR-landed or on a timer), keeping the existing release-on-every-exit contract. Surfaced by the PR #444 human review (findings applied to #441's landed code).
