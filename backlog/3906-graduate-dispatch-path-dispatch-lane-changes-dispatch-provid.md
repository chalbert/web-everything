---
bornAs: xbunbsg
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3902", "3901", "3897"]
scope: ["we:scripts/__tests__/dispatch-routing-table.test.mjs", "we:scripts/lib/__tests__/dispatch-supervisor.test.mjs", "we:scripts/operations/__tests__/dispatch-abort.test.mjs", "we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs", "we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-build-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-ci-heal-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-fix-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-marker-freshen.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-prepare-decision-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-prepare-wiring.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/__tests__/dispatch-provider-registry.test.mjs", "we:scripts/operations/__tests__/dispatch-sinks-root-hermeticity.test.mjs", "we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs", "we:scripts/operations/__tests__/dispatch-task.test.mjs", "we:scripts/operations/__tests__/run-store.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-provider-registry.mjs", "we:scripts/operations/dispatch-providers/__tests__/ci-heal-dispatch-routing.test.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/operations/dispatch-providers/ci-heal.mjs", "we:scripts/operations/dispatch-providers/fix.mjs", "we:scripts/operations/dispatch-providers/prepare-decision.mjs", "we:scripts/operations/dispatch-providers/prepare.mjs", "we:scripts/operations/dispatch-task-io.mjs", "we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/effect-executor.mjs", "we:scripts/operations/run-record.mjs", "we:scripts/operations/run-store.mjs", "we:scripts/operator/dispatch.mjs", "we:scripts/operations/__tests__/inflight-fail-closed.test.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:scripts/operations/delivery-agent-marker.mjs", "we:scripts/operations/__tests__/delivery-agent-marker.test.mjs", "we:scripts/operations/wake.mjs", "we:scripts/operations/__tests__/wake-cli.test.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/operations/__tests__/explore.test.mjs", "we:scripts/operations/runner-activity-io.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate dispatch path: dispatch-lane changes, dispatch providers and registry, dispatch-task from lane/mechanical-dispatcher to main

Ports 14 files (we:scripts/operations/dispatch-lane.mjs, we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/dispatch-provider-registry.mjs, we:scripts/operations/dispatch-providers/build.mjs, we:scripts/operations/dispatch-providers/ci-heal.mjs, we:scripts/operations/dispatch-providers/fix.mjs, we:scripts/operations/dispatch-providers/prepare.mjs, we:scripts/operations/dispatch-providers/prepare-decision.mjs, we:scripts/operations/dispatch-task.mjs, we:scripts/operations/dispatch-task-io.mjs, we:scripts/operations/effect-executor.mjs, we:scripts/operations/run-record.mjs, we:scripts/operations/run-store.mjs, we:scripts/operator/dispatch.mjs) plus their tests. On the critical path. we:scripts/operations/dispatch-lane-io.mjs is imported by ~25 modules and main also changed it: diff-merge. Main also changed these files, so each gets a diff-merge: we:scripts/operations/dispatch-lane-io.mjs, we:scripts/operations/dispatch-lane.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot ff1618065 of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

### Merge notes for #3906 (2026-09-22)

Merge base `ca7e68b71`. Conflict counts are from `git merge-tree` (the real 3-way result); single-base `ca7e68b71` counts in [brackets] where they differ.

**Designer rulings applied:** take the branch's throw in `defaultClaudeProvider`; keep main's `buildAgentArgv` argv with no `--session-id`.

**`we:scripts/operations/dispatch-lane-io.mjs`**
- Main: #3331 real `--bg` session id (`4ea206ce2` — `buildAgentArgv` drops `--session-id`; `defaultClaudeProvider` returns `parseBackgroundedId(stdout) || request.sessionId`; `listedSessionIds` also collects `id`); #3567 investigation kind; #3694 dispatch-eligibility (`raw.admission`).
- Branch: its own parallel #3331 fix (new `parseBackgroundedHandle` hex prefix, `isHandleListed` prefix match, `defaultClaudeProvider` **throws** on unparseable output); `WE_DISPATCH_KIND` on the spawn env; `spawnAgentToCompletion`; provider-registry routing (`routeDispatchProvider`, `pid:` detached handles, `isDispatchHandleLive`, `wrapper-pid` liveness source); action store / `guardedDispatch` / tick mutex (`actions`, `repo`, `owner`, `freshenCheckout` sink options); #3717/#3843 routing (`decideDispatchRoute`, `defaultReadScorecards`, `defaultReadSizePolicy`, `size` on items); #3840 `readItemDeliveryAgentOverride`; #3848 executed vendor.
- Trial merge: **7 conflicts** [6]:
  1. ~L859 `findItem` item shape — main side empty, branch adds `...size` spread → **take branch**.
  2. ~L1200 sink docblock "THE HANDLE…" → take branch text, but delete its sentence saying "`mintSessionId` and `--session-id` in the argv are kept" (contradicts ruling).
  3. ~L1244 "PROVEN AGAINST…" → take main (real-CLI 2.1.269 verification).
  4. ~L1279 provider-port paragraph → take branch.
  5. ~L1463 `defaultClaudeProvider` docblock → take branch (throw rationale).
  6. ~L1496 `defaultClaudeProvider` body → **take branch** (`WE_DISPATCH_KIND` env + `parseBackgroundedHandle` + throw); the env stamp is load-bearing for the guard-bash deny.
  7. ~L1577 `buildAgentArgv` docblock → **take main**. The code already auto-merged to main's argv (no `--session-id`), enforced by main's `we:scripts/operations/__tests__/dispatch-lane.test.mjs` ~L701 and `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` ~L70.
- Silent auto-merges to eyeball: `listedSessionIds` keeps main's `sessionId`+`id`; `stampLiveness`/`readTick` use branch `isDispatchHandleLive` prefix matching (works with main's short-id handles); fix the stray indentation on the `...inFlight,` line in the `stampLiveness` return.
- Dependencies (branch-only): `we:scripts/operations/action-dispatch.mjs`, `we:scripts/operations/action-store.mjs`, `we:scripts/operations/action-record.mjs`, `we:scripts/operations/tick-mutex.mjs`, `we:scripts/operations/session-role.mjs`, `we:scripts/lib/spawn-to-completion.mjs`, `we:scripts/operations/detached-dispatch.mjs`, `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/operations/delivery-agent-marker.mjs` (this card), `we:scripts/operations/dispatch-provider-registry.mjs`, `we:scripts/operations/dispatch-providers/{build,fix,ci-heal,prepare,prepare-decision}.mjs`. Nothing imported was renamed/removed on main (lease-reaper, pr-watch, queue-store, poc-branches exports all present).
- Main-side importers (19). Every export signature change is additive (new optional params), so nothing breaks at import. Behaviour changes that reach callers:
  - `we:scripts/operations/run.mjs` and `we:scripts/operations/ci-heal-pr-dispatch.mjs` → `createDispatchSinks` default provider is now `routeDispatchProvider`: `build`/`ci-heal`/`fix`/`prepare*` launches go to **detached mechanical providers**, not `claude --bg`. ci-heal-pr-dispatch already passes `actions`/`repo` (ignored on main today, activates `guardedDispatch` after). Branch we:scripts/operations/run.mjs also passes `freshenCheckout` (we:scripts/operations/run.mjs owned elsewhere).
  - `we:scripts/operations/runner-activity-io.mjs` → `stampLiveness` return now spreads `...inFlight` and can report `livenessSource: 'wrapper-pid'` (harmless); run-store root move handled below.
  - `we:scripts/operations/wake.mjs` → handled below.
  - Throw-instead-of-fallback: main's `we:scripts/operations/__tests__/dispatch-liveness-hardening.test.mjs` ~L399 asserts the fallback and must be updated.
  - Unaffected: `we:scripts/operations/review-dispatch.mjs` and `we:scripts/conveyor/reconcile-fix-dispatch.mjs` (`parseBackgroundedId` unchanged).

**`we:scripts/operations/dispatch-lane.mjs`**
- Main: `mintSessionSlug`/`PR_KINDS` multi-repo slugs (`f211888d0`), #3567 investigate, #3694 `admission.held` hold reason.
- Branch: `ATTRIBUTION_KIND`/`ATTRIBUTION_NUM` placeholders (no-item-number fix), `assertDispatchKindAxesDisjoint` + wrapper-owned kind axes, `taskTypeFor` routing (#3717), shared-state tick.
- Trial merge: **5 conflicts** [4]: (1) `BRIEF_PLACEHOLDERS` → add branch's `'ATTRIBUTION_KIND', 'ATTRIBUTION_NUM'`; (2) `BRIEF_REQUIRED_BY_KIND.fix` → take branch line; (3) after `LAUNCH_KINDS` → take branch's whole added block including the `assertDispatchKindAxesDisjoint()` call; (4) `sessionSlugFor` → **keep main's `mintSessionSlug`** (byte-identical to branch literals for `repo='we'`); (5) not-cleared `holdReason` → **keep main's `raw.admission?.held` branch**.
- Dependency: `we:scripts/lib/dispatch-task-type.mjs` (branch-only); keep main's session-slug import.

**`we:scripts/operator/dispatch.mjs`**
- Main: `--disallowedTools` in the spawn argv (`9d5a8c2dd`). Branch: SUPERSEDED header + `env: markWorkerEnv(process.env)`.
- **1 conflict** at the `spawnFn('claude', …)` call: keep main's argv, add the branch's `env: markWorkerEnv(process.env)`. Needs `we:scripts/operations/session-role.mjs`.

**`we:scripts/operations/wake.mjs`**
- Main: untouched. Branch (2 commits): imports `isHandleListed` and swaps `listed.has(handle)` for `isHandleListed(handle, sessions)` (short-id prefix match). **0 conflicts** — apply branch diff. Note it still never matches a `pid:` handle; that is the branch's behaviour, ported as-is.

**`we:scripts/operations/explore-io.mjs`**
- Main: untouched. Branch (2 commits): `investigatorSessionName` export; liveness also matches a listed session by `name`; unreadable-listing guard accepts `name`. **0 conflicts** — apply branch diff.

**`we:scripts/operations/delivery-agent-marker.mjs`**
- New file (branch-only). Imports `we:scripts/backlog/frontmatter.mjs`, `we:scripts/lib/main-staleness.mjs`, `we:scripts/operations/resolve-io.mjs` (all on main) and `we:scripts/operations/detached-dispatch.mjs` (branch-only). Copy as-is.

**`we:scripts/operations/runner-activity-io.mjs`** (main-only file)
- Scope per ruling: follow the run-store root move only. It builds its store from `env.OPERATION_RUNS_DIR || runsDir(root)` (L38) and reports `historySource` the same way (L129); switch both to `resolveRunsDir()` so it reads the coordination root that dispatch now writes. No other change.

**Small files (main untouched unless noted, clean apply)**
- `we:scripts/operations/effect-executor.mjs`: `inFlight({dispatch})` + action-record hold path.
- `we:scripts/operations/run-store.mjs`: needs `we:scripts/operations/coordination-root.mjs` (branch-only). `resolveRunsDir` moves to `~/workspace/.operations/coordination/runs` (override `WE_COORDINATION_ROOT`); existing checkout-local run records are not migrated.
- `we:scripts/operations/run-record.mjs`: main added #3521 cache-hit work; branch adds `transcriptFile` to `TELEMETRY_STRINGS`. **0 conflicts**.

**Worker steps**
1. Land branch-only dependencies first (or confirm their cards landed): action-*, tick-mutex, session-role, coordination-root, spawn-to-completion, detached-dispatch, dispatch-contracts, dispatch-task-type, dispatch-provider-registry, `we:scripts/operations/dispatch-providers/`.
2. Copy `we:scripts/operations/delivery-agent-marker.mjs`.
3. Apply effect-executor, run-store, run-record branch diffs.
4. Hand-merge `we:scripts/operations/dispatch-lane.mjs` (5 conflicts as above).
5. Hand-merge `we:scripts/operations/dispatch-lane-io.mjs` (7 conflicts) per the ruling: branch throw + `WE_DISPATCH_KIND` in `defaultClaudeProvider`, main's argv without `--session-id`; make docblocks agree with that code.
6. Merge `we:scripts/operator/dispatch.mjs` (1 conflict).
7. Apply branch diffs for `we:scripts/operations/wake.mjs` and `we:scripts/operations/explore-io.mjs` (0 conflicts each).
8. Edit `we:scripts/operations/runner-activity-io.mjs` to read runs via `resolveRunsDir()` (both L38 and L129 sites).
9. Update main tests that pin old behaviour: fallback test in dispatch-liveness-hardening (now expects a throw), createDispatchSinks default-provider expectations in `we:scripts/operations/__tests__/dispatch-lane.test.mjs` and `we:scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs` (both also conflict in the real merge), and runner-activity-io tests if they assume the checkout-local runs dir.
10. Run dispatch-lane*, wake, explore, effect-executor, run-store, runner-activity tests, then `npm run check:standards`.

### Designer rulings (2026-09-22)

- **Order fixed:** this slice now lands before #3903 (no longer blocked by it) and owns `we:scripts/operations/delivery-agent-marker.mjs`, `we:scripts/operations/wake.mjs` and `we:scripts/operations/explore-io.mjs`.
- Session-id: take the branch's throw in `defaultClaudeProvider`; keep main's argv without `--session-id` (main's tests enforce it; no behaviour effect).
- `we:scripts/operations/runner-activity-io.mjs` (main-only) changes ONLY to follow the run-store root move (`resolveRunsDir()`), so main's activity report keeps seeing dispatches.
