---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-investigate-plan.mjs", "we:scripts/conveyor/health-investigate-dispatch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/__tests__/health-investigate-plan.test.mjs", "we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2850's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-investigate-plan.mjs:108` — Keep an entry while its episode is still open (pass open episode ids into pruneLedger), and add a test that an old finished entry for a still-open episode blocks re-dispatch.
2. `we:scripts/conveyor/health-investigate-dispatch.mjs:247` — Annotate the closed-transition episodes with investigationStatus and investigation before the report write, or run the append step after the reports are written. Add an integration test of a tick where findings land and the episode closes in the same tick.
3. `we:scripts/conveyor/health-investigate-dispatch.mjs:77` — In `createInvestigationSinks`, add a permission mode to `extraArgs` (e.g. `dontAsk`/`plan`, if the CLI supports it) when the caller supplies none. Also add a test that fails if the argv lacks a permission-mode flag. If the CLI cannot express that, add a `check:standards` rule that untrusted-input agent kinds must declare a permission mode.
4. `we:scripts/conveyor/health-investigate-dispatch.mjs:222` — Branch on `e.notApplied` in the catch block. Record an indeterminate failure as a `running`-like entry that holds the slot and is reaped by session name. Add a test that injects an UNKNOWN error and asserts the slot stays held.
5. `we:scripts/conveyor/health-watch-core.mjs:563` — Neutralise backtick runs in `scrubInvestigationText`, or fence with a longer delimiter. Ignore `--state-root` in the agent-facing verbs when the settings env already pins it. Add a test that findings containing a fence do not close the report fence.
6. `we:scripts/conveyor/health-investigate-plan.mjs` — Preserve investigation tombstones for active episodes and add a deterministic regression test that prunes the ledger, advances beyond seven days, and replans the same open episode.
7. `we:scripts/conveyor/health-investigate-dispatch.mjs` — Bind recording authority to an enforced per-session capability or isolated writer endpoint, and gate it with a two-session impersonation regression test.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2850@9979506d71b0beb8cb5ebd1fe25826fab283e2d8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
