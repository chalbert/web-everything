---
bornAs: xkwot03
kind: story
size: 2
parent: "4795"
status: open
blockedBy: ["4919"]
scope: ["we:scripts/operations/health-respond.mjs", "we:scripts/operations/__tests__/health-respond.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: publish a what-unblocks-each-PR table in its feed

Operator, 2026-10-02. The orchestrator built a per-PR "real state / what unblocks it" table by hand several times a day. The responder already knows each stuck PR, its cause and the pending action, so its read-only operation and Plateau feed publish that table: PR, plain-language state, cause, what unblocks it (an action in flight, a card, or an operator decision), and since when. Replay the 2026-10-02 morning state.

## Read-only boundary

Publish the existing decision log through `health-respond` and its Plateau feed; no new actuator. Include unknown/stale status explicitly and distinguish proposed, submitted and confirmed actions. One row per PR/head; refreshes do not emit new notifications or mutations (external write cap zero). Scrub evidence and link the responsible card/decision without treating its prose as authority.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #4932 owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Replay the morning table including missing and stale facts, in-flight versus confirmed recovery and held operator decisions. Assert one row per PR/head, scrubbed data and zero action/notification sinks during reads.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/operations/__tests__/health-respond.test.mjs'
npx vitest run "${responder_test_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #4932 records its soak, canary and operator enablement.
