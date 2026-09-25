---
kind: story
size: 3
parent: "3443"
status: open
blockedBy: ["3915"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs", "we:scripts/lib/__tests__/lane-lease.test.mjs", "we:scripts/lib/lane-verify.mjs", "we:scripts/verify-lane.mjs", "we:scripts/__tests__/verify-lane.test.mjs", "we:scripts/operations/poc-land.mjs", "we:scripts/operations/__tests__/poc-land.test.mjs", "we:scripts/operations/verify-io.mjs", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs", "we:scripts/__tests__/lane-pool-refresh-guard.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/check-standards.contract.json", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Graduate post-snapshot landing tooling: lane-pool, lane-lease, verify-lane, guard-bash, poc-land (6a2c8c1ab) from lane/mechanical-dispatcher

Post-snapshot tail slice of epic #3443. origin/lane/mechanical-dispatcher moved from snapshot 600acc14f to 6a2c8c1ab (13 commits); these files are the delta NOT covered by any moved graduation card (their prior owners #3481/#3484/#3890/#3917 are already resolved/landed, so they will not re-port it). Excludes the 3 commits already fast-tracked to main via PR #2563 (b9b45b63f heavy-admission ceiling, ed443fa90 guard-bash raw-heavy-command deny, c51e09bfa shared free-lane scan cache -- confirmed superseded/present on main by content, not just by name). Ports we:scripts/lane-pool.mjs (commits cdec41cd1 landing-tooling, 5db6d9484 acquire-refused-hands-back), we:scripts/lib/lane-lease.mjs+test (cdec41cd1), we:scripts/lib/lane-verify.mjs+test and we:scripts/verify-lane.mjs+test (cdec41cd1, 6a2c8c1ab foreign-terminal-record archive + stranded-hash grace 180s->1800s), we:scripts/operations/poc-land.mjs+test and we:scripts/operations/verify-io.mjs+test (cdec41cd1), we:scripts/guard-bash.mjs+test delta (cdec41cd1 portion only), we:scripts/__tests__/lane-pool-refresh-guard.test.mjs (5db6d9484, new), we:scripts/check-standards-rules.mjs+we:scripts/check-standards.contract.json+we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs (6a2c8c1ab). FAITHFUL PORT, no behaviour change. we:scripts/verify-lane.mjs and we:scripts/guard-bash.mjs both also changed independently on main since the merge base via dd4beb5e5 (diff-selected local test gate + guard-bash full-suite deny) -- diff-merge the branch delta onto main's dd4beb5e5-shaped body, never copy over it; merge base ca7e68b71 unless a file's own history says otherwise.

## Done when

1. **Executable** — `git diff origin/main 6a2c8c1ab -- we:scripts/lane-pool.mjs we:scripts/lib/lane-lease.mjs we:scripts/lib/lane-verify.mjs we:scripts/verify-lane.mjs we:scripts/operations/poc-land.mjs we:scripts/operations/verify-io.mjs we:scripts/guard-bash.mjs we:scripts/check-standards-rules.mjs we:scripts/check-standards.contract.json` (run from a checkout with `origin/lane/mechanical-dispatcher` fetched) reports no diff not already explained by main's own later changes named in this card's digest — it reports a real diff before this item lands.
2. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-lease.test.mjs we:scripts/__tests__/lane-verify.test.mjs we:scripts/__tests__/verify-lane.test.mjs we:scripts/operations/__tests__/poc-land.test.mjs we:scripts/operations/__tests__/verify.test.mjs we:scripts/__tests__/guard-bash.test.mjs we:scripts/__tests__/lane-pool-refresh-guard.test.mjs we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs` passes on `main`'s tree after the port (`we:scripts/__tests__/lane-pool-refresh-guard.test.mjs` fails with a module-not-found before the port — it does not exist on `main` yet).
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
4. **Faithful port** — `we:scripts/verify-lane.mjs` and `we:scripts/guard-bash.mjs` are diff-merged onto their `dd4beb5e5`-shaped bodies (the diff-selected local test gate + guard-bash full-suite deny), never copied over; a raw `git diff` against either will show that main-only content as an expected residual, not a regression.

## Graduation import check

- 2026-09-25: graduation-import-check made this a blocker of #3915 — its moved-in `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs` to #3915 — it imports a module #3915 owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its `we:scripts/pr-land.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its `we:scripts/operations/deliver-item-wrapper.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its `we:scripts/lib/review-escalation.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its `we:scripts/lib/gh-throttle.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its moved-in `we:scripts/lib/__tests__/gh-throttle.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3915 — its `we:scripts/conveyor/lease-reaper.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/readiness/heavy-admission.mjs` here from #xvlu8t1 — this card's `we:scripts/operations/verify-io.mjs` needs it directly, and a blockedBy edge to #xvlu8t1 would cycle (it already depends on this card).
- 2026-09-25: graduation-import-check made this a blocker of #xvlu8t1 — its `we:scripts/check-standards.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #xvlu8t1 — its moved-in `we:scripts/__tests__/check-standards-rules-conformance-gates.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #xvlu8t1 — its moved-in `we:scripts/operations/__tests__/verify.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check moved `we:scripts/operations/__tests__/verify.test.mjs` to #xvlu8t1 — it imports a module #xvlu8t1 owns.
- 2026-09-25: graduation-import-check moved `we:scripts/__tests__/lane-verify.test.mjs` to #3910 — it imports a module #3910 owns.
- 2026-09-25: graduation-import-check made this a blocker of #3909 — its `we:scripts/operations/turn-digest-io.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its moved-in `we:scripts/operations/__tests__/review-dispatch-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3908 — its `we:scripts/conveyor/reconcile-fix-dispatch.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its `we:scripts/operator/dispatch.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3906 — its `we:scripts/operations/prepare-scope-wrapper.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #xvlu8t1 — its moved-in `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3905 — its moved-in `we:scripts/operations/__tests__/prepare-decision-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/fix-dispatch-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/dispatch-kind-axes.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3904 — its moved-in `we:scripts/operations/__tests__/ci-heal-dispatch-wrapper.test.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3899 — its `we:scripts/operations/host-sampler.mjs` imports a module this card owns.
- 2026-09-25: graduation-import-check made this a blocker of #3487 — its moved-in `we:scripts/operations/__tests__/action-ground-truth.test.mjs` imports a module this card owns.
