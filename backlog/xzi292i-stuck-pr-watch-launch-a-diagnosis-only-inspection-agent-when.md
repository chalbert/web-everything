---
kind: story
size: 8
parent: "3383"
status: active
scope: ["we:scripts/conveyor/stuck-pr-watch-core.mjs", "we:scripts/conveyor/stuck-pr-watch.mjs", "we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs", "we:scripts/conveyor/session-slug.mjs", "we:skills-src/conveyor/stuck-pr-inspect-brief.md", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
tags: []
---

# Stuck-PR watch: launch a diagnosis-only inspection agent when a PR stalls past its stage's threshold

Operator (2026-09-23): "we also should have a health watch that launch and inspection if pr are stuck." A
standing, cross-repo (WE/FrontierUI/plateau-app) mechanical pass that flags an open PR with no progress (no
new commit, label event, or comment) for longer than its review stage's expected time, and nothing live
already working it, then dispatches ONE diagnosis-only inspection agent per stuck episode through the
existing dispatch sink. `review:human`, drafts, and stood-down PRs never count. Pure core / IO shell, mirroring
`we:scripts/conveyor/parked-pr-conflict-watch.mjs`.

## Done when

1. **Executable** — `node we:scripts/conveyor/stuck-pr-watch.mjs sweep --repo=chalbert/web-everything --dry-run`
   runs with no `gh` write and reports every open PR it would flag as stuck, with its stage, minutes since last
   activity, and threshold.
2. Unit tests pin the per-stage thresholds, the never-stuck exclusions (`review:human`, draft, stand-down
   marker), the dispatch-marker idempotency (no second dispatch for the same activity episode), and the
   2-concurrent dispatch cap.
3. Registered in `we:skills-src/conveyor/daemon-manifest.mjs` as a per-repo entry, with a `.plist.example`.
