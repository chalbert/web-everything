---
bornAs: xzryier
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/host-sampler-episodes.mjs", "we:scripts/readiness/heavy-admission.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Host sampler: admission_wait_s is almost never recorded, so the heavy-pool wait signal is missing

Audit 2026-09-23 of the live sampler data (workspace .operations/telemetry, 2026-09-20 to 2026-09-23): admission_wait_s is set on 2 of 927 heavy.run.episode records (0 of 267 on 2026-09-23). Cause, read in we:scripts/operations/host-sampler-episodes.mjs stepEpisodes: waitS is computed only when the holder pid was already present in an EARLIER sample's waiters map, so any wait shorter than one sample interval (30 s normal, 5 s burst) is never seen, and the value is fixed at the first sample and never back-filled. Card #3808 (capacity-review) and #3737 treat this field as an existing knee signal, so both rest on missing data. Fix: record the wait at acquire time inside we:scripts/readiness/heavy-admission.mjs (requestedAt to acquiredAt, stored in the slot meta the tryAcquireSlot meta param already accepts) and have the sampler read it from the holder, not infer it. Lives on the prototype branch (lane/mechanical-dispatcher, graduation #3899). Done when: a heavy run that waited any time, even under one interval, gets a non-null admission_wait_s, and a run that did not wait gets 0, proved by a unit test on stepEpisodes plus one live check on the laptop sampler.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
