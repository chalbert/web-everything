---
kind: story
size: 5
parent: "3621"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/review-label-provider.mjs", "we:scripts/conveyor/ci-queue-watch.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-11"
tags: []
---

# Migrate remaining gh CLI call sites to the gh-throttle wrapper

Follow-up to #3621's amendment: the gh-throttle wrapper (we:scripts/lib/gh-throttle.mjs) was built and proven, then wired into only the conveyor runner's own highest-volume per-tick gh callers as first-adopter proof — we:scripts/lib/review-label-provider.mjs's createGhProvider default exec (used by we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/review-round-tag.mjs, we:scripts/conveyor/review-status-tag.mjs), we:scripts/conveyor/ci-queue-watch.mjs's defaultListRuns default exec, and we:skills-src/conveyor/runner.mjs's own direct gh repo view call. A repo-wide grep the night this was built found 84 files invoking gh via execSync/spawnSync/execFile with no shared gate at all; roughly 79 of those remain unthrottled and still exposed to GitHub's secondary (burst) rate limit (100 concurrent requests / 900 REST points-min / 2000 GraphQL points-min) that motivated the wrapper. Scope: grep repo-wide for gh subprocess call sites, triage high-volume/concurrent ones (conveyor watches, dispatch/review scripts) versus rare one-offs, and migrate each to we:scripts/lib/gh-throttle.mjs's runGhSync/execFileSyncThrottled (the importable seam) or the node we:scripts/lib/gh-throttle.mjs CLI passthrough, proving byte-for-byte pass-through fidelity is preserved at each site (real side-by-side output comparison against raw gh) the way the wrapper's own tests already did. Deliberately NOT folded into the wrapper's own build — too large/risky to do blindly in one sitting.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
