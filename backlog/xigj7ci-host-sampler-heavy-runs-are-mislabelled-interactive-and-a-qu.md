---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/host-sampler-attribution.mjs", "we:scripts/operations/host-sampler-episodes.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Host sampler: heavy runs are mislabelled interactive and a quarter to two thirds have no lane

Audit 2026-09-23: on 2026-09-23 all 240 heavy.run.episode records that carry a worker kind say interactive, including runs from the drain daemon's session (session Daemon), and 71 of 267 have lane unattributed even when admission_holder names the lane (for example slot-0:lane-11 with lane unattributed). Unattributed share was 170 of 307 on 2026-09-21 and 234 of 354 on 2026-09-22. The lane-load model and any per-kind cost (the dispatch weights of #3806 and #3800) are skewed by this. Fix: when the process cwd gives no lane, fall back to the admission holder's lane; classify the worker kind from the dispatch environment (WE_DISPATCH_KIND) or the runner roster before defaulting to interactive; give daemon sessions their own kind instead of interactive. Lives on the prototype branch (graduation #3899). Related: #3707 (dispatch-origin attribution for throughput) should read the same kind label. Done when: unit tests cover the holder fallback and the daemon kind, and one day of real data shows the unattributed share under 10 percent.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
