---
kind: story
size: 3
parent: "x4v2xe4"
status: open
relatedTo: ["xaypr56", "3628"]
scope: ["we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/dispatch-task-io.mjs", "we:scripts/operations/runner-activity-io.mjs", "we:scripts/operations/__tests__/dispatch-task.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Emit the job record from the dispatch itself: a dispatch-task operation for brief-file workers

The session writes one job file per hand-launched worker into the operator's `.operations/jobs/` folder by hand, in a store this repo never mentions, while every `dispatch-lane` launch already leaves a durable run record. Add a `dispatch-task` operation that launches a worker from a brief file through the same run store, and derive the job-file view from the run record, so there is one store rather than two.

## Confirmed by search

Nothing in the repo reads or writes that jobs folder (a repo-wide search finds no hit). The job files (`kind`, `item`, `session`, `agentId`, `launchedAt`, `brief`, `result`, `state`, `note`) are the operator's own hand-kept parallel record. The repo's real record is the run record: `we:scripts/operations/run-record.mjs` and `we:scripts/operations/run-store.mjs`, which `we:scripts/operations/runner-activity-io.mjs` already reads (in-flight and completed dispatches, stamped with liveness from `claude agents`).

So the two "cheapest wins" are not equally cheap. Stopping finished sessions (#x9rppp9) extends an existing module. This one needs a new operation, because `dispatch-lane` has no generic "run this brief file" kind: its kinds (`build`, `prepare`, `prepare-decision`, `fix`, `ci-heal`) are each tied to a backlog item and a fixed brief template (`BRIEF_REQUIRED_BY_KIND` in `we:scripts/operations/dispatch-lane.mjs`).

## Shape

- `dispatch-task --brief=<path> --session=<slug> [--kind=<label>] [--item=<id>]` reuses `we:scripts/operations/dispatch-lane-io.mjs` (`buildAgentArgv`, `defaultSpawnAgent`) for the spawn, mints the session slug the same way, and writes a run record through the run store. It adds no second spawn implementation; the statute [#conveyor-dispatch-calls-the-declared-operation](../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation) forbids one.
- The completion record (`we:scripts/operations/completion-cli.mjs` `report`) supplies `state` and the result pointer, so the job view needs no hand edits.
- The job-file view is a PROJECTION: a read that renders run records in the operator's job-file shape (extend `we:scripts/operations/runner-activity-io.mjs`, or add a small sibling read). No file is written that a run record could not regenerate.
- Enforcement is a follow-on, not this slice: once this exists, a warn-level rule in `we:scripts/guard-bash.mjs` can flag a raw `claude --bg` worker launch that skipped it. Do not deny; the operator legitimately launches ad-hoc sessions.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-task.test.mjs` passes; its cases fail before: launching from a brief file writes a run record listing session, brief path and launch time; the projected job view for that run matches the operator's job-file fields; a second call with the same session slug is refused as already in flight (the run-record guard), not double-spawned.
2. **Probed live** — one real worker launched through `dispatch-task` appears in `node we:scripts/operations/run.mjs runner-activity` as an in-flight dispatch with a live liveness stamp, and its job view needs no hand edit when the worker reports done.
