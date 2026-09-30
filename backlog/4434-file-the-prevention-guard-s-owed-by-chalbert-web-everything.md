---
bornAs: xn96zu1
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/lane-whois.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:scripts/__tests__/lane-whois.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
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
- F3: a `git mv` preserves the file's mtime, so a fresh rename can already read old — existing gap in the same reader, separate fix.
