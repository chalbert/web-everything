---
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, drain-daemon, observability]
---

# Emit per-PR head SHA in the merge sweep, then add the head-SHA churn signal to the stuck detector (#2487 follow-on)

#2487 shipped the no-merge-progress stuck signal but DEFERRED the "head SHA churned > K times" variant because the per-PR head SHA is never emitted by the drain. An investigation found the sweep already fetches each PR's tip commit `oid` (via `gh pr view --json commits`, for the AI-authorship gate) but does NOT thread it into the emitted result JSON — so the detector has no way to tell a PR whose tip keeps getting force-pushed (a lane thrashing) from one that is simply waiting.

Two parts:

1. **WE — emit the head SHA.** In [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), each considered PR already has its per-PR `commits` attached (`p.commits`, fetched at ~L1289 via `gh pr view … --json commits`). Add the tip `oid` (`p.commits[p.commits.length - 1]?.oid`) onto each considered-PR entry in the emitted `result` buckets (`toMerge`/`merged`/`skipped`/`parked`/`deferred`/`failed`). Cheap — no new `gh` call, the data is already in hand. NOTE: [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) is the TRUST_CHAIN lander (engine tier), so the change ESCALATES and needs an independent review panel before it lands — expected, not a blocker.
2. **plateau-app — thread it + detect churn.** Thread the new field through `parsePassResult` (plateau:tools/drain-daemon/lib.mjs) into the persisted journal entry (alongside `consideredPrs`/`mergedPrs`), then add the head-SHA churn signal to the stuck detector (plateau:tools/drain-daemon/lib.mjs `deriveIncidents` / `detectAnomalies` — pure-lib, unit-tested): a PR whose emitted head SHA changes more than K times across the recent pass window is a distinct "lane thrashing / not converging" incident, complementary to the existing no-merge-progress stall.

Impl spans WE (sweep output) + plateau-app (journal + detector). Relates to #2487.
