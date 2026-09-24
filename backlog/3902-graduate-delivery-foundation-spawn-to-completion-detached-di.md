---
bornAs: xb9av7z
kind: story
size: 5
parent: "3443"
status: open
blockedBy: ["3901", "3895", "3897", "3890"]
scope: ["we:scripts/lib/__tests__/spawn-to-completion.test.mjs", "we:scripts/lib/spawn-to-completion.mjs", "we:scripts/operations/__tests__/codex-delivery-provider.test.mjs", "we:scripts/operations/__tests__/fix-report-cli.test.mjs", "we:scripts/operations/__tests__/fix-report-record.test.mjs", "we:scripts/operations/__tests__/fix-report-store.test.mjs", "we:scripts/operations/__tests__/minimal-context-provider.test.mjs", "we:scripts/operations/codex-delivery-provider.mjs", "we:scripts/operations/detached-dispatch.mjs", "we:scripts/operations/fix-report-cli.mjs", "we:scripts/operations/fix-report-record.mjs", "we:scripts/operations/fix-report-store.mjs", "we:scripts/operations/minimal-context-provider.mjs", "we:scripts/operations/__tests__/session-role.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate delivery foundation: spawn-to-completion, detached-dispatch, minimal-context-provider, codex-delivery-provider, fix-report store from lane/mechanical-dispatcher to main

Ports 7 files (we:scripts/lib/spawn-to-completion.mjs, we:scripts/operations/detached-dispatch.mjs, we:scripts/operations/minimal-context-provider.mjs, we:scripts/operations/codex-delivery-provider.mjs, we:scripts/operations/fix-report-record.mjs, we:scripts/operations/fix-report-store.mjs, we:scripts/operations/fix-report-cli.mjs) plus their tests. On the critical path. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/spawn-to-completion.test.mjs we:scripts/operations/__tests__/codex-delivery-provider.test.mjs we:scripts/operations/__tests__/fix-report-cli.test.mjs we:scripts/operations/__tests__/fix-report-record.test.mjs we:scripts/operations/__tests__/fix-report-store.test.mjs we:scripts/operations/__tests__/minimal-context-provider.test.mjs we:scripts/operations/__tests__/session-role.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

- Moved here from #3901 (2026-09-24): `we:scripts/operations/__tests__/session-role.test.mjs`, which imports `we:scripts/operations/detached-dispatch.mjs`, a module this slice ports.
