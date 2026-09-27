---
kind: story
size: 5
parent: "x59tqsg"
status: open
blockedBy: ["xk0v6oi"]
scope: ["we:scripts/lib/daemon-edge.mjs", "we:scripts/lib/daemon-edge-resolver.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# daemon-edge slice 2: dispatch a resolver session for each owed edge resolution and verify it kept both intents

Consume the owed-resolution records slice 1 writes (we:scripts/lib/daemon-edge.mjs). Dispatch one resolver agent per record with a brief: merge the clashing sides preserving both intents, run the selected gate, push to daemon-edge with a lease. Verify after: both heads are ancestors of the new edge tip, record cleared by the next edge tick. Bound: one resolver in flight per record, retry cap, then notify the operator.

## Done when

1. **Executable** — a test on real temp repos: two clashing fixes registered, the edge tick records one owed
   resolution, the resolver dispatch (with a fake agent that performs the resolution) pushes to `daemon-edge`,
   and the next tick shows both PRs `merged` and the debt cleared. A resolver that drops one side (one head not an
   ancestor of the new tip) is rejected and retried, then escalated after the cap.
2. **Soak** — a `we:scripts/conveyor/soak/breaks/` scenario "two clashing daemon fixes both stay in edge after
   resolution", driven through the daemon tick loop.

## Scope

- Reads the ledger's `owed` records (`kind`: `pr-merge`, `main-merge`, `revert`; `paths`; `theirs`; `since`).
- One resolver per owed id in flight; a lease on the edge tip; retry cap; notify the operator after it.
- Resolver brief: resolve preserving both intents, run the selected gate (`verify-lane`), push with
  `--force-with-lease` to `daemon-edge`. Never force-push over a moved tip.
- Flag-gated by `WE_DAEMON_EDGE` like slice 1.
