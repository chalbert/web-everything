---
kind: epic
status: open
dateOpened: "2026-09-30"
tags: [routing, dispatch]
---

# Complete the model launch routing audit

The 2026-09-30 operator request routes review fixes and CI heals now and tracks each remaining launch site separately. This is also the draft PR-body audit; no PR was opened.

## Draft PR body

The review-fix dispatcher bypassed policy and CI-heal adapters referenced absent wrapper runners. Non-critical repairs now select Codex Astra with high effort and run the existing filled brief in a detached session. Critical work retains the existing Claude gate. Unavailable or quota-held providers select only a declared pre-launch fallback. Provider, model and effort travel together through argv, claims and run records. An indeterminate launch never retries on another provider.

The policy declares per-provider effort, low for mechanical/card edits, medium by default, high for diagnosis/design/hard fixes. Prepares of size >=5 or with a design question use Astra/high. Gemini is limited to explicitly well-scoped size <=3 prepares with designQuestion:false and test-only fixes; its defaults can be widened in the JSON file. Astra effort remains a cost/latency dial with no proven correctness gain.

## Launch-site audit

Audit method: git grep for native background/headless Claude, Codex exec, agy/Gemini, subprocess calls and their adapter callers across we:scripts and we:skills-src, then the sibling repositories' tools directories. Read the launch boundaries rather than counting comment or status-command matches.

| Site | Disposition |
| --- | --- |
| we:scripts/conveyor/reconcile-fix-dispatch.mjs fresh fix | Routed here; preserves operator-answer injection and the full repair brief. |
| we:scripts/conveyor/reconcile-fix-dispatch.mjs resume | Intentionally resumes the original native session with its original provider/settings; extra flags would fork a fresh session. No new provider choice. |
| we:scripts/operations/ci-heal-pr-dispatch.mjs and we:scripts/operations/dispatch-lane-io.mjs | Routed here, including the Codex brief adapter, actual fallback effort and claim metadata. |
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

The repair routing dry run at we:scripts/operations/__tests__/repair-routing-dry-run.test.mjs asserts the actual detached argv, filled operator answer, fix protocol, claim metadata, assigned lane and critical/unavailable fallback. It does not claim a paid model completed a real repair. The new executor still needs production lifecycle observation before merge, per we:docs/agent/prototype-based-dev.md. The operator requested a dry run and an uncommitted diff, so no real repair, commit, push or PR was performed.

Validation on 2026-09-30: `npm run check:standards` passed with zero errors. The full `node we:scripts/verify-lane.mjs` run reported 24,763 passed, 24 failed and 35 skipped. Two failures (the fake native CLI rejecting effort, and detached claim refresh depending on native listing) were corrected and passed targeted reruns. The remaining 22 failures concern sandbox-denied process inspection (`ps`, including caller attribution) or writes to the home-level drain-lock directory. The full gate remains red; no tests or admission rules were weakened. Routing, effort validation/last-good retention, argv, repair dry-run and claim lifecycle checks pass targeted runs.

## Follow-ups

Rerun we:scripts/verify-lane.mjs in an environment permitted to inspect processes and use the existing home-level lock root before landing. Keep these environment limitations visible rather than replacing the real-process assertions with mocks.

Keep default-snapshot tests separate from legacy evidence-router tests: a policy default change must not erase coverage of cold-start and promotion rules. Preserve provider pins on resume, and keep model-specific agy effort support distinct from its generic enum. Unknown prepare metadata stays on Codex.

