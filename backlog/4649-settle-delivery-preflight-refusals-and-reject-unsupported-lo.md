---
bornAs: xp12azn
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/lib/repo-profile.mjs", "we:scripts/lib/__tests__/repo-profile-locus.test.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-settle.mjs", "we:scripts/operations/effect-executor.mjs", "we:scripts/operations/__tests__/effect-executor.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/__tests__/deliver-item-run.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "6439a623962b76d3cdbd94102d0465869541fd14"
tags: []
---

# Settle delivery preflight refusals and reject unsupported loci before spawning

Build #4620 exited on the intentional mixed-repo scope refusal before lane acquisition, outside the wrapper settlement catch. Move unsupported-locus admission before detached launch and make every preflight exit persist its real terminal reason. Preserve the unresolved multi-repo policy in #4289.

## Evidence

we:scripts/operations/deliver-item-wrapper.mjs:371; we:scripts/operations/deliver-item-wrapper.mjs:400; we:scripts/operations/deliver-item-run.mjs:180. Full incident evidence: we:reports/2026-09-30-builder-launch-misread-root-causes.md.

## Design

Share the existing locus capability check with admission; return a typed refusal without spawning unsupported work. Enclose wrapper preflight in terminal settlement as a backstop for older callers and races. Record the original reason and track which resources were actually acquired before cleanup; do not release another owner. Make early-child settlement monotonic against the parent post-spawn handle write. Do not implement multi-repo delivery or ratify #4289.

**Premise check (2026-09-30, against `main` 6439a623).** Still true: `git log` shows only the filing commits for #4649; `resolveDeliveryLocus` still throws at `we:deliver-item-wrapper.mjs:373` (before the `try` that opens at :400), and `runDeliverItemCli` (`we:deliver-item-run.mjs:180-190`) still only prints "lane and claim released best-effort" without settling. #4289 is unresolved, so the refusal stays a refusal.

**Scope correction.** `we:dispatch-lane.mjs` is a pure declaration (no `node:` import; its `taskTypeFor` is import-free), while `we:scripts/lib/repo-profile.mjs` (home of `repoKeyForScope`) imports `node:fs`/`node:os`. So admission cannot call the locus check from `we:dispatch-lane.mjs` directly; it must ride in as data from the io shell, like `raw.routing`. That needs the shared locus function to live outside the 2500-line wrapper, hence `we:scripts/lib/repo-profile.mjs` (and its existing test file) joins `scope:`.

**Mechanism.**
1. Move the set-of-repo-keys logic of `resolveDeliveryLocus` (`we:deliver-item-wrapper.mjs:737-744`) into `we:repo-profile.mjs` as a pure `deliveryLocusForScope(scope)`; the wrapper re-exports/uses it (keep `resolveDeliveryLocus` name and shape so existing tests stay green).
2. Admission: `we:dispatch-lane-io.mjs#readTick` (next to where it attaches `raw.routing`) attaches `raw.locus = deliveryLocusForScope(scope)` for build launches. In `we:dispatch-lane.mjs`'s dispatch compute step (`blocked(...)` chain near :1120-1160) add a `locus` block beside `task-type`/`route`: when `raw.locus?.multiRepo`, return `notRouted(...)` with a typed `holdReason` naming the repos and #4289 and the typed `{kind: 'unsupported-locus', keys}` as the `blocked('locus', …)` observed value (gates record `{name, pass, observed}`; add a `refusal` key to `notRouted` only if a consumer needs it). Zero effects are declared, so nothing detaches, no lane is acquired, no claim is taken. Fix the wrapper message: keys include `we`, so say "more than one repo", and cite #4289 (the old hash is stale).
3. Backstop: in `deliverItem`, move `resolveDeliveryLocus` and the multi-repo check inside the outer `try` (or a new enclosing one) so any preflight throw goes through `settleTerminal('wrapper-threw' | 'unsupported-locus', {error, releaseClaim: true})`. Track a single `laneAcquired` boolean set only after `acquireLane` returns, and have the outer catch release the lane only when it is set, so a throw before `acquireLane` releases nothing (today's `releaseClaimAndLane` on the catch path would target a lane this attempt never leased; the lane may belong to another owner by then). `runDeliverItemCli` also settles via `settleDispatchEffect` on its catch when `deliver` threw before the wrapper could, using the original `e.message` as the reason, and stops claiming a release happened.
4. Monotonic settle: `we:effect-executor.mjs#applyPendingEffects` (post-sink write at :383) re-reads the run from the store and patches ONLY that entry's `handle`/`expectedBy`, and only if it is still `in-flight`; if the child already settled it `applied`/`failed`, keep the terminal state and never write the stale in-memory `current`. This narrows (does not fully close; true compare-and-swap is a Follow-up) the race named in `we:deliver-item-settle.mjs`'s docblock without sleeps. Update that docblock.

## MVP

Musts only:
- Typed `unsupported-locus` refusal at dispatch admission (no spawn, no lane, no claim) with the #4620 scope.
- Whole wrapper preflight inside terminal settlement, original reason preserved, cleanup limited to actually-acquired resources.
- Early-child settle cannot be reverted by the parent's post-spawn write.
- Truthful CLI log line (no false "released" claim).

Out of MVP (see Follow-ups): multi-repo delivery itself (#4289), the envelope-vs-record acknowledgement bug (#4647) and claimless reconciliation (#4648).

## Test plan

1. New `we:scripts/lib/__tests__/repo-profile-locus.test.mjs` (no repo-profile test file exists; add it to `scope:`; `deliveryLocusForScope` returns keys only and so stays pure): `deliveryLocusForScope('we:a,plateau-app:b')` is `multiRepo:true, keys:['we','plateau-app']`; single-repo and empty scopes unchanged. Red before: function does not exist.
2. `we:scripts/operations/__tests__/dispatch-lane.test.mjs`: a build read with `raw.locus.multiRepo` yields `dispatching:false`, `holdReason` citing #4289, and zero declared effects. Red before: verdict dispatches.
3. `we:scripts/operations/__tests__/dispatch-lane.test.mjs`: single-locus and absent `raw.locus` (hand-built fixtures) still dispatch (regression guard).
4. `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`: multi-repo scope passed straight to `deliverItem` with a real temp run-store and an in-flight effect: effect becomes `failed` with the multi-repo reason intact; claim released; no lane lease appears in the temp lane pool (`deliverItem` has no injection point for `acquireLane`/`releaseClaimAndLane`, so observe real state: temp run-store dir via the env override `createFileRunStore` honours, plus a temp pool dir). Red before: the throw escapes, effect stays `in-flight`.
5. Same file: `acquireLane` itself throws (or the locus check does, before it): a `laneAcquired` flag is false, so no lane release is attempted and a sibling lane's lease seeded in the temp pool is untouched; the claim is still released and the effect settled. Red before: the outer catch releases the lane unconditionally. (A throw after a real acquire already releases that lane today; unchanged.)
6. `we:scripts/operations/__tests__/effect-executor.test.mjs`: sink returns a handle after a simulated child already wrote `applied`; the final stored status stays `applied`. Also the normal order still ends `in-flight` with handle. Red before: status reverts to `in-flight`.
7. `we:scripts/operations/__tests__/deliver-item-run.test.mjs`: `deliver` throws; exit code 1, reason on stderr contains the original message, no "released" claim, settle called once. Needs a new `settle = settleDispatchEffect` injection param on `runDeliverItemCli`'s io object (`we:scripts/operations/deliver-item-settle.mjs` is already in scope via the settle import; add it to `scope:` if edited).

## Proof plan

- Real boundary probe, isolated temp run store and temp lane pool: drive the actual dispatch operation CLI (`node we:scripts/operations/run.mjs dispatch-lane --json`, with the io shell's `raw.locus` wiring live and a temp backlog holding a card with) the #4620 scope. Record that stdout carries the typed refusal, the pool has no new lease, no detached process exists, and the run record has no `in-flight` effect. Then run the real `we:deliver-item-run.mjs` child with the same scope against a pre-seeded `in-flight` record and show it ends `failed` with the reason and that a seeded foreign lease is byte-identical before and after. Save before/after output in the delivery record.
- Soak break (per Done-when 2), with the disposable observer instance; note that daemon deployment is a manual step of the builder, not faked.

## Done when

1. A real isolated operation/child-process probe with the #4620 mixed scope rejects before agent spawn and lane acquisition, and writes a typed refusal. An injected wrapper preflight throw with a real temporary run store becomes terminal with its reason preserved, including parent/child write ordering; no unrelated lane lease is released.
2. Soak break: stop changes for at least 30 minutes after deployment to a disposable observer-controlled instance; let at least three normal ticks observe the refusal alongside one supported delivery. Record no repeated unsupported spawns, no ghost in-flight row, and no foreign lease mutation. Preserve the break and before/after evidence in the delivery record.

## Follow-ups

Named future items (builder files them, not prepare): a generic compare-and-swap for every effect type's post-sink write in `we:effect-executor.mjs` (this item only makes the dispatch effect monotonic); `check:standards` rule that any `throw` before the wrapper's settlement region is forbidden.

The diagnosis-only lane could not run its gates: the sandbox denied the verifier marker and the standards admission lock. Run both gates in the implementing lane with normal repository permissions; do not bypass either.

Testing lesson (2026-10-01): an early child failure must halt the parent driver as well as preserve the stored terminal status; otherwise the driver may immediately retry the effect. The isolated CLI probe supplies external reads, so it cannot substitute for normal observer ticks.

Keep serializer-to-consumer and process-lifecycle probes at the real boundary; helper-only fixtures did not reveal this incident. Record testing lessons here, not in shared agent documentation.


## Progress

2026-10-01 — Scoped implementation in the review checkout; no commit, push or PR.

- Before: the new regressions against the original implementation reported 12 failures (three supported/legacy admission controls passed). The missing shared locus function, admitted mixed scope, unsettled wrapper preflight, false CLI release claim, and both early-child terminal states reverting to `in-flight` were observed.
- Real-process before probe: temporarily restored the four original production modules from HEAD, ran the boundary tests, and restored the working edits in a `finally` block. The actual child exited 1 with the old “lane and claim released best-effort” text; the temporary run record remained `{status:"in-flight", result:null, error:null}`. The actual operation CLI returned `dispatching:true`, lane 15 and “cleared for build on lane 15”; the existing lane-checkout sink guard then refused it. No agent was launched for the before probe.
- After: shared `deliveryLocusForScope` in we:scripts/lib/repo-profile.mjs feeds we:scripts/operations/dispatch-lane-io.mjs. The pure declaration records `{name:"locus",pass:false,observed:{kind:"unsupported-locus",keys:["we","plateau-app"]}}` and declares zero effects. Single-repo and legacy reads retain their behavior.
- After: we:scripts/operations/deliver-item-wrapper.mjs settles session/locus/telemetry/acquisition preflight errors and limits lane cleanup to a successful acquisition. we:scripts/operations/deliver-item-run.mjs provides an idempotent settlement backstop, including provider selection errors, without asserting cleanup happened.
- After: we:scripts/operations/effect-executor.mjs re-reads the durable run after the dispatch sink and preserves child terminal state and other fresh fields. A child failure returns an error to halt the parent driver instead of immediately retrying the failed dispatch. The remaining read/write CAS window is explicitly documented in we:scripts/operations/deliver-item-settle.mjs.
- Real-process after probe: we:scripts/operations/__tests__/deliver-item-run.test.mjs runs the actual child with the historical 23-path #4620 scope. It exits 1; the on-disk effect becomes `failed`, result `unsupported-locus`, with “more than one repo (we, plateau-app)” and #4289 in the original error. The real build claim disappears; the seeded foreign lane lease remains byte-identical; no additional lane appears.
- Operation boundary after probe: the same test runs `node we:scripts/operations/run.mjs dispatch-lane --num=4620 --json` against a temporary backlog/run store/pool. The actual loader, IO locus wiring, declaration, serializer and persistence run; external planner/Git/GitHub reads are fixture inputs and async spawning is a fatal tripwire. Output is `stopped:"complete"`, `dispatching:false`, `inFlight:[]`, the typed locus gate above, and zero stored effects. Foreign lease bytes are unchanged. This is a CLI boundary regression, **not** a normal daemon tick or the required observer soak.
- Final targeted verification: **601/601 passed** across the five scoped suites, including both real file-store/child-process ordering cases (`applied` and `failed`). The supported trace compatibility correction also passed **294/294** tests across we:scripts/operations/__tests__/dispatch-eligibility.test.mjs and we:scripts/operations/__tests__/dispatch-lane.test.mjs without editing or weakening the eligibility test: only an unsupported locus adds a blocking trace entry.
- `node we:scripts/verify-lane.mjs` was run twice. The final run selected 101 targets, executed 184 suites, and reported **8,884 passed / 6 failed** (8,890 tests). The remaining failures are three each in we:scripts/operations/__tests__/restart-runner-io-real.test.mjs and we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs. Direct `/bin/ps` execution returns “Operation not permitted” in this sandbox; those production readers catch the denied call and return `null`, matching the failed real-process assertions. The marker remains red; no test, gate, permission check or process-liveness guard was weakened.
- Standalone `npm run check:standards` completed successfully: **0 errors**, 5,065 warnings. `git diff --check` is clean. All implementation/test edits are within the declared file scope; only the permitted locus test file was added. Shared agent documents were not edited.
- Verification lesson: run heavy suites and the standalone standards command as separate tool jobs. The chained invocation retained an admission slot while the nested standards process waited; the waiting jobs were cancelled, their own PID-specific admission state was cleaned up, and the normal gates were rerun. No other lane's lease was released and admission was not bypassed.
- Soak remains pending: no disposable observer-controlled deployment has been identified. Requested the instance/observer while continuing implementation. No deployment, elapsed break, normal ticks or supported delivery is claimed. Done-when 2 remains unsatisfied; the card must not be represented as complete on unit/boundary evidence alone.

Resolution is intentionally pending: the final lane gate is red under sandbox process-table restrictions and the required deployed observer soak has not occurred. `node we:scripts/operations/run.mjs resolve --ref=4649` has not been run because the card's Done-when criteria are not yet met. No commit, push or PR was created.
