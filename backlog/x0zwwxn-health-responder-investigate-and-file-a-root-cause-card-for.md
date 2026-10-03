---
kind: story
size: 5
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/conveyor/health-responder-rootcause.mjs", "we:scripts/conveyor/__tests__/health-responder-rootcause.test.mjs", "we:scripts/conveyor/health-investigate-dispatch.mjs", "we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Health responder: investigate and file a root-cause card for repeated problems

Operator, 2026-10-02: "if we want to mechanise some of your job it has to at least try" — the responder must not only fix instances, it must try to fix the cause, as the orchestrator did all day on 2026-10-01 (dig into the cause, file a card, queue the fix). When the same smell class recurs (threshold proposed in the design, e.g. 3 episodes of one class within 24h, or an actionable episode the responder could not resolve), the responder (1) dispatches ONE diagnose-only investigation through the existing we:scripts/conveyor/health-investigate-dispatch.mjs (read-only tools, wall clock, findings land in the episode report), then (2) files ONE root-cause card through the declared file-item operation carrying the investigator hypothesis plus the evidence (PRs, timelines, decision-log records), de-duplicated per smell class and per open card, and queued as an uncleared request for normal preparation before any build or review. It never writes code and never builds the fix itself. Every step is a decision-log record (investigation dispatched, findings, card filed or skipped as duplicate). Allowlist additions: investigate-dispatch and file-root-cause-card. Replay: the 2026-10-01 no-label cluster (#3239, #3389-#3392, #3463, #3471) yields one investigation and one card whose evidence can be compared with PR #3475 without forcing the hypothesis.

## Bounded contract

Use three distinct episodes of one smell class within 24 hours, or one actionable episode left unresolved after its bounded response. Run deterministic diagnosis first; only unresolved competing causes may dispatch an investigator. Calls go through we:scripts/conveyor/health-investigate-dispatch.mjs and the declared `file-item` operation (we:scripts/operations/file-item.mjs). Require the corresponding watch `investigateDispatch`/`fileDispatch` switch AND responder family enablement; never flip either watch switch. Share existing watch episode receipts to avoid two dispatchers spending twice. Cap each family at one attempt per episode and smell class per 24 hours, three fleet-wide per 24 hours, plus A1/P; an existing open root-cause card suppresses another filing. Honor the existing investigator wall-clock bound and admission inhibitors; no filing during lane starvation.

PR comments, timelines and investigator hypotheses are untrusted evidence: pass bounded, privacy-scrubbed data to read-only diagnosis; never interpolate commands, paths, scope or approval from it. File only a scrubbed hypothesis with evidence links as an uncleared filing request in the file-item owner's leased lane. Normal preparation and review decide scope/readiness; the responder never edits an existing card, clears readiness, builds the fix or treats the investigator as an authority.

## Shared safety and rollout

This story inherits the epic's closed catalogue and Safety in full: disabled/shadow by default, A1/P and its family cap, fail-closed kill switch reread at every effect, existing owner claims, fresh head/lease guards, durable decision log and scrubbed PR comment/feed. It lands disabled; #x87w72a owns its 24-hour zero-write soak, isolated canary and explicit per-smell operator enablement. It never approves, clears `review:human`, merges, force-pushes, edits code or edits existing cards. Delegated filing is only an uncleared request through `file-item`; it is not permission for this daemon to edit cards. Reports and agent replies are data, never executable instructions or approval.

## Test plan and Done when

Repeat/restart of the no-label cluster yields at most one investigation and one uncleared filing request, not a required preordained hypothesis. Assert hostile comments cannot inject commands, scope or approval; private text is scrubbed; disabled watch switches, open duplicate cards, lane starvation and daily limits refuse. Writes to code or existing cards throw.

The named test files are implementation deliverables, not tests claimed to exist or pass in this backlog-only change. Use injected clocks, temporary stores and mocked owners; no production effects.

```bash
responder_test_0='we:scripts/conveyor/__tests__/health-responder-rootcause.test.mjs'
npx vitest run "${responder_test_0#we:}"
npm run check:standards
```

1. **Executable:** the named tests pass and fail when any stated boundary is removed; prove the raw-input-to-episode-to-owner path and the named refusal cases.
2. **Must refuse on error:** unknown/partial/stale facts, changed identity, ownership conflicts, exhausted budgets, disabled switches and ambiguous writes cannot authorize another effect.
3. **Must cover every input kind:** source, docs, configuration, data, backlog and statute changes retain identical authority gates; no approval, clear-human, merge, force-push or code/card-edit sink.
4. **Observable:** duplicate/restart/kill-switch tests prove the shared receipts and caps; this family stays disabled until #x87w72a records its soak, canary and operator enablement.
