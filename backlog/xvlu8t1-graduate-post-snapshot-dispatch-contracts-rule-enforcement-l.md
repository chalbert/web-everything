---
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3906", "3915", "x0n0eiz"]
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards-rules-conformance-gates.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/operations/telemetry.mjs", "we:scripts/operations/claude-otel-collector.mjs", "we:scripts/operations/__tests__/claude-otel-collector.test.mjs", "we:scripts/operations/host-sampler-github.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs", "we:scripts/__tests__/dispatch-routing-table.test.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/lib/__tests__/dispatch-supervisor.test.mjs", "we:scripts/operations/__tests__/dispatch-abort.test.mjs", "we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-marker-freshen.test.mjs", "we:scripts/operations/__tests__/dispatch-provider-registry.test.mjs", "we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs", "we:scripts/operations/__tests__/inflight-fail-closed.test.mjs", "we:scripts/operations/__tests__/wake-cli.test.mjs", "we:scripts/operations/dispatch-providers/__tests__/ci-heal-dispatch-routing.test.mjs", "we:scripts/operations/__tests__/verify.test.mjs", "we:AGENTS.md", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Graduate post-snapshot dispatch-contracts rule enforcement, land-seam hold and telemetry (6a2c8c1ab) from lane/mechanical-dispatcher

Post-snapshot tail slice of epic #3443. origin/lane/mechanical-dispatcher moved from snapshot 600acc14f to 6a2c8c1ab (13 commits); these files are the delta NOT covered by any moved graduation card (their prior owners #3897/#3895/#3896 are already resolved/landed; #3916 is landed-but-stranded -- PR #2594 merged but the card's status was never flipped -- so treated as landed too; some files have no owner at all). Ports we:scripts/check-standards.mjs+we:scripts/__tests__/check-standards-rules-conformance-gates.test.mjs, we:scripts/lib/dispatch-contracts.mjs+we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs (delta on top of resolved #3897's base), we:scripts/lib/dispatch-supervision-promotions.json (new) -- all commit 4f357472d, '#3784 Rule 6 of #3690 + enforcement flip'. Also ports we:scripts/conveyor/ci-heal-mark.mjs+test (new, unowned) and the land-seam hold delta on we:scripts/operations/dispatch-lane-io.mjs / we:scripts/operations/dispatch-lane.mjs (same commit 4f357472d; #3915 owns these files at its own open PR #2636's older snapshot 600acc14f -- diff-merge this delta onto whatever main looks like AFTER #2636 lands, never before) -- both closing prototype item #4021 Fork 2 (main's own #4021 is stale at Fork-1-only scope; fold its Fork-2 narrative into main's card by hand when this lands, same treatment #3910 gives #3383/#3105). Also ports telemetry deltas from commit b92c91637 ('capacity telemetry: admission wait at acquire, admission class, lane fallback, GitHub budget, Claude API events'): we:scripts/operations/telemetry.mjs (delta on top of resolved #3895's base, plus commit e14f27bef's MAX_ATTRIBUTE_KEYS 40->48 raise), we:scripts/operations/claude-otel-collector.mjs+test (delta on top of resolved #3896's base), we:scripts/operations/host-sampler-github.mjs+test (new, unowned), we:scripts/readiness/heavy-admission.mjs+test (delta on top of we:scripts/readiness/heavy-admission.mjs's already-landed base -- PR #2594/#2563 -- this card's own we:scripts/readiness/heavy-admission.mjs delta is ONLY the capacity-telemetry addition, not the ceiling/off-switch work, which is already on main). FAITHFUL PORT, no behaviour change; merge base ca7e68b71 unless a file's own history says otherwise.

## Done when

1. **Executable** — `git diff origin/main 6a2c8c1ab -- we:scripts/check-standards.mjs we:scripts/lib/dispatch-contracts.mjs we:scripts/lib/dispatch-supervision-promotions.json we:scripts/conveyor/ci-heal-mark.mjs we:scripts/operations/telemetry.mjs we:scripts/operations/claude-otel-collector.mjs we:scripts/operations/host-sampler-github.mjs we:scripts/readiness/heavy-admission.mjs we:scripts/operations/dispatch-lane-io.mjs we:scripts/operations/dispatch-lane.mjs` (run from a checkout with `origin/lane/mechanical-dispatcher` fetched, AFTER PR #2636 for #3915 has landed) reports no diff not already explained by main's own later changes named in this card's digest — it reports a real diff before this item lands.
2. **Executable** — `npx vitest run we:scripts/__tests__/check-standards-rules-conformance-gates.test.mjs we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs we:scripts/operations/__tests__/claude-otel-collector.test.mjs we:scripts/operations/__tests__/host-sampler-github.test.mjs we:scripts/readiness/__tests__/heavy-admission.test.mjs` passes on `main`'s tree after the port (`we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs` and `we:scripts/operations/__tests__/host-sampler-github.test.mjs` fail with a module-not-found before the port — neither file exists on `main` yet).
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
4. **Faithful port** — `we:scripts/operations/dispatch-lane-io.mjs` / `we:scripts/operations/dispatch-lane.mjs` are diff-merged onto whatever `main` looks like once #3915's PR #2636 has landed, never onto the pre-#2636 tree; `we:scripts/lib/dispatch-contracts.mjs` and `we:scripts/operations/telemetry.mjs` are diff-merged onto their already-landed (#3897/#3895) bodies, never copied over.

## Graduation import check

- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/telemetry.test.mjs` here from #3915 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/host-process-sample.test.mjs` here from #3915 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/readiness/heavy-admission.mjs` to #x0n0eiz — #x0n0eiz's `we:scripts/operations/verify-io.mjs` needs it directly, and this card already (transitively) depends on #x0n0eiz, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/lib/dispatch-supervision-promotions.json` to #3906 — #3906's `we:scripts/operations/dispatch-lane-io.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-github.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/host-sampler-github.test.mjs` to #3899 — it imports a module #3899 owns.
- 2026-09-25: graduation-import-check added we:scripts/operations/run.mjs to this card's own scope — no open card owned it, and it is imported by `we:scripts/check-standards.mjs`, which this card ports.
- 2026-09-25: graduation-import-check moved `we:AGENTS.md` here from #3910 — this card's `we:scripts/check-standards.mjs` needs it directly, and a blockedBy edge to #3910 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — `we:scripts/check-standards.mjs` imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/__tests__/check-standards-rules-conformance-gates.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/operations/__tests__/verify.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/verify.test.mjs` here from #x0n0eiz — it imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3909 — its `we:scripts/operations/turn-digest-io.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its `we:scripts/conveyor/reconcile-pass.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its `we:scripts/conveyor/reconcile-fix-dispatch.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its `we:scripts/conveyor/reconcile-core.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its moved-in `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its moved-in `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/lib/dispatch-contracts.mjs` to #3906 — #3906's `we:scripts/operations/dispatch-task-io.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-providers/__tests__/ci-heal-dispatch-routing.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/ci-heal-mark.mjs` to #3906 — #3906's `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-lane.mjs` to #3906 — #3906's `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/dispatch-lane-io.mjs` to #3906 — #3906's `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` needs it directly, and this card already (transitively) depends on #3906, so a blockedBy edge the other way would cycle.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/wake-cli.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/inflight-fail-closed.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-provider-registry.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane-marker-freshen.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-lane-defaults.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/dispatch-abort.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/lib/__tests__/dispatch-supervisor.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check added blockedBy #x0n0eiz — the moved-in `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` also imports a module #x0n0eiz owns.
- 2026-09-25: graduation-import-check moved `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/dispatch-routing-table.test.mjs` here from #3906 — it imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3905 — its moved-in `we:scripts/operations/__tests__/prepare-decision-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3905 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-prepare-wiring.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3905 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-prepare-decision-wiring.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-fix-wiring.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-ci-heal-wiring.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3903 — its moved-in `we:scripts/operations/__tests__/dispatch-task.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3903 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3903 — its moved-in `we:scripts/operations/__tests__/dispatch-lane-build-wiring.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/load-review.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/load-report-cli.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/load-analysis.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler-tail.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler-rollup.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler-retention.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler-calibrate.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/load-review.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/load-analysis.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-rollup.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-retention.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-large-file.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-episodes.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its moved-in `we:scripts/operations/__tests__/host-sampler-capacity.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3898 — its `we:scripts/operations/wip-report.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3898 — its `we:scripts/operations/wip-agents-io.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3898 — its moved-in `we:scripts/operations/__tests__/wip-agents-io.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3862 — its `we:scripts/operations/clear-stuck-session-io.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3862 — its `we:scripts/conveyor/session-reaper.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3862 — its `we:scripts/conveyor/session-reap-stop.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3862 — its `we:scripts/conveyor/session-reap-evidence.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3487 — its moved-in `we:skills-src/conveyor/__tests__/runner.test.mjs` imports a module this card owns.
