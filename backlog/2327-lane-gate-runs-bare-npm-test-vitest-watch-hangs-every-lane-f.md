---
kind: task
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
locus: webeverything
tags: []
---

# Lane gate runs bare `npm test` (vitest watch) — hangs every lane forever; must use `vitest run`

## Digest

The parallel-execute lane instruction (we:skills-src/batch-backlog-items/parallel-execute.workflow.js:411)
tells each lane agent to run **`npm test`** before resolve/push. But `npm test` in this repo is bare
**`vitest`** — i.e. **watch mode**, which never exits. A lane that runs `npm test` (worse, `npm test | tail`,
where `tail` also blocks on an EOF that never comes) hangs indefinitely and the workflow's stall watchdog can
only false-positive on it. This is a **latent wedge for every WE lane**, not just one item — it bit #2126 in
the 2026-07-07 `parallel-batch-0707` run (the lane was fully done and green on `check:standards`; only the
gate invocation hung, and the PR had to be salvaged by hand). Fix: point the lane gate at a **non-watch**
invocation — `vitest run` (e.g. `npm test -- run` / `npx vitest run`) or rely on `npm run check:standards`,
which is what #2199 already documents as the WE gate. The PR's required `test` CI check runs the suite
regardless, so the in-lane run is a pre-push sanity check that must terminate.

## Acceptance

- The lane gate instruction (we:skills-src/batch-backlog-items/parallel-execute.workflow.js, and any sibling
  prose in we:skills-src/batch-backlog-items/SKILL.md) invokes vitest in **run mode**, never bare `npm test`.
- Grep the batch/lane skill sources for `npm test` and confirm no remaining watch-mode invocation on a lane's
  blocking path.
- The workflow ledger schema note (we:skills-src/batch-backlog-items/parallel-execute.workflow.js:170,
  "check:standards whole-repo + npm test") is reconciled to the run-mode command so the documented gate
  matches what lanes actually run.

## Notes

Surfaced by the salvage of #2126. Related: the workflow's out-of-band stall watchdog treated the hang as a
`Monitor`-wait false-positive (silent-by-design), so the human heartbeat — not the in-script circuit-breaker —
was what caught it. A run-mode gate removes the failure entirely; no watchdog change is required.
