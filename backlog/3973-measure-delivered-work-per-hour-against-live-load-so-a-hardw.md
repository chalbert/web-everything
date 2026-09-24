---
bornAs: xox8p6l
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/host-sampler-attribution.mjs", "we:scripts/operations/load-review.mjs", "we:scripts/readiness/velocity-metrics.mjs"]
relatedTo: ["3569", "3707", "3800", "3615"]
dateOpened: "2026-09-23"
tags: []
---

# Measure delivered work per hour against live load, so a hardware profile's delivery capacity can be read from telemetry

Goal (operator, 2026-09-23): know what capacity a given machine gives us, meaning delivered work, not only load. Audit 2026-09-23: the sampler records load well (continuous since 2026-09-20 12:41 EDT, hardware profile recorded: Apple M2 Max, 8 performance plus 4 efficiency cores, 64 GB), but nothing records output. dispatch.worker.event finish records carry no outcome, no item id and no PR number, and we:scripts/readiness/velocity-metrics.mjs works at day and week granularity from backlog dates. Merged PR times exist on GitHub (175 merged from 2026-09-20 to 2026-09-23) but are joined to nothing. Build: (1) stamp outcome (landed, parked, failed, abandoned), item id and PR number on the worker finish event; (2) a read-only report that buckets time into windows by live weighted load and worker count and gives, per bucket, PRs landed and items resolved per hour next to host busy percent, the spawn and spin stall probes and heavy-pool wait, per hardware profile; (3) the knee, the load level past which delivered work per hour stops rising while stall probes rise. Use only data from the clean window (from 2026-09-22 12:00 EDT, when the system-macos CPU class fell from about 230 to about 120 percent after the photo-library job; orphaned eleventy dev servers ran until 2026-09-21 about 08:00 EDT). Relates #3707 (conveyor-only origin, same outcome stamp), #3569 (rolling 24h capacity view, could render this report), #3800 (the per-hardware lanes formula this report feeds), #3615 (a second host would get its own row), and the calibrate command (a controlled reference the operator will schedule). Done when: the report runs on the laptop data and prints, per load bucket, delivered PRs per hour with a sample-size flag, and a unit test on a fixture reproduces the buckets.

## Confounders to exclude (added 2026-09-23)

A bucket where delivery was low for a reason other than the machine must be flagged, not counted as a hardware limit:

- **No ready work.** The queue-depth time series of #3569 is a required input: a bucket with an empty cleared queue is `supply-bound`.
- **Claude API waits.** The collector's allowlisted API request records (built on the prototype, see the #3383 tracker note of 2026-09-23): a bucket with 429 or 529 errors or high request latency is `api-bound`.
- **GitHub budget.** The sampler's `gh.rate_limit.*` metrics (same tracker note): a bucket where the core budget was exhausted is `github-bound`.

Only unflagged buckets count toward the knee.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
