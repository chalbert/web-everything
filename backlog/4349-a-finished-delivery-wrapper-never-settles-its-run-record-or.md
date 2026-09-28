---
bornAs: xaksc71
kind: story
size: 3
priority: high
status: resolved
scaffoldedBy: "investigate-dispatch-noop-lane-3-d65b5d9a"
dateScaffolded: "2026-09-28"
scope: ["we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "2aec20c4157a2a774abeef5af8fb5459c6f569fa"
tags: ["build-dispatch", "blocker"]
---

# A finished delivery wrapper never settles its run record or build claim: no-op dispatches hold a cap slot for hours then re-dispatch into the same failure

When the detached delivery wrapper exits with a known outcome (`not-ready`, `gate-red`, `blocked-mid-build`, …), nothing records that outcome where the dispatcher looks. There are two places:

- **The run record.** Its `conveyor.dispatch-delivery-agent` effect stays `in-flight` until `expectedBy`, which is 90 minutes.
- **The build-dispatch claim.** It stays held for its 240-minute TTL. It is retired only when a PR delivers the item or the item leaves the cleared queue.

So a build that stopped after about a minute reads as "building" and takes one of the 4 cap slots for hours. The card stays `open` and cleared. When the holds age out, it is dispatched again into the same failure. That is why the effect reports `in-flight` when nothing is running.

## Evidence (2026-09-28, live)

- Run record `dispatch-lane-28754b06…json` (#2720): effect `status: in-flight`, `handle: pid:24393`, `expectedBy: 2026-09-28T15:38:01Z`, top-level `pending: {kind: effect, step: dispatch}`. Yet `ps -p 24393` shows no process. The wrapper log (`wev-control/.operations/delivery-dispatch-logs/conveyor-2720.log`) ended at 10:09 ET with `finished — not-ready (…)`. #3604 is the same (`pid:20516`, dead, `not-ready`).
- `listBuildDispatchClaims()` at 14:2xZ returned `[{num:3604, owner:Mac:37292}, {num:2720, owner:Mac:37292}]`. Claim TTL is `DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES = 240` (`we:scripts/conveyor/build-dispatch-claim.mjs` L30).
- The daemon retires a claim only on a delivering PR or on "left the cleared queue" (`we:skills-src/conveyor/build-dispatch-daemon.mjs` L124-130). Its live effects stub run-store liveness out: `listRunStoreInFlight: () => []` (L285).
- The wrapper's `finish()` (`we:scripts/operations/deliver-item-wrapper.mjs` L512-517) only closes a telemetry span. It writes nothing to the run store and releases no build claim.
- The only settler of the effect is the observer in `createDispatchObservers` (`we:scripts/operations/dispatch-lane-io.mjs` L2443-2507). No launchd job runs it (`launchctl list | grep com.we` shows no wake/observer job). Even when it runs, a dead `pid:` handle gives `unresolved` ("close the entry out" by hand). It never reads the wrapper's own known outcome.

## Scope

- Make the wrapper's exit write back its outcome. The wrapper (`we:scripts/operations/deliver-item-run.mjs`) already knows its run id/effect key, or can be passed them on argv. On every `finish()`/throw it should settle the effect: `applied` with the outcome as result, or `failed` for a pre-build stop. Use the existing `resolveInFlight` seam; do not add a new store.
- Release the build-dispatch claim on a non-PR terminal outcome (`not-ready`, `gate-red`, `gate-blocked`, `blocked-*`, wrapper threw).
- Make the build-dispatch daemon's liveness read the real run-store in-flight rows. Today it is stubbed to `[]` in live mode. Retire a claim whose `pid:` handle is dead with a settled outcome.
- Stop the re-dispatch loop: after a `not-ready` outcome, route the card to a hold with the reason, so the same failure does not fire again every 90 minutes.

## Risks

- Settling must stay fail-closed for a genuinely unknown outcome, per #3073. A wrapper killed mid-build must still land as indeterminate, never `applied`.
- Releasing a claim too early reopens the restart double-dispatch the claim exists to close. Release only on a terminal outcome the wrapper itself wrote.

## Done when

1. **Executable** — a unit test drives the wrapper to a `not-ready` finish. It asserts the run-store effect goes `in-flight` → settled with `result.outcome = 'not-ready'`, and that the build-dispatch claim for the item is released. It fails today (the effect stays `in-flight` and the claim stays held).
2. A test that kills the wrapper before `finish()` still leaves the effect `in-flight`/indeterminate (no false settle).
3. A daemon test: with a stale `pid:` claim whose run record is settled, the next tick does not count the item as building.
4. **Live proof** — a real builder dispatch that finishes (any outcome):
   - within one tick of the wrapper's exit, the run record reads settled with the wrapper's outcome;
   - `listBuildDispatchClaims()` no longer lists the item;
   - the daemon status line's `building` count drops.

   Attach the before/after run-record excerpt and claim listing.

## Progress

- Built: `we:scripts/operations/deliver-item-settle.mjs` (the thin `resolveInFlight` seam), `deliverItem`'s
  `settleTerminal` on every terminal exit (`not-ready`/`gate-red`/`gate-blocked`/`blocked-mid-build`/
  `blocked-on-infra`/`wrapper-threw`/`pr-opened`), the `runId`/`effectKey` thread from the dispatch sink →
  detached provider → `we:scripts/operations/deliver-item-run.mjs` argv → `deliverItem`'s `launch`, the
  build-dispatch HOLD primitive (`placeBuildDispatchHold`/`releaseBuildDispatchHold`/`listBuildDispatchHolds`),
  and the daemon's `listSettledBuilds`/`listHolds` reads (settled-outcome claim retirement + held-item
  candidate exclusion).
- Done-when 1-3: executable, real (unmocked internals) unit + integration tests all green locally
  (`we:scripts/operations/__tests__/deliver-item-settle.test.mjs`, the new `deliverItem (#4349 ...)` describe
  block in `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`,
  `we:scripts/conveyor/__tests__/build-dispatch-claim.test.mjs`,
  `we:scripts/operations/__tests__/dispatch-run-id-effect-key.test.mjs`, and the
  `runBuildDispatchTick - #4349 ...` describe block in
  `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`).
- Done-when 4 (live proof): reproduced the card's own incident shape (an `in-flight` run-store effect with a
  dead `pid:` handle + a held build-dispatch claim) against the REAL, unmocked
  `we:scripts/conveyor/build-dispatch-claim.mjs` / `we:scripts/operations/run-store.mjs` /
  `we:scripts/operations/deliver-item-settle.mjs` /
  `we:skills-src/conveyor/build-dispatch-daemon.mjs#runBuildDispatchTick` modules, on a throwaway scratch
  coordination root (never the host's live `~/workspace/.operations/coordination`, which a resident daemon
  actively owns). Before: claim held, effect `in-flight`, daemon counts it in-flight forever. After the
  wrapper's own settle (no release yet): the daemon's OWN next tick retires the claim on the settled outcome
  (Done-when 3's exact case). After the full real exit path (settle + release, as `deliverItem` now does):
  claim gone, effect `applied` with `result.outcome`, daemon `plan.inFlight` empty. Full transcript in the PR
  body.
- Fast-lane prepare: Codex plan review already run and folded in — the run-store contested-claim guard, the
  `acquireLane`-throws-before-inner-catch settle path, and the `applied`/`failed`-only settled-outcome read.
- Round-2 editor pass: fixed a missing `not-ready` hold fallback (an empty `report.reason` used to place no
  hold at all), tied the daemon's settled-outcome read to the CURRENT claim's own `claimedAt` (a stale row from
  an older, superseded attempt can no longer retire a fresh claim) and made it pick the newest row by
  `startedAt` rather than whichever `store.list()` returns last, made `settleTerminal` fire at most once per
  delivery (a throw after an earlier terminal branch already settled can no longer re-release a held claim or
  clobber its hold reason), fixed the `outcome`-always-wins merge order, corrected the no-`runId`/`effectKey`
  contract (claim release/hold still fire; only the run-store settle is skipped), reworded stale/no-longer-
  accurate docblocks, and undid the speculative `--release-hold` CLI flag added in the prior round.
- Gate: `we:scripts/verify-lane.mjs` requested + polled to green against the pre-converge HEAD.
- `/converge` (care: elevated, roundCap 2): round 1 panel found a real gap (only `not-ready` placed a
  re-dispatch hold; every other non-PR outcome settled+released with no hold, tightening the loop the card
  exists to close) plus coverage gaps; editor round 1 generalized the hold to every non-PR outcome. Round 2
  panel found a stale-claim-retirement race (a settled row from an older attempt could retire a fresh claim)
  plus more coverage/prose-accuracy gaps; editor round 2 tied retirement to the claim's own `claimedAt` +
  newest-`startedAt` selection, added a `settledOnce` guard, fixed the outcome-merge precedence, and reworded
  stale docblocks. Final panel: accept on all 5 lenses. Red-team (5 lenses, fresh identities): every finding
  routed `parallelizable: true` (never a blocker per the disposition rubric) — verdict **land**. Before
  reporting that verdict, applied one more cheap fix the red-team surfaced (hold-before-release ordering, so a
  crash between the two calls can no longer leave a window with neither a claim nor a hold) and verified
  in `we:scripts/operations/effect-executor.mjs` that production dispatch effects really do stamp `startedAt`
  on going in-flight (the red-team's "unverified claim" concern) — confirmed true, so the claim-vs-hold
  staleness check's fail-open-on-missing-timestamp path is only reachable by a legacy/back-compat row, not a
  live one, matching this codebase's established fail-open idiom; left as documented.
- Remaining: commit + open PR.
