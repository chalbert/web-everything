---
bornAs: xqx998g
kind: story
size: 3
parent: "4795"
status: open
blockedBy: ["4919", "4697"]
scope: ["we:scripts/conveyor/health-responder-nudge.mjs", "we:scripts/conveyor/__tests__/health-responder-nudge.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: send templated nudges to a stuck agent session

Operator, 2026-10-02: the responder may message a live daemon-dispatched agent session to reorient and unstick it, in parallel with the root-cause work. Narrow: only a fixed set of reviewed message templates (for example: you are polling, use one blocking wait; the PR you are fixing was superseded or split, stop; the red check is a test outside your diff, report and stop; your claim was released, stop), only to sessions the responder can identify as daemon-dispatched for that PR, through the redirect mechanism of card 4697. A nudge never grants approval, never widens scope and never carries free text; the session must acknowledge or stop, and an unanswered nudge escalates. Free-text redirection stays with the operator or orchestrator. Every nudge and reply is a decision-log record and a PR comment.

## Nudge authority and bounds

The actuator is the sanctioned redirect owner to be delivered by #4697 in we:scripts/conveyor/fix-procedure.mjs and we:scripts/conveyor/reconcile-fix-dispatch.mjs; this adapter cannot ship live before it exists. The dependency is an existing external story, not a missing child of this epic. Match the target session/run/claim token to the owning daemon's durable dispatch record and the nominated PR/head; a session's self-description is not provenance. Send a reviewed template ID and validated identifiers only; no user-supplied or model-generated message body. Verify template preconditions from structured current state, not comment assertions. Cap one nudge per episode/session generation, two per session/day, A1/P. Wait at most five minutes for the matching acknowledgement; refusal/no reply escalates via the shared watch receipt, never retries, sends free text or forcibly kills the session.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #4932 owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Reject free text/template injection, unknown template, human/non-daemon session, mismatched PR/head/run/claim, forged acknowledgement and a replaced session. A valid template reaches the sanctioned redirect owner once across restarts; acknowledgement or timeout is logged and no second nudge or approval follows.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-nudge.test.mjs'
npx vitest run "${responder_test_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #4932 records its soak, canary and operator enablement.
