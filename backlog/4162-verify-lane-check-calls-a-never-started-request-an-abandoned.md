---
bornAs: xpvbamr
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/__tests__/lane-verify.test.mjs", "we:scripts/__tests__/verify-lane.test.mjs"]
dateOpened: "2026-09-25"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# verify-lane check calls a never-started request an abandoned backgrounded run

Live 2026-09-25: after we:scripts/verify-lane.mjs request with no runner alive, check (and the open-pr finish-guard via we:scripts/lib/lane-verify.mjs verifyGateDecision) reported 'abandoned — a backgrounded run that never completed' and told the caller to re-run in the foreground. The run was never started, only requested and never picked up. Distinguish requested-not-started from started-then-abandoned (the marker already records the request; add whether a gate ever began, e.g. the gate-execution-starting signal verify-dispatch watches), and give the correct next step for each. Prove on a live case.

## Progress

- Premise holds on main. Scope widened only to add the two existing test files.
- `we:scripts/verify-lane.mjs:356` stamps the same `running` marker for both `request` and `verify` (`verifyStartBody`). `request` then exits at `we:scripts/verify-lane.mjs:367-369`. Nothing in the marker says whether a gate ever began.
- The gate-start moment exists only as a stderr line: `we:scripts/verify-lane.mjs:410` (`⏱ gate execution starting`), watched by `we:scripts/conveyor/verify-dispatch.mjs:142` (`GATE_STARTED_MARKER`). It is never written to the marker.
- `we:scripts/lib/lane-verify.mjs:536-553` (`verifyGateDecision`, `running` branch) words every past-TTL `running` marker as "abandoned — a backgrounded run that never completed" and says "re-run ... (foreground, blocking)". The opted-out degrade at `we:scripts/lib/lane-verify.mjs:544-548` says "a backgrounded run that never completed" too.
- Not delivered: `git log -S gateStartedAt` finds nothing.
- Boundary with sibling #4161: that card makes `request` refuse when no runner is alive. This card only records whether a gate started and fixes the `check`/finish-guard wording and next step. It does not touch `we:scripts/conveyor/verify-dispatch.mjs` or add a liveness read.

## Design

Record one new marker field, `gateStartedAt`, and branch the `running` verdict wording on it. No new status or reason, so every existing reader keeps working. `waitForVerifySettle` (`we:scripts/lib/lane-verify.mjs:387`) still polls `running`. The `request` test that pins "no new vocabulary" (`we:scripts/__tests__/verify-lane.test.mjs:263`) still holds.

1. `verifyStartBody` (`we:scripts/lib/lane-verify.mjs:244`): add `gateStartedAt: null` to the returned body.
2. `we:scripts/verify-lane.mjs`, just before the stderr line at `:410` (after admission, after `preGateTreeHash`): if `MODE !== 'run'`, re-read the marker. If it is still the record this process stamped at `:356` (same `sha`, same `startedAt`, same `runId` or both absent), write it back with `gateStartedAt: new Date().toISOString()` via `writeMarker`. Otherwise leave it alone. An overlapping `request` may have re-stamped it, and the existing compare-and-set posture (`:481-490`) says never clobber another run's record. Keep the start stamp in a const (e.g. `startStamp`) so the compare is exact. Do not edit the `:356` line text itself; `we:scripts/lib/__tests__/verify-lane-gate.test.mjs:574` pins it.
3. New pure helper in `we:scripts/lib/lane-verify.mjs`: `verifyGateStarted(record)` returns `true` if `record.gateStartedAt` is a string, `false` if the key is present and `null`, and `null` (unknown) if the key is missing (a legacy marker written before this change).
4. `verifyGateDecision` `running` branch (`we:scripts/lib/lane-verify.mjs:536-553`): compute `started = verifyGateStarted(rec)`. Add `gateStarted: started` to both returned verdicts (the `running` refusal and the past-TTL `untracked` degrade). Keep `ok`, `status`, `reason` exactly as today. Change only `detail`:
   - `started === false`, fresh: `verification for <sha> was REQUESTED at <startedAt> but no gate has started yet` + (if `rec.runId`) `— a runner picked it up and it is queued for a heavy-command slot` else `— no runner has picked it up yet`. Next step: `wait with \`node we:scripts/verify-lane.mjs check --wait=540000\``.
   - `started === false`, past TTL: `verification for <sha> was REQUESTED at <startedAt> and never started — no gate ran (not a backgrounded run that died)`. Next step: `a request is only served by a verify-dispatch runner tick; check the runner is alive (\`node we:scripts/operations/run.mjs runner-activity --json\`), or run \`node we:scripts/verify-lane.mjs\` yourself in the foreground`. Must NOT contain the words `abandoned` or `backgrounded`.
   - `started === true`, fresh: `still in-flight (gate started <gateStartedAt>)`; same next step as today.
   - `started === true`, past TTL: `abandoned — a gate started at <gateStartedAt> and never finished (the run was killed or backgrounded)`. Next step as today: re-run `node we:scripts/verify-lane.mjs` to completion, foreground.
   - `started === null` (legacy marker): today's wording, unchanged.
   - The opted-out past-TTL degrade (`:544-548`) uses the same started/not-started phrase in place of `a backgrounded run that never completed`.
5. `verifyFinishBody` (`we:scripts/lib/lane-verify.mjs:285`): carry `gateStartedAt: base.gateStartedAt ?? null` as an audit field. No gate logic reads it on a terminal record.

Why a marker field and not reading verify-dispatch logs: `check` and `pr-land`'s finish-guard (`we:scripts/pr-land.mjs:641`) read only the marker. The marker is the single shared record, so the signal belongs there.

## MVP

Steps 1-4 above. Step 5 is one line and ships with it.

## Test plan

Vitest. Both files import from `vitest`.

`we:scripts/__tests__/lane-verify.test.mjs`, new `describe('#4162 — requested-not-started vs started-then-abandoned')`:
- `verifyStartBody stamps gateStartedAt: null` — the start body has the key, value `null`.
- `verifyGateStarted: string → true, null → false, missing key → null`.
- `a past-TTL requested marker that never started says REQUESTED and never started, not abandoned/backgrounded` — record = `verifyStartBody(...)`, `nowMs` past TTL, `requireVerified: true`. Expect `ok:false`, `reason:'verify-unfinished'`, `gateStarted:false`, detail matches `/REQUESTED/` and `/runner-activity/`, detail does NOT match `/abandoned|backgrounded/`.
- `a fresh requested marker with a runId says queued for a slot` — detail matches `/queued/`.
- `a past-TTL marker whose gate started says abandoned and to re-run in the foreground` — record has `gateStartedAt` set. Expect `gateStarted:true`, detail matches `/abandoned/` and `/foreground/`.
- `a legacy past-TTL marker (no gateStartedAt key) keeps the old abandoned wording` — `gateStarted:null`, detail matches `/abandoned/`.
- `opted-out past-TTL never-started marker degrades to untracked without the backgrounded claim` — `requireVerified:false`; `ok:true`, `reason:'untracked'`, detail does NOT match `/backgrounded/`.
- Existing tests at `:80-99` and `:457-460` stay green (they use `verifyStartBody`, so they now take the never-started path; update the one at `:87-92` to assert `/never started/` instead of `/abandoned/`, and add a sibling with `gateStartedAt` set that keeps `/abandoned/`).

`we:scripts/__tests__/verify-lane.test.mjs`, in the `request (#3105)` describe:
- `request leaves gateStartedAt null on disk` — after `runRequest('true')`, marker has `gateStartedAt === null`.
- `a verify run stamps gateStartedAt before the gate runs` — a fixture gate command that copies the marker file into the temp dir as a "seen" copy, then exits 0. After `runVerify`, the seen copy's `gateStartedAt` is a string and the final marker is `green`.
- `check on a never-started request says REQUESTED, not abandoned` — `runRequest('true')`, then rewrite the marker's `startedAt` to 2 hours ago, run `check --json`. Expect `reason:'verify-unfinished'`, `gateStarted:false`, detail without `/abandoned|backgrounded/`.

## Proof plan

Live case: a `request` with no gate ever run, past the 30-minute TTL.
1. Before (on main): in a scratch lane clone, run `node we:scripts/verify-lane.mjs request --gate=true`. Edit `.git/.lane-verify` `startedAt` to 2 hours ago (or wait 30 min with no runner). Run `node we:scripts/verify-lane.mjs check --json`. Capture the detail: "abandoned — a backgrounded run that never completed ... foreground".
2. After (on the lane): same steps. Capture: detail says REQUESTED and never started, names `runner-activity`, and `gateStarted:false`.
3. Started-then-killed: run `node we:scripts/verify-lane.mjs --gate="sleep 600"` in the foreground, kill it with SIGKILL after the `⏱ gate execution starting` line. Age `startedAt` past TTL. `check --json` must say abandoned with `gateStarted:true`.
Paste all three outputs in the PR body. Stop any process you started by PID.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/lane-verify.test.mjs we:scripts/__tests__/verify-lane.test.mjs` passes, with the new #4162 cases in `we:scripts/__tests__/lane-verify.test.mjs` and `we:scripts/__tests__/verify-lane.test.mjs` failing before the change (no `gateStartedAt`, old "abandoned — a backgrounded run" wording) and passing after.
2. A `request`-stamped marker carries `gateStartedAt: null`; a `verify` run sets it to an ISO time just before the gate starts.
3. `check` and `pr-land`'s finish-guard keep `status:'running'` / `reason:'verify-unfinished'`, add `gateStarted`, and word never-started vs started-then-abandoned differently, each with its own next step.
4. A legacy marker without `gateStartedAt` keeps today's wording.
5. Proof plan outputs (before/after, plus the killed-gate case) are in the PR body.

## Follow-ups

- #4161 (sibling): make `request` refuse fast when no runner is alive. This card only fixes the diagnosis after the fact.
