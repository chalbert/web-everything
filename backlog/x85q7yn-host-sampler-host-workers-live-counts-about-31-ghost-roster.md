---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/host-sampler-attribution.mjs", "we:scripts/operations/host-sampler.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Host sampler: host.workers.live counts about 31 ghost roster workers with no process

Audit 2026-09-23: every host.workers.live sample from 2026-09-21 to 2026-09-23 carries no_pid of about 31 (avg 31.1, 31.0, 31.0 by day), the count of claude agents roster entries in state working with no pid (we:scripts/operations/host-sampler-attribution.mjs, rosterWorkingNoPid). The same constant across three days means they are stale roster entries, not live work. Downstream the live-worker figure reads p50 37 and p90 53 when the real per-kind counts are nearer 6 to 12, which inflates any workers-versus-load curve and the weighted live load that #3808 and #3806 would compare against the budget. Fix: keep no_pid as its own diagnostic, never add it to a live total; age out a no-pid entry after it has been seen unchanged for longer than the lease TTL; and report the stale roster count as its own metric so the session reaper (#3862) can act on it. Lives on the prototype branch (graduation #3899). Done when: a unit test with a roster of stale no-pid entries shows them excluded from the live count and reported separately, and on the laptop host.workers.live matches the number of worker processes actually running.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
