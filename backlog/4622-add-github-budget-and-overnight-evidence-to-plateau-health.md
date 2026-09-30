---
bornAs: xj5krcc
kind: story
locus: plateau-app
size: 5
status: open
blockedBy: ["4620", "4619", "4340"]
scope: ["plateau-app:src/wip/progress-health.ts", "plateau-app:src/wip/progress-health.test.ts", "plateau-app:src/wip/progress-policy.ts", "plateau-app:src/wip/progress-policy.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:scripts/wip-publish.ts"]
dateOpened: "2026-09-30"
tags: []
---

# Show system health API budget overnight stop evidence and the ruled policy source

Project daemon health episodes, GitHub spend, completed-tick age and observed overnight control status beside read-only rules and priorities. Full design: we:docs/agent/plateau-progress-view.md.
## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline, source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

## MVP

Add proposed Plateau health/policy adapters named in scope. Read persisted health episodes and stamps, runner/drain status and gh-spend ledgers only. Keep App/personal and REST/GraphQL budgets separate with observation/reset times and unattributed gaps. Distinguish process heartbeat from completed tick/pass and intentional pause. Show desired overnight mode separately from observed stop, affected jobs, reason, last/next check. If no controller observation exists, show unknown and shape the producer follow-up during preparation; never infer stopped from prose or a kill switch alone. Implement the rules source selected by #4619 without changing daemon policy.

## Done when

1. A live heartbeat with stale builder tick renders stalled; unavailable health never becomes green. Episodes show system owner and last remediation, with only explicit human-only escalation in Needs you.
2. API budget uses actual ledger response observations and honest rate windows; old headers after reset stay stale. No rate-limit API call is added.
3. A stop requested while workers still run is visible; policy versus actual config disagreement remains explicit.
4. Rules/priorities have source revision and effective dates where known; the projection is read-only and no historical log or secret is published.

## Test and proof

Test stale/paused/absent daemons, old budget reset, torn ledger lines, missing control producer and conflicting rule revisions. Run adapter/view/relay checks and probe real persisted observations through the relay. Record source freshness and zero additional GitHub spend. Verify source migration with the operator ruling before activation.

## Readiness and follow-ups

Filed with `--queue=false`: design reviewed by the operator and producer seams proven during preparation before scheduling. No prepared stamp is claimed. Scope lists predicted files, including new adapters and tests; revise it during preparation if an existing producer needs a separate change. Record testing lessons and uncovered producer gaps here, not in shared agent docs.

Existing prerequisite #4340 supplies the daemon panel and dispatch-log holds; extend those observations rather than add a competing panel.
