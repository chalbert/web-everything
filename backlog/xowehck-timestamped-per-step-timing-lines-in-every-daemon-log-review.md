---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/verify-daemon.mjs", "we:skills-src/conveyor/pass-daemon.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Timestamped, per-step timing lines in every daemon log (review, fix, verify, pass-daemon, drain daemon)

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Finding g-class (just speed it up). None of the conveyor daemon logs under the pinned state root carry a timestamp on any line, and no tick logs how long each step took, so today's tick lengths had to be inferred from lease heartbeats and file mtimes. Fix shape: one shared tick-timer helper (step name, ms, ISO time) used by we:skills-src/conveyor/review-daemon.mjs, we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs, we:skills-src/conveyor/verify-daemon.mjs, we:skills-src/conveyor/pass-daemon.mjs, and the drain daemon's pass line; one JSON line per tick with the step breakdown. Excludes we:scripts/merge-ai-prs.mjs step timing, owned by the in-flight drain timing worker; reuse its helper, we:scripts/lib/pass-timings.mjs from PR #2627 (card x2e120n). Done when: tests; LIVE proof: a day of review-daemon log yields tick p50/p90/max per step with one awk command, quoted in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
