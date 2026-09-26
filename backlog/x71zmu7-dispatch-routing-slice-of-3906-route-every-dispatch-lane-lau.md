---
kind: story
size: 5
parent: "3906"
status: active
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-provider-registry.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/operations/dispatch-providers/fix.mjs", "we:scripts/operations/dispatch-providers/ci-heal.mjs", "we:scripts/operations/dispatch-providers/prepare.mjs", "we:scripts/operations/dispatch-providers/prepare-decision.mjs", "we:scripts/operations/delivery-agent-marker.mjs", "we:scripts/operations/effect-executor.mjs", "we:scripts/operations/dispatch-eligibility.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-supervision-promotions.json", "we:scripts/lib/__tests__/daemon-self-sync.test.mjs"]
dateOpened: "2026-09-26"
dateStarted: "2026-09-26"
tags: []
---

# Dispatch routing slice of #3906: route every dispatch-lane launch, apply the #3857 model table, list gpt-6-astra behind the #4034 gate

The routing half of #3906, delivered as its own slice so #3906 stays open for the rest. dispatch-lane computes decideDispatchRoute from the scorecards, size policy, promotion record and deliveryAgent marker; refuses with no route; holds on a supervision hold (enforcement off, #4180); buildAgentArgv applies the #3857 tier table as a --model alias and records workerModel; the provider registry lands with every row in agent mode; gpt-6-astra is an Opus-tier Codex candidate behind CRITICAL_WORK_GATE until #4034.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs we:scripts/operations/__tests__/dispatch-provider-registry.test.mjs` and `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` pass; both fail on main before this slice (missing modules and exports).
2. **Probed live** — a read-only dry-run over the live queue routes every item x launch kind to Claude, identically with the live scorecards and with none; `claude --bg` gets `--model sonnet` (build, fix, ci-heal, prepare, investigate) or `--model opus` (prepare-decision, statute-scoped work) — the current-model aliases, never an older pinned id.
3. **Executable** — `dispatch-eligibility` admission verdicts over the live queue are identical to main's.

Delivered by PR #2728's replacement (branch `lane/x71zmu7-dispatch-routing`). Resolves #3857.
