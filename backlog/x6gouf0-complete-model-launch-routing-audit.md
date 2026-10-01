---
kind: epic
status: open
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Complete the model launch routing audit

The launch-site audit tracks each remaining adapter separately. The operator-approved 2026-10-01 split keeps the shared routing core and defers review-fix and CI-heal routing to #xa7tqgw.

## Draft PR body

The shared policy resolves provider, explicit model and effort together, with ordered pre-launch fallbacks. Card-only preparation retains its bounded worker path. Every policy-routed dispatch kind receives the critical-work gate, including prepare-decision and investigate, using card security tags and declared risk. Reasoned explicit model pins remain accepted and reported. Review fixes and CI heals retain the main dispatch and claim lifecycle.

The policy declares per-provider effort, low for mechanical/card edits, medium by default, high for diagnosis/design/hard fixes. Prepares of size >=5 or with a design question use Astra/high. Gemini is limited to explicitly well-scoped size <=3 prepares with designQuestion:false and test-only fixes; its defaults can be widened in the JSON file. Astra effort remains a cost/latency dial with no proven correctness gain.

## Launch-site audit

Audit method: git grep for native background/headless Claude, Codex exec, agy/Gemini, subprocess calls and their adapter callers across we:scripts and we:skills-src, then the sibling repositories' tools directories. Read the launch boundaries rather than counting comment or status-command matches.

| Site | Disposition |
| --- | --- |
| we:scripts/conveyor/reconcile-fix-dispatch.mjs fresh fix | Unchanged Claude path; Codex routing deferred to #xa7tqgw. |
| we:scripts/conveyor/reconcile-fix-dispatch.mjs resume | Intentionally resumes the original native session with its original provider/settings; extra flags would fork a fresh session. No new provider choice. |
| we:scripts/operations/ci-heal-pr-dispatch.mjs and we:scripts/operations/dispatch-lane-io.mjs | Repair routing and claim lifecycle unchanged; Codex adapter deferred to #xa7tqgw. |
| we:scripts/operations/dispatch-providers/build.mjs and we:scripts/operations/deliver-item-run.mjs | Existing resolver now passes effort through the restricted Claude/Codex delivery worker. |
| we:scripts/operations/probation-build-run.mjs and we:scripts/operations/probation-heal-run.mjs | Existing resolver now carries worker effort into we:scripts/lib/probation-launcher.mjs and scorecards. |
| we:scripts/operations/cli-adapter.mjs | Existing judge resolver now carries selected and fallback effort. Explicit per-run pins retain precedence. |
| we:scripts/operations/review-dispatch.mjs and we:scripts/operations/review-extra-seats.mjs | Added-seat/red-team/recheck policy effort is explicit. Native review orchestrator and mandatory seats retain review authority. |
| we:scripts/lib/judge-spawn.mjs, we:scripts/lib/codex-judge-spawn.mjs, we:scripts/lib/antigravity-judge-spawn.mjs | Provider-specific execution primitives; caller owns routing. Mandatory native authority is intentionally unchanged; native settings migration has its own card. |
| we:scripts/codex-direct-task.mjs and we:scripts/gemini-direct-task.mjs | Explicit personal provider tools, not autonomous routers. Routed callers now supply effort; task reports include model and effort. |
| we:skills-src/jury/panel-fanout.mjs, we:skills-src/jury/subject-jury.workflow.js, we:skills-src/brand-mark-loop/SKILL.md, we:skills-src/harvest-learnings/SKILL.md | Delegate to the native juror panel; unchanged authority, tracked by the native-juror card. |
| we:skills-src/use-codex/SKILL.md | Explicit operator invocation of the provider-specific personal tool; retains explicit provider semantics. |
| we:skills-src/conveyor daemon entrypoints | Invoke the dispatchers above, not an independent model execution adapter. |
| we:scripts/operations/minimal-context-provider.mjs and we:scripts/operations/codex-delivery-provider.mjs | Provider-specific argv/execution primitives; caller owns routing. |
| we:scripts/lib/spawn-to-completion.mjs and we:scripts/operations/detached-dispatch.mjs | Generic subprocess primitives; no model decision. |
| we:../frontierui/tools | No model-launch matches in the tracked tools tree. |
| we:scripts/measure-judge-spawn.mjs | Explicit CLI measurement probe; its named provider is the subject being measured, so automatic rerouting would invalidate the measurement. |
| Other audited independent launch sites | One card per site below. |

Status/read-only CLI calls (agent listing/logs/stop/auth), transcript readers, telemetry, test fixtures, smoke probes with explicit provider pins, and historical command examples are not autonomous model routing decisions.

## Deferred adapters

- #xd3dq38: we:backlog/xd3dq38-route-stuck-pr-inspection.md (scope we:scripts/conveyor/stuck-pr-inspect-dispatch.mjs).
- #x9mwm9r: we:backlog/x9mwm9r-route-health-investigation.md (scope we:scripts/conveyor/health-investigate-dispatch.mjs).
- #xzaqgfu: we:backlog/xzaqgfu-route-native-jurors.md (scope we:scripts/lib/judge-panel.mjs).
- #xccqc6a: we:backlog/xccqc6a-route-explore.md (scope we:scripts/operations/explore-io.mjs).
- #x9ay25h: we:backlog/x9ay25h-route-operator-dispatch.md (scope we:scripts/operator/dispatch.mjs).
- #x1o7jc1: we:backlog/x1o7jc1-route-operator-converge.md (scope we:scripts/operator/converge.py).
- #xuu8u4h: we:backlog/xuu8u4h-route-converge-editor.md (scope we:scripts/operations/deliver-item-wrapper.mjs).
- #x48cop2: we:backlog/x48cop2-route-advisory-conversion.md (scope we:scripts/conveyor/convert-advisory-dispatch.mjs).
- #xmob37p: we:backlog/xmob37p-route-plateau-dev-panel.md (scope we:scripts/lib/dispatch-routing-policy.json).

## Validation and limitations

The shared effort argv regression remains at we:scripts/operations/__tests__/repair-routing-dry-run.test.mjs. Repair-only code and tests moved out with #xa7tqgw. Card signal regressions exercise the dispatch reader for prepare, prepare-decision and investigate; the pin regression exercises the actual native argv builder and reporting callback.

Validation on 2026-09-30: `npm run check:standards` passed with zero errors. The full `node we:scripts/verify-lane.mjs` run reported 24,763 passed, 24 failed and 35 skipped. Two failures (the fake native CLI rejecting effort, and detached claim refresh depending on native listing) were corrected and passed targeted reruns. The remaining 22 failures concern sandbox-denied process inspection (`ps`, including caller attribution) or writes to the home-level drain-lock directory. The full gate remains red; no tests or admission rules were weakened. Routing, effort validation/last-good retention, argv, repair dry-run and claim lifecycle checks pass targeted runs.

## Follow-ups

PR #3279 soak repair (run 36824022416): the scenario CLI in we:scripts/operations/__tests__/helpers/fake-claude-shim.mjs rejected the newly routed `--effort` option. That prevented session creation, so unrelated owed-work, authentication, reaper, claim and self-sync scenarios failed. The brief-fill probe in we:scripts/lib/daemon-live-smoke.mjs also began consulting host provider availability despite injecting a fake Claude spawner; its explicit availability now describes that spawner. The same correction applies to the injected investigation sink in we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs. These dry runs must never select a real Codex repair worker.

Keep the scenario world's installed providers explicit: we:scripts/conveyor/__tests__/sim/world.mjs now excludes real Codex/agy binaries while retaining the production routing policy and its declared Claude fallback. These scenarios script Claude sessions and some specifically inject Claude authentication failures; changing their session expectations to Codex would stop exercising the named regressions. No scenario assertion, grace period or gate was relaxed. The fake CLI validates effort and continues rejecting unknown flags; we:scripts/operations/__tests__/fake-claude-sessions.test.mjs exercises both success and refusal through a real subprocess.

The failing scenario set includes we:scripts/conveyor/soak/daemon-soak.soak.test.mjs and, under we:scripts/conveyor/soak/breaks/, `answered-stand-down-never-redispatched`, `bad-overlay-falls-back`, `broken-smoke-harness-holds-last-good`, `ci-heal-empty-scope`, `ci-heal-stale-rerun-blocks-review`, `ci-heal-system-fix-never-rearms`, `claude-auth-dispatch-pause`, `claude-auth-expired`, `claude-auth-false-positive`, `pinned-overlay-conflict-skipped`, `reaper-restops-finished-sessions`, `session-junk-in-daemon-clone`, and `worker-push-during-fix-claim`. This includes shard 4, also red in the supplied run.

Local test conditions: Git auto-maintenance raced the temporary-repository local clones (missing loose objects after packing); use a temporary `GIT_CONFIG_GLOBAL` with `gc.auto=0`, `maintenance.auto=false`, and `receive.autoGC=false` for the soak run. Concurrent production daemon rebuilds can also trip the simulator's parent-HOME new-entry isolation check: the reported key `206df80ef82e6401` was confirmed as the real review-daemon checkout, not a simulation clone. Rerun affected cases with a temporary parent HOME; keep the isolation assertion intact.

Validation on 2026-10-01: all 14 failing soak scenarios passed locally. The long soak completed all 50 ticks with every invariant intact; it and the three short cases affected by host-state churn passed clean isolation reruns. The targeted smoke/investigation unit tests passed 163 checks, and the fake-session integration tests passed 16 checks, including the new effort regression.

The required `node we:scripts/verify-lane.mjs` then ran the full suite: 24,874 passed, 22 failed, 35 skipped. Twenty failures require process inspection (`ps` directly returns "Operation not permitted" in this sandbox); two fail creating home-level drain locks. All 15 tests in we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs pass when rerun with a writable temporary HOME, confirming the latter restriction. The lane gate remains red; the process-inspection assertions require a permitted environment and were not weakened or skipped.

Rerun we:scripts/verify-lane.mjs in an environment permitted to inspect processes and use the existing home-level lock root before landing. Keep these environment limitations visible rather than replacing the real-process assertions with mocks.

Keep default-snapshot tests separate from legacy evidence-router tests: a policy default change must not erase coverage of cold-start and promotion rules. Preserve provider pins on resume, and keep model-specific agy effort support distinct from its generic enum. Unknown prepare metadata stays on Codex.

## PR #3311 split (operator approved 2026-10-01)

The repair routing and its round-2/round-3 acceptance requirements moved to
[#xa7tqgw](/backlog/xa7tqgw-route-review-fixes-and-ci-heals-to-codex-split-from-3311/).
Review fixes and CI heals retain their existing Claude dispatch path in this PR.
The shared policy, effort selection, card-only preparation, launch records and this
launch-site audit remain in scope.
