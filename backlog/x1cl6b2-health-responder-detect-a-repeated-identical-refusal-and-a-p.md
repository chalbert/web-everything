---
kind: story
size: 3
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-smells/repeated-refusal.mjs", "we:scripts/conveyor/health-smells/no-progress.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-refusal.test.mjs", "we:scripts/conveyor/health-smells/__tests__/no-progress.test.mjs", "we:scripts/conveyor/health-smells/index.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: detect a repeated identical refusal and a PR with no progress between two checks

Operator, 2026-10-02. Two new detectors. (1) repeated-refusal: the same PR refused for the same reason by a daemon N times in a row (2026-10-01: #3336 stale-check-refused every tick for hours; #3432 review loop, about 17 runs). (2) no-progress: an open PR whose head, labels and checks have not changed across two checks a set interval apart (the operator standing rule: a PR that did not move between two checks gets dug into). Both feed the responder; their default action is the investigation and root-cause card of story x0zwwxn, plus escalation. Replay #3336 and #3432 from the daemon logs.

## Detector contract

For repeated-refusal use three distinct daemon attempt IDs with the same PR/head and structured refusal reason consecutively within two hours; repeated reads of one attempt do not count. For no-progress use two complete observations at least 30 minutes apart with unchanged head, labels and check state. Unknown/partial observations never count as unchanged. Preserve benign-wait exclusions. These detectors nominate episodes only; #x0zwwxn supplies the separately enabled investigation/filing actions and their shared caps. If unavailable or disabled, report the episode; never invent a fallback mutation or auto-clear a hold.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #x87w72a owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Repeated same cached attempt is not three refusals; three distinct consecutive matching attempts are. Test changed reason/head, benign wait, 30-minute boundary, partial checks and no-progress reset. Watch episodes route to the root-cause allowlist or report-only when disabled; detector evaluation itself never writes externally.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/health-smells/__tests__/repeated-refusal.test.mjs'
responder_test_1='we:scripts/conveyor/health-smells/__tests__/no-progress.test.mjs'
npx vitest run "${responder_test_0#we:}" "${responder_test_1#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #x87w72a records its soak, canary and operator enablement.
