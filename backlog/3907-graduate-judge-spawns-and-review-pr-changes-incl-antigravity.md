---
bornAs: xgacnhr
kind: story
size: 5
parent: "3443"
status: resolved
blockedBy: ["3901", "3893", "3897", "3902"]
scope: ["we:scripts/lib/__tests__/antigravity-judge-spawn.integration.test.mjs", "we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs", "we:scripts/lib/__tests__/codex-judge-spawn.test.mjs", "we:scripts/lib/__tests__/judge-panel.test.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/antigravity-judge-spawn.mjs", "we:scripts/lib/codex-judge-spawn.mjs", "we:scripts/lib/judge-panel.mjs", "we:scripts/lib/judge-spawn.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/lib/review-core.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/lib/review-render.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/operations/__tests__/review-loop-cli.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/record-verdict-io.mjs", "we:scripts/operations/review-loop-cli.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/review-pr.mjs", "we:skills-src/review/review-agent-brief.md", "we:scripts/operations/__tests__/judge-provider-port.test.mjs", "we:scripts/operations/__tests__/judge-provider-selection.test.mjs", "we:scripts/operations/__tests__/juror-flags.test.mjs", "we:scripts/operations/__tests__/record-verdict-cli.test.mjs", "we:scripts/operations/__tests__/helpers/fake-claude.mjs", "we:scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt", "we:scripts/lib/__tests__/codex-model-routing.test.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Graduate judge spawns and review-pr changes (incl. antigravity-judge-spawn) from lane/mechanical-dispatcher to main

Ports 17 files (we:scripts/lib/antigravity-judge-spawn.mjs, we:scripts/lib/codex-judge-spawn.mjs, we:scripts/lib/judge-spawn.mjs, we:scripts/lib/judge-panel.mjs, we:scripts/lib/jury-core.mjs, we:scripts/lib/review-core.mjs, we:scripts/lib/review-escalation.mjs, we:scripts/lib/review-render.mjs, we:scripts/operations/review-pr.mjs, we:scripts/operations/review-pr-io.mjs, we:scripts/operations/record-verdict-io.mjs, we:scripts/operations/review-loop-cli.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/lib/model-capability-ratings.mjs, we:scripts/lib/model-capability-ratings.json, we:skills-src/review/review-agent-brief.md) plus their tests. we:scripts/operations/review-pr.mjs, we:scripts/operations/cli-adapter.mjs and we:scripts/lib/codex-judge-spawn.mjs were also changed on main: diff-merge. Main also changed these files, so each gets a diff-merge: we:scripts/operations/review-pr.mjs, we:scripts/operations/cli-adapter.mjs, we:scripts/lib/codex-judge-spawn.mjs. Graduation slice of epic #3443 (see its Slice procedure). FAITHFUL PORT: no behaviour change while porting; the branch code lands as-is (operator, 2026-09-22). Port from snapshot 600acc14f of origin/lane/mechanical-dispatcher. For every file main has changed since the merge base ca7e68b71 (check with git log ca7e68b71..origin/main -- <file>), apply the branch diff onto main's current file; never copy the branch file over it. Add only this slice's own lines to we:scripts/operations/run.mjs and the we:scripts/operations/__tests__/http-adapter.test.mjs pin (append-only, so parallel slices merge cleanly). Full gate on main's tree: check:standards, test, smoke. Hold lifted 2026-09-24: the #3857 model-tier table passed a live probe and the operator started wave A.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/antigravity-judge-spawn.integration.test.mjs we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs we:scripts/lib/__tests__/codex-judge-spawn.test.mjs we:scripts/lib/__tests__/judge-panel.test.mjs we:scripts/lib/__tests__/judge-spawn.test.mjs we:scripts/lib/__tests__/review-core.test.mjs we:scripts/lib/__tests__/review-escalation.test.mjs we:scripts/operations/__tests__/review-loop-cli.test.mjs we:scripts/operations/__tests__/review-pr-io.test.mjs we:scripts/operations/__tests__/review-pr.test.mjs we:scripts/operations/__tests__/judge-provider-port.test.mjs we:scripts/operations/__tests__/judge-provider-selection.test.mjs we:scripts/operations/__tests__/juror-flags.test.mjs we:scripts/operations/__tests__/record-verdict-cli.test.mjs we:scripts/lib/__tests__/codex-model-routing.test.mjs` passes on main's tree (all of this slice's tests; each fails before the port because its module is missing or differs).
2. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
3. **Faithful port** — for each ported file, `git diff 600acc14f -- <file>` (prototype snapshot vs main after the port) shows only main's own later changes kept by the merge notes, never a behaviour change of the branch code; runtime data files (e.g. `we:scripts/conveyor/run-scorecards.json`) are never edited.

### Merge notes for #3907 (2026-09-22)

**Card scope correction.** The card says only 3 files changed on both sides. Main has actually changed 10 of the card's source files since `ca7e68b71`, plus 10 of its test/brief files. Only three files are branch-only and can be copied as-is: we:scripts/lib/judge-spawn.mjs, we:scripts/lib/judge-panel.mjs and we:scripts/lib/jury-core.mjs. Everything else needs a 3-way merge.

**Root cause of most conflicts.** Card #3704 (Codex as the third judge) was cherry-picked into both histories. The pairs `b36e0f2fd`/`06e96a884` and `f968bcefd`/`20e26c3cb` are identical twins. Main then added review fixes on top (#2115/#2117 rounds: env allowlist, scratch HOME, advisory seat can't block, roster read from the saved run, `advisory:*` labels). The branch added seats 4 and 5, probation defaults, transcript and scorecard recording, and `review:awaiting-advisory`. Most conflicts are these two layers touching the same 3704 lines.

**Dependencies (must land first).**
- #3893 provides we:scripts/lib/model-probation.mjs (+ `.json`) and we:scripts/conveyor/run-quality-record.mjs (with its scorer and subject-class imports).
- #3897 provides we:scripts/lib/codex-model-routing.mjs.
- #3901 provides we:scripts/operations/session-role.mjs, which is imported by we:scripts/lib/judge-spawn.mjs.
- we:scripts/lib/antigravity-judge-spawn.mjs is in this card's own scope. Add it before the files that import it: we:scripts/operations/review-pr.mjs and we:scripts/operations/cli-adapter.mjs.
- Everything else the branch imports already exists on main: `hasReviewLabel`, `FENCED_DATA_RULE`, `fenceUntrusted`, `MUTATION_PROBE_RULE`, `buildMandate`, `CODEX_MODEL` in we:scripts/codex-direct-task.mjs, and `hasJsonFlag`.

#### we:scripts/lib/codex-judge-spawn.mjs
- **Main:** added `CODEX_SPAWN_ENV_ALLOWLIST` and `defaultCodexSpawnEnv` (the child process gets an allowlisted env and a scratch `HOME`). Also fixed `requireAllProperties`, widened enum+null handling, and made the `allowedTools` check test for an empty list correctly. Main still says "tool-free" and still calls the guard `assertNoCodexTools`.
- **Branch:**
  - Rewords the seat from "tool-free" to "read-only shell" and renames `assertNoCodexTools` to `assertNoCodexToolAllowlist`, with a new error text.
  - Uses #3635's shared `CODEX_EFFORT_MAP` (no more clamping) and always passes `-m CODEX_MODEL` via `assertCodexModel`.
  - Saves the judge's raw output to disk (`resolveCodexJudgeTranscriptDir`, `persistCodexJudgeTranscript`, `transcriptFile` in the result).
  - Calls `recordCodexRunScorecard` (#3383).
- **Trial merge:** against the real base it is an add/add file with 19 conflicts. Use commit `b36e0f2fd`'s copy of `we:scripts/lib/codex-judge-spawn.mjs` as the base instead; it is identical to the branch's twin. That leaves **2 conflicts**:
  1. The block just before the `CODEX_EFFORT_MAP` doc. **Keep both:** main's `CODEX_SPAWN_ENV_ALLOWLIST` + `defaultCodexSpawnEnv`, then the branch's `export { CODEX_EFFORT_MAP }` and `export { CODEX_MODEL }` docs. Main's local `CODEX_EFFORT_MAP` constant is removed automatically.
  2. The `codexJudgeSpawn` JSDoc for `opts.cwd`/`opts.env`. Use the branch's "read-only-shell" `cwd` wording plus main's long `opts.env` doc.
- **Risk:** main's we:scripts/lib/__tests__/codex-judge-spawn.test.mjs imports `assertNoCodexTools` and matches `/TOOL-FREE panelist only/`. Both break with the rename. Take the branch's test for those cases. Main's comment in cli-adapter that names `assertNoCodexTools` also needs updating.

#### we:scripts/operations/cli-adapter.mjs
- **Main:** the Codex provider, plus `stripForCodex` (drops the request `model` and an empty `allowedTools` for Codex). Codex never gets the lane `cwd`. The tool check is `length > 0`.
- **Branch:** Codex provider, plus `'antigravity'` in `JUDGE_PROVIDER_NAMES`, `TOOL_FREE_JUDGE_PROVIDER_NAMES`, and a `CODEX_MODEL`/`ANTIGRAVITY_MODEL` default in `resolveJudgeProvider`. Adds `cwdFlagValue`, and adds `model` to the call only when it is defined (Gap 2).
- **Trial merge: 8 conflicts.**
  1. Imports: take the branch (it is a superset).
  2. `CONTROL_FLAGS`/`JUDGE_PROVIDER_NAMES`: take the branch.
  3. `resolveJudgeProvider`: take the branch's function and `TOOL_FREE_JUDGE_PROVIDER_NAMES`, and **keep main's `stripForCodex`**.
  4. `createDefaultJudge` JSDoc: take the branch.
  5. `createDefaultJudge` JSDoc: take the branch.
  6. Per-request provider block: take the shared part and **append main's `const declared = effectiveProviderName === 'codex' ? stripForCodex(request) : request;`**.
  7. The `effective` line: `(model && !TOOL_FREE_JUDGE_PROVIDER_NAMES.includes(effectiveProviderName)) ? { ...declared, model } : declared`. This uses `declared`, not `request`.
  8. Tool guard: take the branch's guard. It still reads `effective`, so an empty list for Codex was already stripped and does not throw. Its message still matches `/TOOL-FREE panelist only/`.
- **Risk:** main's cwd line merges cleanly as `effectiveProviderName !== 'codex'`, so Antigravity still gets the lane cwd. That matches the branch, and the branch doc says cwd has no effect there. Leave it. With `stripForCodex` in place, Codex always runs on `CODEX_MODEL`, because a request-level model is dropped before the default applies.

#### we:scripts/operations/review-pr.mjs
- **Main:** third seat (Codex), `codexAdvisoryFromRun`, advisory seat left out of the verdict inputs (`verdictAdmitted`/`panelLensVerdicts`), `ADVISORY_LABEL` effect, delegation-trial logging, and the advisory round cap.
- **Branch:** third seat plus `CODEX_ADVISORY_SANDBOX_CORRECTION`. Seat 4 (`judgeCorrectnessAdvisory`, lens `codex-correctness`), seat 5 (`judgeAntigravityReview`). Env readers that default from probation when the env var is unset. `lensProviders`, `degradedBasis`, `AWAITING_ADVISORY_CLEAR`, and the round cap.
- **Trial merge: 13 conflicts** in diff3 mode (15 in default mode, same regions).
  1. Imports: take the union. Main's `REVIEW_PR_CHANNEL` and `ADVISORY_OUTCOMES`, plus the branch's `REVIEW_LABELS`, `hasReviewLabel`, `liveProbationStatusFor`, `CODEX_MODEL` and `ANTIGRAVITY_MODEL`. Keep one `ADVISORY_NOTE_MARKER` import.
  2. Seat constants block: take the branch block and **re-add main's `codexAdvisoryFromRun`**.
  3. `REVIEW_EFFECTS`: keep both `ADVISORY_LABEL` and `AWAITING_ADVISORY_CLEAR`.
  4. Advisory request builders: take the branch (superset).
  5. `reviewPrOperation` JSDoc: take the branch.
  6. `reviewPrOperation` signature: take the branch.
  7. Registration checks and the `seats` list: take the branch (superset).
  8. Judge step declarations: take the branch.
  9. `reduce` reads: take the branch.
  10. `reduce` seats list: take the branch (adds `provider`).
  11. After `lensVerdicts`: **keep both** main's `panelLensVerdicts` and the branch's `lensProviders`.
  12. `advise` effects: rewrite as `const effects = [note]`. Push `AWAITING_ADVISORY_CLEAR` if the PR has the awaiting label, then push `ADVISORY_LABEL` if there is an outcome, then `return effects`. Main's early `return [note]` and `return [note, {...}]` must go.
  13. Roster check comment: take the branch.
- **Semantic risk (the textual merge will miss it):** main's cleanly merged line `if (seat.step !== ADVISORY_JUDGE_SEAT.step) verdictAdmitted…` keeps only seat 3 out of the verdict. Seats 4 and 5 would still feed `derivePanelVerdict`'s `findings` prevention scan. That scan ignores `mandatoryLenses`, so those advisory seats could return `prevention-outstanding` and block. Extend the exclusion to `[ADVISORY_JUDGE_SEAT, CORRECTNESS_ADVISORY_SEAT, ANTIGRAVITY_REVIEW_SEAT].map(s => s.step)`. This keeps the branch's stated rule that advisory seats never block.
- **Behaviour note:** the branch's probation default turns the Codex (and Antigravity) seats **on by default** when the env var is unset and the registry says probation or trusted. That is intended by the port, but it is a real change to main's default review runs.

#### we:scripts/operations/record-verdict-io.mjs (2 conflicts)
- **Imports:** `codexAdvisoryFromRun`, `correctnessAdvisoryFromEnv`, `antigravityReviewFromEnv`. Drop `codexAdvisoryFromEnv`, which becomes unused.
- **Registration:** `codexAdvisory: codexAdvisoryFromRun(record)`, which is main's fix. Seats 4 and 5 use their `…FromEnv()` readers, as on the branch.
- **Risk:** on resume, seats 4 and 5 still read their roster from the env. That is the drift main fixed for seat 3. File a follow-up for `…FromRun` versions; don't fix it inside this faithful port.

#### we:scripts/operations/review-pr-io.mjs (3 conflicts)
- **JSDoc:** list `labelProvider`, `readLabels` and `setLabels`.
- **Parameters:** keep main's `labelProvider = createGhProvider()` and the branch's `readLabels`/`setLabels` defaults side by side.
- **Sinks:** keep both the `ADVISORY_LABEL` and `AWAITING_ADVISORY_CLEAR` sinks.

#### we:scripts/lib/review-render.mjs (1 conflict)
- JSDoc: keep both the `resolutionBasis` and `lensProviders` docs and typedef fields. The function body merged cleanly with both.

#### Clean merges (0 conflicts)
- we:scripts/lib/review-core.mjs, we:scripts/lib/review-escalation.mjs (adds `review:awaiting-advisory` and its meta, so the existing label loop creates it), we:scripts/operations/review-loop-cli.mjs, we:scripts/merge-ai-prs.mjs.
- we:scripts/lib/model-capability-ratings.mjs/.json are identical on both sides, so there is nothing to do.
- The review-loop-cli merge needs `cwdFlagValue` from the merged cli-adapter. It passes `cwd` to `resolveOperation`, which main already ignores harmlessly.

#### Tests and brief (both sides changed)
Conflict counts:

| File | Conflicts |
|---|---|
| we:scripts/operations/__tests__/review-pr.test.mjs | 4 |
| we:scripts/lib/__tests__/codex-judge-spawn.test.mjs | 4, using the twin base `06e96a884` |
| we:scripts/operations/__tests__/judge-provider-selection.test.mjs | 1, using the twin base |
| we:scripts/operations/__tests__/review-pr-io.test.mjs | 1 |
| we:scripts/operations/__tests__/juror-flags.test.mjs | 1 |
| we:scripts/operations/__tests__/helpers/fake-claude.mjs | 1 |
| we:skills-src/review/review-agent-brief.md | 2 |
| we:scripts/operations/__tests__/record-verdict-cli.test.mjs | 0 |
| we:scripts/lib/__tests__/review-escalation.test.mjs | 0 |
| we:scripts/lib/__tests__/review-core.test.mjs | 0 |

Most conflicts are blocks both sides appended. Keep both, except the `assertNoCodexTools` cases noted above. The `advise` effect index tests will need adjusting for the new effect order.

#### Worker steps
1. Confirm #3893, #3897 and #3901 are on main. Then add we:scripts/lib/antigravity-judge-spawn.mjs and its tests from `ff1618065`.
2. Copy the three branch-only files: we:scripts/lib/judge-spawn.mjs, we:scripts/lib/judge-panel.mjs, we:scripts/lib/jury-core.mjs.
3. For each file changed on both sides: run `git merge-file main base branch`. For we:scripts/lib/codex-judge-spawn.mjs and the two twin-born tests, use `b36e0f2fd`/`06e96a884` as the base.
4. Resolve each conflict as listed above.
5. Apply the two semantic fixes. Leave all three opt-in seats out of `verdictAdmitted`. Build `effects` as note → awaiting-clear → label.
6. In we:scripts/operations/record-verdict-io.mjs, keep `codexAdvisoryFromRun(record)` and add the seat 4/5 env readers. File the `…FromRun` follow-up.
7. Update leftover `assertNoCodexTools` mentions in code and tests to `assertNoCodexToolAllowlist`.
8. In we:scripts/operations/run.mjs, add only this slice's lines: import `correctnessAdvisoryFromEnv` and `antigravityReviewFromEnv`, and pass them to `reviewPrOperation`. Add only the review-pr op pin in we:scripts/operations/__tests__/http-adapter.test.mjs.
9. Run the gates: `check:standards`, `test` (especially review-pr, judge-provider-selection, codex-judge-spawn and record-verdict-cli), and `smoke`.

Nothing was edited in any checkout. Trial merges are in the scratchpad under `merge/<basename>/`.

### Designer rulings (2026-09-22)

- Also owns `we:scripts/lib/__tests__/codex-model-routing.test.mjs` (moved from #3897), hence the new blocker #3902.
- **Behaviour change the operator was told about:** a faithful port turns the Codex and Antigravity advisory seats on by default for main's reviews whenever the model-probation registry marks them probation or trusted.

### Addendum: snapshot moved to 600acc14f (2026-09-23)

`we:` prefixes below are repo-relative paths.

**`we:scripts/lib/jury-core.mjs`** — still **0 conflicts**, still safe to "copy as-is" exactly as the existing
note says. One nuance worth recording: this file is NOT branch-only in the sense of "doesn't exist on main" —
it's a long-lived main file (created 2026-07-24) that main simply has not touched since the merge base
`ca7e68b71` (`git diff ca7e68b71 origin/main -- we:scripts/lib/jury-core.mjs` is empty), so a straight copy of
the branch's file is byte-safe. New branch content on top of the old note's snapshot:
- **Rule 7 of #3690 (#3887)**: `FLOOR_MAX_FINDINGS = 3` and `recordFloorRun({findings, jurorCount, rounds,
  tokens, wallTimeMs})` — records one floor-depth (`spot-check`) independent-pass run's verdict AND cost.
  Deliberately NOT a `VERDICTS` member (floor runs are structurally non-blocking, per `#3313`). Consumed by
  `we:scripts/operations/review-dispatch.mjs` (#3908's scope) via the `we:scripts/lib/dispatch-contracts.mjs`
  (#3897's scope) `independentReviewDepthFor` contract — see #3897's own addendum for that half.

**`we:scripts/lib/__tests__/jury-core.test.mjs`** — still **0 conflicts** (confirmed: `git diff ca7e68b71
origin/main -- <file>` is also empty, base == main). Straight copy, same as its module.

**`we:scripts/operations/__tests__/helpers/fake-claude.mjs`** — still **1 conflict**, same region and same
resolution as the existing note (the `--bg` id-generation block: `generated-N` vs a real `randomUUID()`).
New branch content merges CLEAN, outside the conflict: a `--model`/`-m` flag-recording arm (tagged `#3857`)
was added to the shim's argv parser, since `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` (this
card's dependency, #3906's scope) can now inject `--model` for the model-tier table. No action needed beyond
the existing resolution.

No worker-step changes — the existing note's steps 1–9 still apply as written for these three files.

### Port notes (2026-09-25)

- Ported from `600acc14f`. The 3-way merges used base `ca7e68b71`. Two groups used the #3704 twin `f968bcefd` as base instead, which gives fewer and smaller conflicts: the add/add files (we:scripts/lib/codex-judge-spawn.mjs, its test, and we:scripts/operations/__tests__/judge-provider-selection.test.mjs), and four twin-born files (we:scripts/operations/review-pr.mjs, we:skills-src/review/review-agent-brief.md, we:scripts/operations/__tests__/review-pr.test.mjs, we:scripts/operations/__tests__/juror-flags.test.mjs).
- The two semantic fixes from the merge notes are applied. `ADVISORY_SEAT_STEPS` keeps seats 3, 4 and 5 out of `verdictAdmitted`. `advise` builds its effects as note, then awaiting-clear, then label.
- we:scripts/operations/run.mjs also takes the branch's `cwd` threading into the review-pr reader (#xu2pp2m). The ported we:scripts/operations/__tests__/review-pr-io.test.mjs pins it, and the ported review-loop-cli already passes `cwd`.
- Three main-side asserts in we:scripts/operations/__tests__/judge-provider-selection.test.mjs expected a Codex request to reach the spawn with no `model`. The branch's `CODEX_MODEL` default plus main's `stripForCodex` now give it the pinned Codex model, never the Claude name. The merge notes predicted this.
- **Follow-up owed (not fixed here, to keep the port faithful):** on resume, we:scripts/operations/record-verdict-io.mjs still reads seats 4 and 5 from the env (`correctnessAdvisoryFromEnv`/`antigravityReviewFromEnv`). They need `…FromRun` readers like seat 3's `codexAdvisoryFromRun`. Not filed from this lane, because the lane may only edit this card.
