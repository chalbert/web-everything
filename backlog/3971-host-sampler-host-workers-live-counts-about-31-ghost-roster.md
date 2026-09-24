---
bornAs: x85q7yn
kind: story
size: 2
parent: "3383"
status: resolved
scope: ["we:scripts/operations/host-sampler-attribution.mjs", "we:scripts/operations/host-sampler.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Host sampler: host.workers.live counts about 31 ghost roster workers with no process

Audit 2026-09-23: every host.workers.live sample from 2026-09-21 to 2026-09-23 carries no_pid of about 31 (avg 31.1, 31.0, 31.0 by day), the count of claude agents roster entries in state working with no pid (we:scripts/operations/host-sampler-attribution.mjs, rosterWorkingNoPid). The same constant across three days means they are stale roster entries, not live work. Downstream the live-worker figure reads p50 37 and p90 53 when the real per-kind counts are nearer 6 to 12, which inflates any workers-versus-load curve and the weighted live load that #3808 and #3806 would compare against the budget. Fix: keep no_pid as its own diagnostic, never add it to a live total; age out a no-pid entry after it has been seen unchanged for longer than the lease TTL; and report the stale roster count as its own metric so the session reaper (#3862) can act on it. Lives on the prototype branch (graduation #3899). Done when: a unit test with a roster of stale no-pid entries shows them excluded from the live count and reported separately, and on the laptop host.workers.live matches the number of worker processes actually running.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Withdrawn (2026-09-23): the finding was a misread

Read in code while building the fix: `summarizeWorkers` in we:scripts/operations/host-sampler-attribution.mjs counts a worker live only when its pid is in the same sample's `ps`, and reports the no-pid roster rows apart as `no_pid`. `host.workers.live` never included them. The audit compared `no_pid` against the sum of the per-kind counts, which is the live total itself, so "37 live, really 6 to 12" was wrong: about 37 workers really were live (for example 40 review sessions at once on 2026-09-23). No code change; recorded on the #3383 tracker.
