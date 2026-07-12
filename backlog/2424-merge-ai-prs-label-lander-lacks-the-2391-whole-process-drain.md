---
bornAs: x50f3ih
kind: story
size: 3
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-12"
dateResolved: "2026-07-12"
tags: []
---

# merge-ai-prs label lander lacks the #2391 whole-process drain lease — two watch drains ran concurrently

#2391 landed its whole-process drain lease only in legacy we:scripts/lane-drain.mjs; we:scripts/merge-ai-prs.mjs (the primary /drain //merge label lander) got only the numbering mutex. Observed 2026-07-10 16:34/16:35: two --watch label landers (sessions drain-0710a in lane-1 and drain-2026-07-10-377048e4 in lane-6, same --label=ready-to-merge) ran concurrently with no warning, doubling rebase-drop churn (#398 rebuilt on two passes) — the livelock signature the drain SKILL documents. Fix: wrap the pass/watch lifecycle in we:scripts/merge-ai-prs.mjs with acquireDrainLease/heartbeatDrainLease/releaseDrainLease from we:scripts/readiness/drain-lock.mjs (acquire at start, heartbeat each pass, release at exit); a second launch no-ops surfacing the holder; a stale lease reclaims by TTL — the contract we:scripts/lane-drain.mjs already has. Cheap belt: acquire --purpose=drain in we:scripts/lane-pool.mjs warns when another live drain-purpose lease exists. Tests: second lander no-ops on a held lease; crashed holder reclaimed; bare one-shot pass releases.

## Resolution (2026-07-12, absorbed by #2449)

Delivered as part of the phase-1 resident drain daemon story: the whole-process lease is now
ALWAYS-ON in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) for every full/label sweep and
watch (`decideDrainLeaseGate`, acquired for the run's full lifetime, heartbeated each watch pass,
released on every exit path). A second lander no-ops exit 0 surfacing the holder; a stale lease
reclaims by TTL; `--only` fast drains bypass (the numbering mutex suffices — `/pr`/`/finish` stay
instant). Unit-tested in
[we:scripts/__tests__/merge-ai-prs.test.mjs](scripts/__tests__/merge-ai-prs.test.mjs) and verified
live (concurrent full drain against a held lease → deterministic no-op surfacing the holder).
