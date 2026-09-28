---
bornAs: xaksc71
kind: story
size: 3
priority: high
status: open
scaffoldedBy: "investigate-dispatch-noop-lane-3-d65b5d9a"
dateScaffolded: "2026-09-28"
scope: ["we:scripts/operations/deliver-item-run.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs"]
dateOpened: "2026-09-28"
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
