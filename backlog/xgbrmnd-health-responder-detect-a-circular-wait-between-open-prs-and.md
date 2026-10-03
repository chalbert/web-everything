---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-cycles.mjs", "we:scripts/conveyor/__tests__/health-responder-cycles.test.mjs", "we:scripts/conveyor/health-smells/circular-wait.mjs", "we:scripts/conveyor/health-smells/__tests__/circular-wait.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: detect a circular wait between open PRs and queued fixes, and propose the narrowest slice that breaks it

Operator, 2026-10-02. Live case: PR #3432 waited on the fix in card xfkqowg (a referral-ruling deadlock), while xfkqowg and two other fixes (xp0lsdi, xng7q1p) could not start because their scopes overlapped files #3432 touches; #3336, #3373 and #3415 sat for hours. The orchestrator broke it by narrowing xfkqowg to files #3432 does not touch. Detector: each tick build the waits-on graph (queued or prepared work waits on an open PR through shared scope; a PR waits on work through a ruling, a blocker or a named fix card) and report any cycle with its members and the shared files, once per cycle. Action: propose, never decide: the investigator suggests the narrowest slice that breaks the cycle (which files to drop, what becomes a follow-up) as one operator decision or a prepare note; a scope change is never applied automatically. Every step is a decision-log record. Replay the 2026-10-02 cycle.

## Proposal boundary

Build the waits-on graph in the watch's detection registry, not in the responder; feed a cycle episode with structured member IDs and shared files. The read-only report/HEALTH surface carries one proposal per normalized cycle/member-head generation. An investigator, if needed, uses #x0zwwxn's existing diagnose-only dispatch and shared caps; this is not a second investigation budget. No automatic file-item, card edit, scope mutation, blocker removal or dispatch unlock follows a proposal. A prepare note is report output for the operator to apply, never a write to a card.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #x87w72a owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Replay the named cycle from raw watch facts, deduplicate reordered members and repeated ticks, and emit one proposal. Incomplete edges refuse a claimed cycle. Injected file names remain display-only; no scope/card/dependency/dispatch write occurs, including when the proposed slice would unblock work.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-cycles.test.mjs'
npx vitest run "${responder_test_0#we:}"
responder_extra_0='we:scripts/conveyor/health-smells/__tests__/circular-wait.test.mjs'
npx vitest run "${responder_extra_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #x87w72a records its soak, canary and operator enablement.
