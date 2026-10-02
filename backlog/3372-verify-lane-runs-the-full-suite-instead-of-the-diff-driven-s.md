---
bornAs: xgsu14f
kind: story
size: 2
parent: "3318"
status: resolved
dateOpened: "2026-08-27"
dateStarted: "2026-08-28"
dateResolved: "2026-08-28"
scope:
  - we:scripts/verify-lane.mjs
tags: []
---

# verify-lane runs the full suite, unaware the diff-driven selection it needs already shipped

`we:scripts/verify-lane.mjs`'s default gate is `npm run test:unit && npm run check:standards` — a bare, unscoped `vitest run` on every pre-land check. Under concurrent lanes this is the active bottleneck: six agents verifying at once means six full-suite runs competing for one machine tonight, and it killed at least one run outright.

## What already exists — verify this before building anything

**The shrink and its recovery path are both already built.** `we:scripts/readiness/test-selection.mjs`
(#2681, under #2612) is diff-driven test selection with a deny-by-default allow-list, selecting off the real
`git diff` via vitest's own module graph, pinned to the merge-base. `we:scripts/readiness/red-main-remediation.mjs`
is the dispatch-freeze + revert-authority recovery path the shrink's own DoD required before it could default on.
Its header states the DoD is satisfied: *"it may safely exist (and be consulted) before the shrink is ever
defaulted."*

**The flag is on in CI, off everywhere else.** `WE_DIFF_TEST_SELECTION` is set to `"1"` in
`we:.github/workflows/ci.yml`. `we:scripts/verify-lane.mjs`'s default `GATE` never sets it and has no awareness
the env var exists — it runs `npm run test:unit`, not the selection module directly. So the shrink exists and is
proven safe by its own remediation, and the one caller that would benefit most under tonight's load simply never
asked for it.

## Why this is small, not a redesign

Nothing here proposes new test-selection logic. The question is narrower: **should `verify-lane`'s default gate
set the selection flag (or shell the selection module directly) instead of the bare command?**

One thing to check before assuming yes: the selection module's own limits are stated in its header —
directory-based test discovery is invisible to a diff-based selector, and a diff falling under a sensitive
surface with no matching allow-list entry is **not shrinkable** by design (fails safe, not silently). Confirm
`verify-lane`'s own gate is itself shrinkable before wiring it in, or the change does nothing.

## Why now, not just tidiness

Tonight's contention is the forcing case, but the shape recurs: `verify-lane` is the **mandatory** pre-land gate
(#3321) that every lane runs before every PR can open. Its cost scales with concurrent lanes regardless of how
small any one PR's diff is. Six agents running the full suite simultaneously is not a corner case — it is what
this program does every time it dispatches in parallel, which today's session did repeatedly.

## Done when

1. **Executable** — a test asserting `verify-lane`'s default gate invokes the diff-driven selection (or sets
   the selection flag) rather than a bare `npm run test:unit`, and that on a diff falling under a sensitive
   surface with no allow-list entry it still runs the full suite — the fail-safe direction must not regress.
2. `npm run check:standards` — 0 errors.


## Follow-ups — fix-3311 incident, 2026-10-01

The operator's current scope supersedes the historical full-suite fallback above: no automatic local
full-suite escalation. In the read-only Claude transcript for session
`77313507-5a9e-4bae-b14a-34a8e1853dd6` (`fix-3311`, PR #3311), the 14:25:07Z selector output names five
shared helper/fixture triggers: we:scripts/conveyor/__tests__/sim/world.mjs,
we:scripts/lib/__tests__/fixtures/inherited-routing-policy.json,
we:scripts/lib/__tests__/inherited-routing-policy.mjs,
we:scripts/operations/__tests__/helpers/fake-claude-shim.mjs and
we:scripts/operations/__tests__/helpers/fake-claude.mjs. The merge-base diff, not just the latest fix commit,
was the input. The transcript records RED/exit 137 at 14:30:01Z and a reset/re-request at 14:30:08Z.
That initial signal's sender is unknown: shell exit 137 does not establish OOM, host load or a daemon timeout.
The available daemon log contains no corresponding initial ceiling attribution. Heavy admission normally
queues/throttles concurrency; its memory-capped container mode is opt-in, not evidence of a memory kill here.

The coordination verify-daemon log, lines 1781–1782, separately proves the later retry at `338ccb59` on
lane-4 exceeded the 1800000ms gate ceiling. Line 1791 dispatches it again. The ceiling and automatic retry
behavior live in we:scripts/conveyor/verify-dispatch.mjs, not the protected
we:skills-src/conveyor/verify-daemon.mjs. Keep the ceiling; record a terminal infrastructure failure and
require an explicit retry after diagnosis. Preserve signal/phase evidence without presenting it as a test failure.

The selector in we:scripts/lib/verify-lane-gate.mjs now includes shared helpers in graph/reference selection;
unsafe or oversized selections stop before dispatch (300 targets / 32000 UTF-8 bytes), never expand to a full suite.
The waiter in we:scripts/lib/lane-verify.mjs allows one 160-minute wait (120-minute admission ceiling,
5-minute queue buffer, 30-minute execution ceiling, 5-minute scheduling margin). The fix/build briefs
require awaiting the same tool process's completion notification, with no repeated-check turn loop.
A timeout is a diagnostic stop; it is not permission to reset and restart.

Testing lesson: replay the actual five-helper trigger, both shell-encoded and direct SIGKILL, the dispatcher's
real process-tree timeout, no retry on the following dispatch sweep, and one fake-clock wait lasting beyond
30 minutes. Keep legacy RED/137 markers readable as infrastructure failures. Full CI remains authoritative;
local graph/reference discovery is not a claim of exhaustive dynamic-dependency coverage.

Deferred by the operator: health smells for killed/overlong runs, repeated tool polling, and local full-suite
selection. Do not edit we:scripts/conveyor/health-smells/ in this run. The first SIGKILL's attribution still needs
historical host/process telemetry; do not retroactively label it a memory kill without that evidence.

Validation environment limitation: the required we:scripts/verify-lane.mjs run also selects
we:scripts/operations/__tests__/heavy-queue-io-real.test.mjs. Its real-process inspection assertion cannot
pass in this restricted sandbox: a direct `ps` probe returns `Operation not permitted`. Keep the assertion
and production behavior intact; rerun that gate on an authorized host with process inspection available.
