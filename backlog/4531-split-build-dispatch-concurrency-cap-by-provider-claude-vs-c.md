---
bornAs: xddlvn0
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Split build-dispatch concurrency cap by provider (Claude vs Codex/agy)

Operator direction 2026-09-29 ~4:10pm ET: restrain Claude concurrency, double Codex/agy allowance. we:skills-src/conveyor/build-dispatch-daemon.mjs's --max-concurrent today is one shared cap across every executor. Split it into a Claude-build cap (default 1) and an external-build cap for Codex/agy (default 4), both configurable via flags/env, keeping --max-concurrent as the Claude cap for backward compat (or documenting the mapping) in we:scripts/conveyor/build-dispatch-policy.mjs. The open-items limit (#4494, own items only) stays a separate, total-scoped cap and is unaffected. #4518 confirmed the durable run-store record for every in-flight build already carries executor (antigravity/codex/claude) via we:scripts/operations/dispatch-lane-io.mjs's inFlight dispatch record, so counting in-flight builds per-executor needs no new plumbing beyond a split cap check in planBuildDispatch and two new flags/env vars in the daemon. #4518's own PR adds the minimum bar (provider visible per in-flight build in the tick line) as a stepping stone; this card is the actual cap-split enforcement.

## Done when

1. **Executable** — a `planBuildDispatch` unit test in `we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs`
   seeds `inFlight` with 1 Claude-executor build (`executor: 'claude'`) and 4 external-executor builds
   (`executor: 'codex'`/`'antigravity'`), plus one more candidate of each kind, with the new caps at their
   defaults (Claude=1, external=4): the Claude candidate is HELD (cap full) and the external candidate is
   DISPATCHED (cap has room) — this fails today (one shared `maxConcurrentBuilds` counts both together) and
   passes once the split lands.
2. A `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` test confirms the daemon's CLI flags
   (or env vars) set the two caps independently, and that omitting the new flag keeps `--max-concurrent`
   behaving as the Claude cap (backward compat), never silently changing today's default behavior for a
   caller that never passes the new flag.
