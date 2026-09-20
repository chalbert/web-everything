---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/conveyor/session-reap-plan.mjs", "we:scripts/lib/handle.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# normalizeHandle is copied in three places: extract one shared pure module and pin the copies until then

After the reaper split, the pure planner carries its own copy of `normalizeHandle`: we:scripts/conveyor/session-reap-plan.mjs line 118, `const normalizeHandle = (x) => String(x ?? '').trim().toLowerCase();`, commented "keep the two identical". The original is we:scripts/operations/dispatch-lane-io.mjs (`export function normalizeHandle`, same body, line 429 on the branch tip 95aae605b). The planner cannot import it because that module pulls the run store, action dispatch, lease reaper and pr-watch into a planner whose import closure is otherwise three files (reaper-split result note). Nothing enforces "keep the two identical".

There is a SECOND copy already, on main and on the branch: we:scripts/operations/explore-io.mjs exports its own `normalizeHandle` with the same body (line 936 on main). Its docblock says it is a deliberate file-local copy so that the two io shells stay independent. So the task is three sites, not two. Importers of the dispatch-lane-io one today: we:scripts/operations/clear-stuck-session-io.mjs, we:scripts/operations/wake.mjs, we:scripts/operations/dispatch-abort.mjs and we:scripts/conveyor/session-reaper.mjs (on main; on the branch the reaper's CLI still imports it, the planner does not).

The planner file exists on lane/mechanical-dispatcher only, so the planner half lands there or with the planner's graduation (a slice of #3443).

DESIGN TO SETTLE.
1. The shared module: a new tiny pure module (no imports at all), name and home to be chosen (for example we:scripts/lib/handle.mjs). dispatch-lane-io re-exports `normalizeHandle` from it so every existing importer keeps working.
2. Whether we:scripts/operations/explore-io.mjs joins. Its header argues for independence between the io shells; a zero-import pure module does not couple the shells the way importing dispatch-lane-io would, so the reason for the copy mostly disappears. Recommendation: fold it in. Say so in the ruling, because it reverses a stated choice.
3. Until the extraction lands, a guard test that fails when the copies drift: read each site's function body (or run all three on a table of inputs: null, undefined, whitespace, mixed case, a number) and assert equal results. Keep it after the extraction as a pin on the shared export.

## Done when

1. **Executable** — `grep -rEn "(function|const) normalizeHandle" we:scripts we:skills-src` prints exactly one line, the shared module's. Before: it prints three (the dispatch-lane io module, the explore io module, and the planner's local copy on `lane/mechanical-dispatcher`).
2. **Executable** — a test for the shared module runs a table of inputs (null, undefined, empty, whitespace, mixed case, a number) and passes; and until the extraction lands, a drift test runs the same table through every copy and asserts equal results. Path and name follow the design.
3. **Executable** — the suites that use the function still pass unchanged: `npx vitest run we:scripts/operations/__tests__ we:scripts/conveyor/__tests__`.
4. **Executable** — the planner's import list contains only its verdict module and the shared module (no dispatch-lane io module), asserted by a test.
