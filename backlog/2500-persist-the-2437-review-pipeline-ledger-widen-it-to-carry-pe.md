---
bornAs: xpat265
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, console, review-pipeline]
---

# Persist the #2437 review-pipeline ledger + widen it to carry per-lens verdicts (prerequisite for #2486)

The #2486 console surface needs the #2437 `review-parked-prs` ledger, but that ledger is currently EPHEMERAL — we:scripts/workflows/review-parked-prs.mjs returns `{pr, repo, disposition, verdict, commentBody}` in memory to the invoking agent and persists NOTHING (no file, no `.drain-daemon/` artifact, no CLI command, no posted PR comment — by design it labels/comments/merges nothing, so #2486's premise that "its only output is the label + a posted comment" is factually wrong).

Two things must land before the dev-panel can render the pipeline's reasoning:

1. **Persist the ledger** to a panel-reachable location — the smallest path consistent with the existing dev-panel data flow is a file under `.drain-daemon/` keyed by `repo#pr` plus a `plateau:tools/drain-daemon/cli.mjs` command + a `plateau:tools/dev-panel/vite-plugin.ts` proxy route, mirroring the existing `review-detail` path. Note the Workflow body itself can't do filesystem writes (sandbox), so persistence happens in the invoking/wrapper layer — which ties into HOW #2437 is invoked in production (relates to #2418, #2444).

2. **Widen the ledger shape** to include the per-lens `lensVerdicts` map, which the reduce step already computes internally (in `payloadA`/`reducePrompt`) but currently DROPS — so "per-lens verdicts" has data to render.

Impl spans plateau-app (persist path + cli + route) and WE (we:scripts/workflows/review-parked-prs.mjs shape); WE holds zero daemon impl. Blocks #2486.
