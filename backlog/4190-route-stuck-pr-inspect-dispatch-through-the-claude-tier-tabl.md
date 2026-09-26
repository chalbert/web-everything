---
bornAs: xdx4vig
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs", "we:scripts/lib/provider-routing.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Route stuck-pr-inspect-dispatch through the Claude tier table

we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs spawns its diagnosis-only inspection agent through we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv with no tier/model argument at all — it never calls we:scripts/lib/provider-routing.mjs#workerTierFor, unlike the build/fix dispatch paths that already route through the #3857 model-tier table. So an inspection dispatch always gets whatever buildAgentArgv defaults to, never Opus even for a statute-tier or security-tagged stuck PR. Fix: compute a tier via workerTierFor (kind/taskType/scopePaths from the stuck PR's own facts) before building argv, and pass the resulting model, mirroring how #3904's fix/ci-heal wrappers are meant to route (Claude tier only per the plan; non-Claude fixers wait on #4034). No existing card covers this file.

## Done when

1. **Executable** — a test on `we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs` shows a statute-tier or security-tagged stuck PR's inspection dispatch getting Opus, and an ordinary one getting Sonnet, by asserting `workerTierFor`'s result reaches the built argv — fails before this lands (today the same argv is built regardless of tier) and passes after.
2. **Live proof** — dispatch one real stuck-PR inspection (`node we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs --pr=<N> --repo=<slug> --stage=<stage> --minutes-since=<m> --threshold-minutes=<t>`) before and after the change; the before run's argv has no model flag, the after run's argv carries the tier table's chosen model.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
