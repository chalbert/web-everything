---
kind: story
size: 2
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-capacity.mjs", "we:scripts/conveyor/__tests__/health-responder-capacity.test.mjs", "we:scripts/conveyor/health-smells/capacity-hold.mjs", "we:scripts/conveyor/health-smells/__tests__/capacity-hold.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: report capacity holds and idle slots (report only)

Operator, 2026-10-02. Report-only, never act: when dispatch is held for over 30 minutes by a load gate (2026-10-01: memory pressure held every launch for 3+ hours; fseventsd at 8.2 GB), or worker slots sit idle while work is blocked, escalate once with the reason, the reading and the top processes by memory and CPU. Related card xd6u5ta. Replay the 2026-10-01 memory-pressure hold.

## Report boundary

The watch detects the greater-than-30-minute load hold or idle capacity and supplies bounded scrubbed readings; the responder calls only the existing watch HEALTH report/notification owner. One report per episode, updated without duplicate alerts; H permits one high-severity notification and keeps lower severity in the report. External capacity mutations have cap zero. Never raise a cap, clear a hold, dispatch into held capacity, kill a process or rewrite host settings.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #x87w72a owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Replay 30-minute boundary, persistent load and idle-slot cases; check scrubbed process readings and one shared alert receipt. Missing samples stay unknown; no process kill, cap change, pause change or dispatch occurs even with idle slots.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-capacity.test.mjs'
npx vitest run "${responder_test_0#we:}"
responder_extra_0='we:scripts/conveyor/health-smells/__tests__/capacity-hold.test.mjs'
npx vitest run "${responder_extra_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #x87w72a records its soak, canary and operator enablement.
