---
bornAs: xnyz371
kind: story
size: 5
parent: "3443"
status: open
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/gen-dispatch-routing-table.mjs", "we:scripts/lib/__tests__/dispatch-contracts-profile.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts-trial.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs", "we:scripts/lib/__tests__/dispatch-supervision-tree.test.mjs", "we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs", "we:scripts/lib/__tests__/dispatch-thresholds.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/lib/codex-model-routing.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/dispatch-size-policy.json", "we:scripts/lib/dispatch-supervision-tree.mjs", "we:scripts/lib/dispatch-supervisor-contract.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/lib/dispatch-thresholds.mjs", "we:scripts/lib/provider-routing.mjs", "we:package.json", "we:scripts/conveyor/log-delegation-trial.mjs", "we:scripts/conveyor/__tests__/log-delegation-trial.test.mjs", "we:scripts/conveyor/concurrent-baseline-comparison.mjs", "we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Graduate dispatch contracts and provider routing from lane/mechanical-dispatcher to main

Ports 10 files (we:scripts/lib/dispatch-task-type.mjs, we:scripts/lib/dispatch-thresholds.mjs, we:scripts/lib/codex-model-routing.mjs, we:scripts/lib/dispatch-contracts.mjs, we:scripts/lib/dispatch-supervision-tree.mjs, we:scripts/lib/dispatch-supervisor-contract.mjs, we:scripts/lib/dispatch-size-policy.json, we:scripts/gen-dispatch-routing-table.mjs, we:scripts/lib/provider-routing.mjs, we:scripts/codex-direct-task.mjs) plus their tests. Head of the critical path (A3 → B4 → C3 → D1 → D2 → E3). we:scripts/lib/provider-routing.mjs and we:scripts/codex-direct-task.mjs were also changed on main: diff-merge, never copy. Main also changed these files, so each gets a diff-merge: we:scripts/lib/provider-routing.mjs, we:scripts/codex-direct-task.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. HOLD: do not dispatch until the operator confirms agent routing works (2026-09-22). Filed with --queue=false.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

### Merge notes for #3897 (2026-09-22)

**`we:scripts/lib/provider-routing.mjs`**
- **Main side:**
  - Added the router module (`576d9d3e7`), the agy/Antigravity fallback, capability ratings and the Antigravity default.
  - `077b61856` and `faa7d79c5` (#3690): `isCleanRecord` / `isInformativeRecord` now gate on outcome, fail-closed.
  - `cc412f8df` (#3798): header note that the router only covers the mechanical dispatch path.
- **Branch side:**
  - `6761be552` is a squashed copy of main's file as of `c0c4b698d`. It is not a real change.
  - `d6c1bab3a` (#3845): trust is now keyed on `{provider, model, subjectClass, taskType}`. `selectSupervisionLevel` takes a new sixth parameter, `subjectClass = 'work-agent'`, and the record filter adds `r.subjectClass === subjectClass`. Two docblocks are updated to match.
- **Trial merge:**
  - Against the real merge base `ca7e68b71`: 6 conflicts. They are fake. The file does not exist at that commit, so git treats it as added on both sides.
  - Against the effective base `c0c4b698d`: **0 conflicts**, and the result parses.
  - Use `c0c4b698d` as the base: `git merge-file main <c0c4b698d copy> branch`.
- **Dependencies:** none. It imports nothing new.
- **Semantic risks:**
  - Any record without `subjectClass` no longer counts toward a streak, so that tuple falls back to full supervision (the safe direction).
  - On main this is harmless. No production code calls `selectSupervisionLevel`, only tests. All 26 rows of `we:scripts/conveyor/run-scorecards.json` already carry `subjectClass`.
  - The branch's caller in `we:scripts/lib/dispatch-contracts.mjs` writes only `'work-agent'` or `'driver'`. Those are exactly the values main's `validateScorecard` in `we:scripts/conveyor/run-scorecard-store.mjs` accepts.

**`we:scripts/lib/__tests__/provider-routing.test.mjs`**
- Effective base is `faa7d79c5`. Merging against it gives **0 conflicts**, and the merged test passes 77/77 against the merged module.

**`we:scripts/codex-direct-task.mjs`**
- **Main side:**
  - Bug fixes from the PR #2254 review rounds: maxBuffer, UTF-8 decoding, killing the whole process group, the Ctrl-C leak, `-z` status parsing, and the log path taken from `rev-parse --absolute-git-dir`.
  - `90b9ab8a8`: FOREGROUND ONLY banner.
  - `d622b4d80` (3785): the full gate now runs `npm run test:unit`.
- **Branch side:** `5238fe08c` (#3635)
  - The `CODEX_EFFORT_MAP`, `CODEX_MODEL`, `CODEX_TIER_EFFORT` and `resolveCodexEffort` definitions move out to `we:scripts/lib/codex-model-routing.mjs`. This file now re-exports them.
  - `buildCodexDirectTaskArgv` always pushes `-m` via `assertCodexModel(model, 'codex-direct-task')`, replacing the old `if (model !== undefined)` check.
- **Trial merge:** base `ca7e68b71`, **0 conflicts**. The two sides touch separate regions. The result parses, and `we:scripts/__tests__/codex-direct-task.test.mjs` passes 84/84 unchanged. Error-message prefixes (`codex-direct-task:`) are the same as before.
- **Dependencies:**
  - Needs the new file `we:scripts/lib/codex-model-routing.mjs`, which is not on main. It is in this card's scope, so copy it verbatim.
  - **Blocker:** `we:scripts/lib/__tests__/codex-model-routing.test.mjs`, also in this card's scope, requires two things that are not on main:
    - `we:scripts/operations/codex-delivery-provider.mjs` (#3902).
    - The unconditional `-m` fix in `we:scripts/lib/codex-judge-spawn.mjs` (#3907). Main's copy still has `if (model !== undefined)` at line 350.
  - It also finds call sites automatically, by scanning for files containing `export const CODEX_CLI = 'codex'`. So main's current `we:scripts/lib/codex-judge-spawn.mjs` fails that check even before the missing import is fixed.
- **Semantic risks:** none beyond the blocker. The pinned model `gpt-6-astra` and the effort map are identical to main's inline copies.

**Worker steps**
1. For `we:scripts/lib/provider-routing.mjs`: `git merge-file` main's file with base = `c0c4b698d`'s copy and theirs = `ff1618065`'s copy. It should merge with 0 conflicts.
2. Do the same for `we:scripts/lib/__tests__/provider-routing.test.mjs`, with base = `faa7d79c5`.
3. For `we:scripts/codex-direct-task.mjs`: `git merge-file` with base `ca7e68b71` (0 conflicts).
4. Add `we:scripts/lib/codex-model-routing.mjs` verbatim from `ff1618065`.
5. Do NOT port `we:scripts/lib/__tests__/codex-model-routing.test.mjs` in this card. Designer ruling (2026-09-22): that test moves to #3907, which lands it together with the `we:scripts/lib/codex-judge-spawn.mjs` fix it asserts. Drop it from this card's scope.
6. Port the remaining new files from `ff1618065` (dispatch-contracts, dispatch-supervision-tree, dispatch-supervisor-contract, dispatch-task-type, dispatch-thresholds, dispatch-size-policy, gen-dispatch-routing-table, and their tests). Then run the full gate.

### Designer rulings (2026-09-22)

- `we:scripts/lib/__tests__/codex-model-routing.test.mjs` moved to #3907 (it needs #3902 and #3907's code); this slice stays at the head of the critical path.
- The `gen:dispatch-routing-table` script in `we:package.json` moved here from #3487 (it points at this slice's generator).

### Addendum: snapshot moved to 600acc14f (2026-09-23)

Re-ran the trial merges at the new prototype tip. `we:` prefixes below are repo-relative paths.

**`we:scripts/lib/provider-routing.mjs`** — still **0 conflicts** against effective base `c0c4b698d`. Main
has not touched this file's changed regions since the old snapshot. New branch content on top of the
old note's `d6c1bab3a` delta, all clean:
- The **#3857 model-tier table**: `DISPATCH_MACHINERY_PATHS` (a frozen list of 5 wide-blast-radius files
  including this one and `we:scripts/operations/dispatch-lane-io.mjs`/`we:scripts/operations/dispatch-task.mjs`)
  and `workerTierFor({kind, taskType, scopePaths, tags})`, which REPLACES the old inline Step-4 Opus/Sonnet/Haiku
  criteria in `selectProvider` with one raise-only lookup (statute path, `prepare-decision`/`architectural-decision`,
  `security-fix`/`security` tag, or a machinery path → opus; else sonnet).
- **Rule 4 of #3690 (#3888)**: `isInformativeRecord` now reads the explicit `record.informative === true` field
  only — no more inferring "informative" from `outcome`/`findings`.
- **Rule 5 of #3690 (#3889)**: `DEFAULT_BACKDOWN_THRESHOLDS.k = 3`, a new `hasRootCauseNote` reader, and
  `selectSupervisionLevel` now applies a post-miss bar of `minCleanStreak + k` once any verified record for the
  triple was ever unclean, until a `rootCause` note is on record.

**`we:scripts/lib/__tests__/provider-routing.test.mjs`** — still **0 conflicts** against `faa7d79c5`.

**`we:scripts/lib/dispatch-contracts.mjs`** (+ `we:scripts/lib/__tests__/dispatch-contracts.test.mjs`,
`we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs`, `we:scripts/lib/__tests__/dispatch-thresholds.test.mjs`)
— still **missing on main**, still a straight add, still safe (confirmed via `git cat-file -e origin/main:...`).
New branch content since the old snapshot: `STORY_KIND_RUNGS` is gone, replaced by `RUNG_KINDS` (every
`STORY_KINDS` entry but `build`) routed through the new `workerTierFor`; `routingRecords`'s scorecard-projection
key list grew to include `informative`/`rootCause` (needed or `selectSupervisionLevel`'s rule-4/5 reads silently
see `null`); and a new export, `independentReviewDepthFor(supervision)` — **Rule 7 of #3690 (#3887)**, resolving
`full` → the existing mandatory panel unchanged, `spot-check` → the `#3313` floor shape (one tool-free juror, one
round, non-blocking). This is consumed by `we:scripts/operations/review-dispatch.mjs#reviewSeatRoutes` (#3908's
scope), so #3897 must land before #3908 can import it (already true: #3908 is `blockedBy: ["3906","3904","3907"]`
today but not `3897`; #3897 is on #3908's transitive dependency chain via #3906/#3907's own `blockedBy: [...,"3897",...]`,
so no new edge is needed, just confirm it stays true).

No worker step changes — steps 1–6 in the existing note still apply as written.

**Two files new to the graduation plan, proposed for this card's scope** (see reasoning in the top-level report):

#### `we:scripts/conveyor/log-delegation-trial.mjs` (exists on main, differs)
- Effective base is **`ff1618065`** (the OLD snapshot) — `git diff ff1618065 origin/main -- <file>` is EMPTY, so
  main has not touched this file at all since the port snapshot. Trial merge: **0 conflicts** (base == main).
- Branch-only delta on top: `rootCause` field + validation (rule 5, #3889), `informative` field + validation
  (rule 4, #3888), and a NEW `comparisonId` field (+ `--comparison-id` CLI flag) linking two rows as one
  concurrent-baseline pair — written by `we:scripts/conveyor/concurrent-baseline-comparison.mjs` below, never typed by hand.
- Dependencies: none new; only touches its own scrub/validation logic and `appendScorecard`.

#### `we:scripts/conveyor/concurrent-baseline-comparison.mjs` (NEW) + `we:scripts/conveyor/__tests__/concurrent-baseline-comparison.test.mjs` (NEW)
- Missing on main, straight add, 0 conflicts.
- Mechanizes **#3690 Fork 2 / #3783**: the "concurrent baseline" comparison Kayenta/Argo-style evidence shape —
  run the same task through Claude and a delegated provider, record both as one linked pair.
- Exports `compareTrialOutcomes` (pure) and `recordConcurrentBaselineComparison` (writes both sides via
  `logDelegationTrial`, mints one `comparisonId`).
- Imports: `logDelegationTrial`/`TASK_TYPES` from `we:scripts/conveyor/log-delegation-trial.mjs` (same directory — the reason this
  card should own both), `codexDirectTask` from `we:scripts/codex-direct-task.mjs` (**already this card's own
  scope**), and `geminiDirectTask` from `we:scripts/gemini-direct-task.mjs` (**already exists on main** —
  confirmed via `git cat-file -e`, no new dependency).
- No new npm dependency: no external package references beyond `node:crypto`/`node:url`.

**Worker steps (add to the existing list)**
7. Add `we:scripts/conveyor/log-delegation-trial.mjs`'s branch diff (base = current main file, 0 conflicts) —
   adds `rootCause`, `informative`, `comparisonId` fields/flags.
8. Add `we:scripts/conveyor/concurrent-baseline-comparison.mjs` and its test verbatim from `600acc14f` (new
   file, no conflicts). Confirm `we:scripts/gemini-direct-task.mjs` is present on main before landing (it is).
