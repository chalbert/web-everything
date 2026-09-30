---
bornAs: xfbqcsu
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/conveyor/health-smells/__tests__/ghost-sessions-inflate-cap.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "3875062efca5bc31599ffb24f3ee315b5c2d9bcc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2818's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs` — Add a deterministic parameterized unit test covering both PID and sessionId identities against unavailable, empty, matching, and nonmatching process snapshots.
2. `we:scripts/operations/deliver-item-wrapper.mjs:2162` — A unit test asserting the exact arguments passed to `execFileSync` for `openPr` without relying on overly-permissive mocks that ignore the base path.
3. `we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs:46` — A unit test asserting that `isProcessAlive({ pid: 123 }, null)` returns `null`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2818@78eade7a73094426fe5d79e5bd2f0911cc9f69c4

## Done when

1. **Executable** — `npx vitest run ghost-sessions-inflate-cap deliver-item-wrapper` fails before this item lands (the new `isProcessAlive({ pid: 123 }, null)` case returns `false`, not `null`) and passes after.

## Design

**Premise check (current `main`, 3875062):** guards 1–3 are NOT already done, but they are not equally owed.
- Guard 3 is a real bug, not just a missing test. `isProcessAlive` (`we:scripts/conveyor/health-smells/ghost-sessions-inflate-cap.mjs:46-58`) handles a valid `pid` with `return rowsGiven && processRows.some(...)`. When the `processes` probe never ran (`processRows` is `null`/non-array) that evaluates to `false` ("confirmed dead"), not `null` ("unknown"). The function's own docblock says "`null` (never a guess) when neither signal can answer", and the `sessionId` branch below it already honours that. So a failed `ps` probe makes every pid-bearing non-terminal session a "ghost" in `findGhostAgentSessions`. Fix: `if (pid > 0) return rowsGiven ? processRows.some(...) : null;`.
- Guard 1 is partly covered. `we:scripts/conveyor/health-smells/__tests__/ghost-sessions-inflate-cap.test.mjs:19-37` already has separate cases for pid alive/dead, sessionId alive/dead, null-probe (sessionId only), and empty snapshot (sessionId only). Missing: the pid identity against `null` and against `[]`, and a single parameterized table over {pid, sessionId} × {`null`, `[]`, matching, non-matching} so the two identities cannot drift apart again.
- Guard 2 is an untested argument contract. `openPr` (`we:scripts/operations/deliver-item-wrapper.mjs:2428-2459`) builds an argv of the absolute `we:scripts/operations/run.mjs` path, `open-pr`, `--ref`, `--sha=HEAD`, `--base=main`, `--bodyFile`, `--requireVerified=true`, `--json`, then `--mode=...`. Existing tests (`we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs:2517-2570`) find the call with `c[1]?.[1] === 'open-pr'` and check only `--ref=` and the env — nothing pins `--base=main`, `--sha=HEAD`, `--requireVerified=true`, the absolute script path, or `cwd: lane`, so a mock that ignores them still passes.

**Mechanism:** (a) one-line fix to `isProcessAlive` above; (b) add a `describe.each` table test in `we:scripts/conveyor/health-smells/__tests__/ghost-sessions-inflate-cap.test.mjs`; (c) add one `openPr` test that captures the `run` mock's exact `(cmd, args, opts)` and does a `toEqual` on the full argv and `opts.cwd`, for both `label-on-green` and `park` modes.

## MVP

Musts only:
1. Fix `isProcessAlive` so a valid pid with an unavailable (`null`/non-array) snapshot returns `null`.
2. Parameterized test: {pid, sessionId} × {unavailable, empty, matching, nonmatching} → expected `null`/`false`/`true`/`false`.
3. Explicit `isProcessAlive({ pid: 123 }, null) === null` test, plus `findGhostAgentSessions` not flagging a pid-bearing session when `processRows` is `null`.
4. `openPr` test asserting the exact argv array and `cwd` for both park modes.

Out of scope (Follow-ups): changing `evaluate()` hysteresis, touching `we:scripts/conveyor/session-reaper.mjs`'s own pid-dead axis, broader `deliver-item-wrapper` mock tightening.

## Test plan

- `isProcessAlive` table (8 cases). RED before fix: `{pid:123}` × `null` returns `false` (expected `null`); every other cell already passes, which is fine — they pin the contract.
- `isProcessAlive({ pid: 123 }, null)` → `null`. RED before fix (`false`).
- `findGhostAgentSessions([{ state:'working', pid:123 }], null)` → `[]`. RED before fix (flags it as ghost).
- `openPr` exact argv (label-on-green): `[`the absolute we:scripts/operations/run.mjs path`,'open-pr','--ref=lane/4325-x','--sha=HEAD','--base=main','--bodyFile=<the lane's PR-body file>','--requireVerified=true','--json','--mode=label-on-green']`, `opts.cwd === lane`. Fails if any flag is dropped/reordered/renamed; park mode adds `--mode=park --parkLabel=<label>`. Not RED today (it's a pin for a current behaviour); its value is regression-catching, verified by mutating `--base=main` locally and seeing it fail.

## Proof plan

1. Run the two test files on `main` before the fix: the three pid/null cases fail; capture output. After the fix: all green; capture output.
2. Live probe: `node --input-type=module -e "const m=await import(<abs path of the ghost smell module>); console.log(m.findGhostAgentSessions(...))"` calling `findGhostAgentSessions([{name:'x',state:'working',pid:123}], null)` before (returns 1 ghost) and after (returns 0).
3. Mutation check for guard 2: temporarily change `--base=main` to `--base=dev` in `openPr`, confirm the new test fails, revert.

## Follow-ups

- Audit other `rowsGiven &&`-style "unknown collapses to false" patterns in `we:scripts/conveyor/health-smells/` (file as its own item).
- Tighten remaining permissive `run` mocks elsewhere in `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`.
