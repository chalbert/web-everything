---
bornAs: xn96zu1
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lane-whois.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-28"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "50da0dc5c82df43f845c480c430b6e6430785afc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2884's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-salvage.mjs:214` — Add a real-git test to we:lane-salvage.test.mjs that leaves a deletion in place and asserts the lane eventually reads quiet, using an injected clock or a deletion-age source. That decides the class of 'fallback that can never age out'.
2. `we:scripts/conveyor/lane-pool-health-watch.mjs:716` — Add a health-watch test that feeds a `{kept:true, keptReason}` outcome to the plain summary path and asserts the printed reason is `keptReason`.
3. `we:scripts/lib/lane-salvage.mjs` — A lint rule or write-gate forbidding passing arrays containing potential `undefined` values directly to `.includes()` without a `.filter(Boolean)` step.
4. `we:scripts/lane-whois.mjs` — A lint rule or write-gate forbidding passing arrays containing potential `undefined` values directly to `.includes()` without a `.filter(Boolean)` step.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2884@ee7f01169723c1f9f8d7ab4afe6dff36158db247

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-salvage.test.mjs we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs we:scripts/__tests__/lane-whois.test.mjs` — the new cases below fail on current `main` (deletion never ages out; `formatSalvageKeptLine` does not exist) and pass after.

## Design

**Premise check (against `main` @ 50da0dc5c):** the four owed guards are still owed, but the line numbers in the list above have drifted and two of the four describe a defect that is already fixed at the source.

1. **Deletion can never age out — REAL, still present.** `newestContentMtimeMs` (`we:scripts/lib/lane-salvage.mjs`, the `scan` helper) does `bump(m === null ? Date.now() : m)` for any dirty path it cannot `stat`. A `git rm`'d / `rm`'d tracked file stays dirty until someone commits it, stays unstatable, and so reads "changed just now" on every call — `salvageEligibility` then refuses the lane forever (`elapsedMs < quietMs`). The fix the guard needs: give the deletion a real age. Use the mtime of the nearest existing ancestor directory of the missing path (`rm`/`git rm` bump the parent directory's mtime, and it then holds still), falling back to `Date.now()` only when no ancestor can be statted (fail-closed, unchanged). The existing test "a STAGED DELETION … still reads as recent" keeps passing because a fresh deletion's parent dir mtime is fresh.
2. **Kept-reason line — the code is already right, but untestable.** The plain-summary line `kept — ${o.keptReason || o.reason || 'unknown'}` lives inside the `if (IS_CLI)` block of `we:scripts/conveyor/lane-pool-health-watch.mjs` (~line 799), so no unit test can reach it. Extract a tiny pure exported `formatSalvageKeptLine(o)` (same string, same precedence) and call it from the CLI block; the test feeds `{kept:true, keptReason}`.
3. **`.includes(undefined)` in lane-salvage — already structurally fixed.** The only array-membership read of session ids is `agentsInLane` (`we:scripts/lib/lane-salvage.mjs:107`), which builds `new Set(sessionIds.filter(Boolean))`. The one `.includes(` left in the file (`:503`) is a string `includes`, not an array. A lint rule here would have nothing to flag.
4. **Same in lane-whois — already structurally fixed.** `we:scripts/lane-whois.mjs:420` passes `[lease?.ownerSession, last?.ownerSession, last?.workerSession, last?.session]` (routinely containing `undefined`) into `liveAgentInLane`, which filters. `we:scripts/lane-whois.mjs` has no `.includes(` of its own. The chokepoint is the single guard; what is missing is a test that pins it.

A general lint/write-gate for "array-with-possible-undefined into `.includes`" cannot be decided statically (no types in `.mjs`), so it is not built; the prevention for 3+4 is a behavioural test on the chokepoint, which fails if the `filter(Boolean)` is ever dropped.

## MVP

Musts only:
- M1: `newestContentMtimeMs` ages a deletion via the nearest-existing-ancestor mtime; real-git test proves an aged deletion reads quiet through `laneLivenessGate`/`salvageEligibility` and a fresh one still reads recent. The ancestor walk is bounded: it stops at the scanned dir `d` (never above the lane directory). Also update the stale "maximally fresh (`Date.now()`)" wording in the `newestContentMtimeMs` docblock and in the comments at `we:scripts/lib/__tests__/lane-salvage.test.mjs` (~:134-139, :157).
- M2: extract `formatSalvageKeptLine` and test the `keptReason` precedence (`keptReason` > `reason` > `'unknown'`).
- M3: pin the `undefined`-session-id chokepoint with a test in `we:scripts/lib/__tests__/lane-salvage.test.mjs` (pure `liveAgentInLane`) and one in `we:scripts/__tests__/lane-whois.test.mjs` (a lane whose ledger entry has no session, with an agent listing entry that has no `sessionId` and a foreign cwd, must report `liveOwner:false`).

Deliberately OUT (see Follow-ups): the two lint rules / write-gate for guards 3 and 4.

## Test plan

- `we:scripts/lib/__tests__/lane-salvage.test.mjs` › `newestContentMtimeMs (real git)` › **aged deletion reads quiet**: `git rm` a file, back-date the parent dir and `.git/logs/HEAD` by 2h, assert `Date.now() - newest >= 60 min`. RED today: the `Date.now()` fallback returns "now".
- same describe › **fresh deletion still reads recent** (the existing case, kept) — guards against an over-aged fix.
- same describe › **deletion whose parent dir is also gone uses the nearest SURVIVING ancestor**: `rm -rf` a tracked subdir, back-date the lane root and `.git/logs/HEAD` by 2h, assert the result is old (RED today: `Date.now()`). The no-statable-ancestor `Date.now()` branch is covered by a pure helper `nearestAncestorMtimeMs(path, stop, stat)` with an injected throwing `stat` (asserts it returns `null`, which the caller turns into `Date.now()`).
- `we:scripts/lib/__tests__/lane-salvage.test.mjs` › `liveAgentInLane` › **undefined/null session ids never match an agent with no `sessionId`**: `liveAgentInLane([{state:'working', cwd:'/elsewhere'}], '/pool/lane-1', [undefined, null])` is `false`. Mutation check: delete the `.filter(Boolean)` and it goes `true` (`ids.has(undefined)`), so it reddens for the stated reason.
- `we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` › **`formatSalvageKeptLine`**: the helper returns ONLY the reason text (the CLI keeps its own 4-space indent and `lane-${o.lane}: kept — ` prefix): `{kept:true, keptReason:'live agent'}` → `live agent`; only `reason` → that; neither → `unknown`. RED today: the export does not exist.
- `we:scripts/__tests__/lane-whois.test.mjs` › **ledger entry without a session + session-less foreign agent → `liveOwner:false`** (same mutation reasoning as above).

## Proof plan

- Before/after on the live shape: in a throwaway real-git repo under the job's lane clone, `git rm` a tracked file, back-date its parent dir, and run `node -e` importing `newestContentMtimeMs` + `laneLivenessGate({quietMs:30*60_000, readAgents:()=>[], readCwds:()=>[]})` — before: `eligible:false, "changed 0 min ago"`; after: `eligible:true`. Paste both outputs in the PR body.
- Call `formatSalvageKeptLine` via `node -e` on the three shapes (`keptReason`, `reason` only, neither) and show the diff of the old inline expression vs. the new call in the CLI block (no live pool touched — a kept candidate is not guaranteed to exist).
- Mutation proofs (drop `.filter(Boolean)`; revert the ancestor-mtime fallback) each redden exactly the named tests; record the red/green in the PR body.

## Follow-ups

- F1: a write-gate / lint rule flagging `.includes(<expr that can be undefined>)` where the array comes from optional chaining (`[a?.x, b?.y].includes(...)`) — heuristic only, needs its own design and a false-positive budget (guards 3 and 4 as literally worded).
- F2: generalize "unstatable dirty path ⇒ fresh" in any other liveness reader that copies this fallback (none found in this pass; audit only).
- Testing lesson: `git rm` removes empty ancestor directories; retain a tracked sibling when a fixture must distinguish immediate-parent aging from a removed-parent ancestor walk.
- F3: a `git mv` preserves the file's mtime, so a fresh rename can already read old — existing gap in the same reader, separate fix.

## Progress

2026-09-30 — implemented M1–M3 within the declared scope. Missing dirty paths now use a bounded nearest-surviving-ancestor mtime; unstatable ancestors still fail closed. Extracted `formatSalvageKeptLine` and retained the CLI prefix/indent. Added session-less foreign-agent regressions at the shared guard and real whois CLI, with no new lint gate.

Before/after real-git proof (inline Node probe importing `newestContentMtimeMs` and `laneLivenessGate`, empty agent/cwd readers, 30-minute quiet period; tracked file deleted with `git rm`, root and HEAD reflog backdated two hours):

```json
{"ageMinutes":0,"eligible":false,"reason":"lane content changed 0 min ago (< 30 min quiet period)"}
{"ageMinutes":120,"eligible":true,"reason":"unleased, no live owner or process, quiet"}
```

The disposable repository was under the system temporary directory, outside the checkout, to honor the job's no-helper-files instruction. No live pool was touched.

Formatter inline Node proof: `["live agent","fallback","unknown"]` for keptReason plus reason, reason only, and neither. CLI change in we:scripts/conveyor/lane-pool-health-watch.mjs:

```diff
-            else timestampedStderr(`    lane-${o.lane}: kept — ${o.keptReason || o.reason || 'unknown'}\n`);
+            else timestampedStderr(`    lane-${o.lane}: kept — ${formatSalvageKeptLine(o)}\n`);
```

Regression proof: both aged-deletion cases failed against the original fallback (age near zero versus the required one hour), and all three formatter cases failed because the export did not exist. The first staged-deletion fixture exposed that `git rm` removes empty parent directories; adding a retained tracked sibling made that case specifically exercise a surviving immediate parent, and the corrected fixture was rerun red before implementation. Each aged-deletion case now performs three scans and liveness checks with the deletion still present, pinning the persistent-deletion behavior without a wall-clock sleep. The existing fresh-deletion and racy-index regressions remain intact; a throwing-stat helper test proves the ancestor walk stops at the scanned root and returns null.

Mutation proof: removing `sessionIds.filter(Boolean)` in we:scripts/lib/lane-salvage.mjs reddened exactly the two selected session-less-agent cases (pure `liveAgentInLane` and real whois CLI: expected false, received true; 2 failed). Restoring the perpetual `Date.now()` deletion fallback reddened exactly the two selected aged-deletion cases (2 failed). Both mutations were restored immediately afterward. The complete three-file suite passed before mutation: **3 files, 138 tests**; the wider lane gate also passed all three scoped suites after restoration.

Wider verification: `node we:scripts/verify-lane.mjs` ran its selected dependency/reference set: **138 files passed, 2 failed; 5,954 tests passed, 6 failed**. All six failures are real-process-table assertions in we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs and we:scripts/operations/__tests__/restart-runner-io-real.test.mjs. A direct `/bin/ps -p $$ -o ppid=,command=` probe exited 126 with `/bin/bash: /bin/ps: Operation not permitted`; this sandbox cannot supply the real process table those tests require. No tests, gates, or out-of-scope implementation were changed to conceal that limitation. The lane verification marker remains red and needs a rerun in an environment that permits process-table reads.

Final checks: `npm run check:standards` passed with **0 errors** (4,547 warnings); `git diff --check` passed. `node we:scripts/operations/run.mjs resolve --ref=4434` completed successfully with one effect applied, setting this card to resolved. No commit, push, or PR was created. Wider verification still requires the process-table-capable rerun noted above.
