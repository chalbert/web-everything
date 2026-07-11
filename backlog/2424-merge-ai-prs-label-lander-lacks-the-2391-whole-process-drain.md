---
bornAs: x50f3ih
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
tags: []
---

# merge-ai-prs label lander lacks the #2391 whole-process drain lease — two watch drains ran concurrently

#2391 landed its whole-process drain lease only in legacy we:scripts/lane-drain.mjs; we:scripts/merge-ai-prs.mjs (the primary /drain //merge label lander) got only the numbering mutex. Observed 2026-07-10 16:34/16:35: two --watch label landers (sessions drain-0710a in lane-1 and drain-2026-07-10-377048e4 in lane-6, same --label=ready-to-merge) ran concurrently with no warning, doubling rebase-drop churn (#398 rebuilt on two passes) — the livelock signature the drain SKILL documents. Fix: wrap the pass/watch lifecycle in we:scripts/merge-ai-prs.mjs with acquireDrainLease/heartbeatDrainLease/releaseDrainLease from we:scripts/readiness/drain-lock.mjs (acquire at start, heartbeat each pass, release at exit); a second launch no-ops surfacing the holder; a stale lease reclaims by TTL — the contract we:scripts/lane-drain.mjs already has. Cheap belt: acquire --purpose=drain in we:scripts/lane-pool.mjs warns when another live drain-purpose lease exists. Tests: second lander no-ops on a held lease; crashed holder reclaimed; bare one-shot pass releases.
