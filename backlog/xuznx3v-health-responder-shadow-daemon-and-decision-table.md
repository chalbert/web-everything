---
kind: story
size: 8
parent: "xdmqryh"
status: open
scope: ["we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/health-responder-core.mjs", "we:scripts/conveyor/health-responder-state.mjs", "we:scripts/conveyor/__tests__/health-responder.test.mjs", "we:scripts/conveyor/__tests__/health-responder-core.test.mjs", "we:scripts/conveyor/__tests__/health-responder-state.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/", "we:scripts/operations/health-respond.mjs", "we:scripts/operations/__tests__/health-respond.test.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/launchd/com.we.health-responder.plist.example", "we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/run.test.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs", "we:skills-src/conveyor/__tests__/pass-daemon.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: shadow daemon and decision table

Build the shadow-only consumer and pure total decision table specified by epic #xdmqryh. Reuse the existing pass-daemon lifecycle and singleton lease; read completed watch episodes, validate generation and freshness, decide and journal without external mutation sinks. Replay D1, C2 and R1 plus every current smell and malformed/closed history. Grounding: we:scripts/conveyor/health-watch-core.mjs:318; we:skills-src/conveyor/pass-daemon.mjs:67.


## Implementation contract

Slice 1 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Deliver the independent shadow process, pure decision table, durable receipt/budget schema and inert declared action boundary from the epic. New files named in scope are proposed deliverables, not existing evidence. The installed example stays disabled/shadow; the story does not install launchd or alter host settings.

- Reuse the pass-daemon manifest, host singleton key, heartbeat, clean-exit reload and dedicated clone registry. Source: we:skills-src/conveyor/pass-daemon.mjs:67, we:skills-src/conveyor/pass-daemon.mjs:206; we:scripts/lib/daemon-clone-registry.mjs:50. Include lease-loss and two-process tests using the existing runner-lock primitive, not a new lease implementation.
- Read `healthDir` state, completed tick and matching episode reports only. Closed/pending/historical records do not authorize work. Reject mixed generations, bad identity, unreadable configuration and a watch older than 15 minutes. Source: we:scripts/conveyor/health-watch-section.mjs:50; we:scripts/conveyor/health-watch.mjs:964; we:scripts/conveyor/health-watch-core.mjs:368.
- Implement the epic's pure input/output contract and every current catalogue row, including explicit no-action reasons. Future detector variants are inert unless the matching evidence and implemented adapter exist. Enumerate registered descriptors in a test; fail on an uncovered smell. Do not call any descriptor evaluator in production responder code.
- Persist proposed decisions and budgets in a separate pinned responder store. Define full episode identity, repo/PR/head or pool/lane/holder/generation, family receipt, rolling counters, config version and `prepared/submitted/confirmed/refused/unknown` states. Shadow receipts never count as successful live actions or consume real actuator budgets; live activation cannot mistake a simulated postcondition for evidence.
- Wrap future actions as a closed declared operation in we:scripts/operations/health-respond.mjs and register it in the existing operation CLI. Shadow supplies no external effects; any attempted GitHub write, action-job/worker spawn, lane/claim mutation, desktop notification or host config edit must fail its test. The only writes are its own diagnostic journal/receipts/last-tick. Source operation schema: we:scripts/operations/registry.mjs:12; current CLI wiring: we:scripts/operations/run.mjs:216.
- Implement a bounded tick (30 seconds), bounded foreground child reads (10 seconds), 60-second cadence, one candidate per tick and strict disabled switch. The core accepts time/facts/IO results as inputs; tests need neither host state nor network. Detached action jobs will be supplied by action stories; do not add a replacement job framework. Source lifecycle/job rules: we:docs/agent/platform-decisions.md:5597 and we:docs/agent/platform-decisions.md:5744.

## Scope boundary

15 scope paths, four areas: we:scripts/conveyor/, we:scripts/operations/, we:skills-src/conveyor/, we:scripts/lib/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. The new fixture-directory prefix is intentional: this story introduces the complete replay corpus, whose members do not exist yet; every later action story scopes its specific fixture file. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable: the daemon produces useful shadow decisions while all action families are absent/disabled.

## Test plan and replay

D1 (#3336), C2 (#3415) and R1 (#3432) in shadow; import the remaining epic rows as inert baseline cases. Exercise all 41 registered smells plus unknown/new smell, pending/closed history, flapping/tracked episodes and corrupt/mixed-generation snapshots. Repeated replay and a daemon restart produce identical decisions with **zero external writes**. Put provenance (capture time, GitHub event/comment URLs, observed head, unknown fields) beside normalized data; no host/network access in tests.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/conveyor/__tests__/health-responder-core.test.mjs'
responder_test_2='we:scripts/conveyor/__tests__/health-responder-state.test.mjs'
responder_test_3='we:scripts/conveyor/__tests__/health-responder.test.mjs'
responder_test_4='we:scripts/operations/__tests__/health-respond.test.mjs'
responder_test_5='we:skills-src/conveyor/__tests__/pass-daemon.test.mjs'
responder_test_6='we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}" "${responder_test_4#we:}" "${responder_test_5#we:}" "${responder_test_6#we:}"
npm run check:standards
lane_verifier='we:scripts/verify-lane.mjs'
node "${lane_verifier#we:}"
```

Use isolated temporary roots, mocked GitHub/actuator IO and injected clocks. Assertions must inspect the called existing owner, expected identity, durable receipt and preserved forbidden state; a snapshot of proposed prose alone is not evidence. No live host files or production PRs are mutated by replay.

## Done when

1. **Executable:** the primary checks above pass, including the named replay and negative/race cases. The implementation leaves the epic’s traceable receipt and uses the existing actuator boundaries.
2. **Must refuse on error:** missing/partial/stale facts, unknown authority/owner, changed head/lease, exhausted caps, terminal holds and kill/pause settings cannot reach a forbidden write. An ambiguous write is never automatically repeated.
3. **Must cover every input kind:** documentation, config, data, backlog and source inputs all retain the same review/ownership gates; no non-code exemption, synthetic approval or clearing of `review:human`.
4. **Observable:** a bounded shadow tick runs with zero external effects, logs every decision and survives restart/lease contention; mode remains disabled/shadow.

## Follow-ups

Record replay limitations, observed product gaps and testing lessons here. Do not append to shared agent docs or silently add a new automatic action beyond the epic’s catalogue.
