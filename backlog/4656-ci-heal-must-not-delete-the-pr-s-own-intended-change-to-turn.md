---
bornAs: xcvjznh
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/ci-heal-revert-check.mjs", "we:scripts/conveyor/__tests__/ci-heal-revert-check.test.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:skills-src/conveyor/brief-rule-ledger.json"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# CI-heal must not delete the PR's own intended change to turn CI green

Live 2026-09-30: PR #3103 (cut GitHub App GraphQL spend) routed the drain's gh calls through the throttle. Its drain soak tick then timed out at 90s, and the CI-heal session fixed the red check by removing the throttled transport from we:scripts/merge-ai-prs.mjs (commit 3dabd061b, "drop throttled execFileSync"). CI went green, review accepted, the PR merged — and the drain stayed unmetered, so the bucket kept running out (see we:reports/2026-09-30-unmetered-app-graphql-spend.md). Root cause: nothing stops a heal from reverting part of what the card promised; the heal brief optimises for green, and review judged the final diff, not the heal against the card. Fix: (1) the ci-heal brief forbids removing or disabling the card's promised change; a heal that cannot fix the cause escalates (review:human with the reason) instead; (2) a mechanical check flags a heal commit that deletes lines the PR itself added under the card's scope, and routes it to review with that flag; (3) review of a healed PR re-checks the card's Done-when against the final diff. Proof: replay the #3103 heal and show it is flagged/escalated rather than landed.

## Progress

Premise checked against main at e1f0523e0. The live case holds:

- PR #3103 had no backlog card (branch `lane/gh-spend-git-facts`, commits titled `PR #3103:`). Its fork point is `43308207a`. Commit `d7bae38fb` added the import of `execFileSyncThrottled as execFileSync` from we:scripts/lib/gh-throttle.mjs to we:scripts/merge-ai-prs.mjs. The heal `3dabd061b` (parent `4bd8c1513`, the head that heal examined) deleted it and put `execFileSync` back on the `node:child_process` import.
- A prototype of the check below, run over the whole PR (base `43308207a`, examined `4bd8c1513`, heal `3dabd061b`), flags exactly 2 lines, both in we:scripts/merge-ai-prs.mjs: the throttled import and the PR's edited `node:child_process` import. The same check on the earlier, legitimate heal `4bd8c1513` (examined `5388156ec`) flags 0 lines.

Drift corrected:

- Old scope `we:scripts/conveyor/ci-heal-pr-dispatch.mjs` does not exist. The file is we:scripts/operations/ci-heal-pr-dispatch.mjs, and it only plans and dispatches heals (`dispatchCiHeal`, `we:scripts/operations/ci-heal-pr-dispatch.mjs:104`). It never sees the heal's commits, so the check does not belong there. Dropped.
- Old scope `we:skills-src/conveyor/` (a directory) → two exact files: we:skills-src/conveyor/fix-agent-ci-brief.md and we:skills-src/conveyor/brief-rule-ledger.json.
- The real hand-back point is `handBackCiHealReview` (`we:scripts/conveyor/ci-heal-mark.mjs:263`). Both heal paths reach it: the brief's step 7 CLI (`we:scripts/conveyor/ci-heal-mark.mjs:350`) and the probation wrapper's `markHealed` (`we:scripts/operations/probation-heal-run.mjs:556`). Today it carries a live `review:accepted` onto the healed head through `spawnCiHealRestamp` (`we:scripts/conveyor/ci-heal-mark.mjs:213`). That carry is how a reverting heal can keep an old acceptance. Scope now names these files and their tests.
- Part (3) ("review re-checks Done-when against the final diff"): the automated review path lives in we:scripts/operations/review-pr-io.mjs and we:scripts/lib/jury-core.mjs, which open PR #3507 is changing. This card does (3) through the human gate instead. A flagged heal is parked `review:human`, which only a human can clear (`decideParkToHuman`, `we:scripts/lib/review-escalation.mjs:1990`; INVARIANT 2 at `we:scripts/review-set-label.mjs:29`). The park comment tells that reviewer to re-check the card's Done when against the final diff. A machine-side re-check for every healed PR is a follow-up (below).
- "Lines the PR added under the card's scope" → "lines the PR added". The PR's own added lines already are its intended change. An item-less PR like #3103 has no card scope at all (its scope is diff-derived by `resolvePrWorkUnit`). A heal that removes a PR-added line outside the card's scope does the same harm. So there is no scope filter.

## Design

**New module we:scripts/conveyor/ci-heal-revert-check.mjs** — a pure core plus a thin git reader.

- `parseAddedLines(diffText)` → `Map<file, string[]>`. Reads a `git diff --unified=0 --no-color` text. A `+++ b/<path>` header sets the current file; `+++ /dev/null` clears it. Every following `+` line (not `+++`) is recorded for that file, without its leading `+`.
- `findRevertedPrLines({ addedBefore, healedFiles })` → `Array<{ file, line }>`. `addedBefore` is the `parseAddedLines` result for the PR's net diff at the examined head. `healedFiles` maps each of those files to its full text at the heal head, or `null` when the file is gone. Lines are counted as a multiset per file. A PR-added line is "reverted" when no unused copy of it is left in the healed file. Lines with no letter or digit (`}`, `);`, blank) are skipped, so pure punctuation never flags. Output order: file, then diff order.
- `readHealRevertEvidence({ cwd, examinedHead, healHead, base = 'origin/main', exec = execFileSync })` → `{ addedBefore, healedFiles, mergeBase }`. Runs `git merge-base <examinedHead> <base>`, then `git diff --unified=0 --no-color <mergeBase> <examinedHead>`, then `git show <healHead>:<file>` per file (a failed show means the file is gone → `null`). All reads use `-C cwd` and a 64 MiB `maxBuffer`. No GitHub calls. Any other git failure throws.
- `detectHealRevert(opts)` = `readHealRevertEvidence` then `findRevertedPrLines`. Returns `{ lines, mergeBase }`.
- `HEAL_REVERT_MARKER` (first line `🚩 conveyor CI-heal — removed the PR's own change`) and `buildHealRevertComment({ examinedHead, healHead, lines, max = 20 })`. After the marker: `head: <healHead>` and `examined: <examinedHead>`. Then up to 20 entries of the form file + line, each line passed through `redactSecrets` (imported from the ci-heal-mark module) and cut to 200 chars, plus `…and N more` when cut. It ends: the heal turned CI green by deleting lines this PR added; the PR is parked `review:human`; the reviewer must re-check the card's Done when (or, for an item-less PR, its stated purpose) against the final diff before clearing it.
- A read-only CLI for proof and manual use: `--examined-head=<sha> --heal-head=<sha> [--base=<ref>] [--json]`. It prints the lines. Exit 3 when any line is flagged, 0 when clean, 1 on a read error.

**`handBackCiHealReview` in we:scripts/conveyor/ci-heal-mark.mjs** gains `examinedHead`, `base = 'origin/main'`, and two seams: `checkRevert = detectHealRevert` and `park = parkHealRevert`.

- No `examinedHead` → behaviour unchanged; the result adds `revertCheck: 'not-run'`.
- With `examinedHead`, after the labels read and before any restamp, call `checkRevert({ cwd, examinedHead, healHead: headSha, base })`.
  - Lines found → call `park({ pr, repo, labels, body: buildHealRevertComment(...), exec })`. Do NOT restamp, rearm or restore routing. Return `{ restamped: false, rearmed: false, revertCheck: 'flagged', revertedLines: n, parked: 'review:human' }`.
  - No lines → the existing path, with `revertCheck: 'clean'`.
  - `checkRevert` throws → never carry the acceptance. Skip `restamp`; call `rearm` when `review:accepted` is live (as the failed-restamp branch does today). Return `revertCheck: 'unavailable'` and `carryReason` = the error's first line.
- New `parkHealRevert({ pr, repo, labels, body, exec, post = postPrComment })`. It uses `decideParkToHuman({ currentLabels: labels, keepHumanClearance: false })`; the head just moved, so no human clearance can cover it. It adds `review:human`, removes each listed label that is live, and removes `ready-to-merge` when live (a park is a hold). Then it posts `body`. Label edits go first. A failed comment post is returned as `commentError`, never thrown.
- CLI: new flags `--examined-head=<sha>` and `--base=<ref>`, passed to `handBackCiHealReview`. The JSON output carries the new fields.

**we:scripts/operations/probation-heal-run.mjs**: `io.markHealed` gets `examinedHead` (the call at `we:scripts/operations/probation-heal-run.mjs:436`). The `attemptId` branch passes it to `handBackCiHealReview`. The CLI branch passes `--examined-head=<examinedHead>` and runs the CLI with `{ cwd }` (the lane). So its git reads, and `resolveHealHead`, run in the lane instead of the WE root.

**Brief we:skills-src/conveyor/fix-agent-ci-brief.md**:

- Step 3, a new bullet before the escalation outcomes: never remove, revert or disable the change this PR exists to make, even when that turns CI green. If the only green path deletes or disables lines the PR added for its card (or its stated purpose, for an item-less PR), do not commit it. Take the `needs-human` exit with `--reason="heal would remove the PR's own change: <file> — <what>"`. Step 7 checks this mechanically and parks such a heal `review:human`.
- Step 7: add `--examined-head="$EXAMINED_HEAD" --base="$BASE_SHA"` to the heal-mark call. Add one sentence: when the CLI reports `revertCheck: "flagged"`, the PR is now parked `review:human`; report `--outcome=escalated-needs-human` instead of `healed`.
- Guardrails: extend "Repair only the CI break" with "never delete or disable lines the PR added".

**Ledger we:skills-src/conveyor/brief-rule-ledger.json**: add enforcer `ci-heal-revert-check` (`kind: "wrapper"`, its `ref` = the new module's `findRevertedPrLines`, its `test` = the new test file). Add a rule for the new step-3 line with `status: "enforced"` and that enforcer. Take the line key and text from the ledger audit script, we:scripts/conveyor/brief-rule-ledger.mjs.

## MVP

1. Write we:scripts/conveyor/ci-heal-revert-check.mjs and its test.
2. Wire `handBackCiHealReview`, `parkHealRevert` and the two CLI flags in we:scripts/conveyor/ci-heal-mark.mjs; add the hand-back tests.
3. Pass `examinedHead` (and the lane `cwd`) from we:scripts/operations/probation-heal-run.mjs; add its test.
4. Edit the brief (step 3, step 7, guardrails) and add the ledger entry.

## Test plan

we:scripts/conveyor/__tests__/ci-heal-revert-check.test.mjs (vitest, new):

- `parseAddedLines collects + lines per file and skips headers and deleted files`.
- `findRevertedPrLines flags a PR-added line missing from the healed file (#3103 shape)` — the PR added the throttled import to the drain script; the healed text lacks it → exactly that `{ file, line }`.
- `a PR-added line that survives (moved or unchanged) is not flagged`.
- `counts as a multiset: a line added twice with one copy left flags one`.
- `ignores punctuation-only lines`.
- `a file deleted at the heal head flags all its PR-added lines`.
- `git replay: a heal that merges main and deletes the PR's import is flagged; a heal that only merges main is clean` — a temp git repo: a base commit; a PR commit adds the import line to one file; main advances with an unrelated file; heal A merges main and deletes the import → `detectHealRevert` returns exactly the import line; heal B only merges main and edits an unrelated test → `[]`.
- `buildHealRevertComment starts with the marker, carries head/examined, caps at 20 lines, and redacts a token in a line`.
- `CLI exits 3 with the flagged lines on the replay repo, 0 on the clean heal`.

we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs (vitest, extend):

- `heal that removed PR-added lines parks review:human and never carries the acceptance` — labels `review:accepted` + `ready-to-merge`; `checkRevert` returns one line. Asserts `park` got a body starting with `HEAL_REVERT_MARKER`, `restamp` and `rearm` were not called, and the result is `{ revertCheck: 'flagged', revertedLines: 1, parked: 'review:human' }`.
- `parkHealRevert adds review:human and strips review:accepted, review:pending and ready-to-merge, then comments` — fake `exec`/`post` record the calls in that order.
- `a clean revert check keeps the existing restamp path` (`revertCheck: 'clean'`).
- `unreadable revert evidence never carries the acceptance` — `checkRevert` throws; `restamp` is not called; `rearm` is; `revertCheck: 'unavailable'`.
- The existing `4878` test stays as is and now also sees `revertCheck: 'not-run'`.

we:scripts/operations/__tests__/probation-heal-run.test.mjs (extend):

- `markHealed receives the examined head` — the existing fake `io` records the `markHealed` argument; assert `examinedHead` equals the fake PR's `headRefOid`.

## Proof plan

Replay the live #3103 heal from real git objects (all are in main's history):

- Before: on main today nothing checks the heal. The revert-check CLI does not exist, and `handBackCiHealReview` would restamp a live acceptance onto `3dabd061b`.
- After: `node we:scripts/conveyor/ci-heal-revert-check.mjs --examined-head=4bd8c1513 --heal-head=3dabd061b --base=e8268403c^1 --json` exits 3 and lists the two import lines in we:scripts/merge-ai-prs.mjs.
- Control: `node we:scripts/conveyor/ci-heal-revert-check.mjs --examined-head=5388156ec --heal-head=4bd8c1513 --base=e8268403c^1 --json` exits 0 with no lines (the earlier, legitimate heal).
- Hand-back replay with no GitHub write: from a one-off `node -e` in the lane, call `handBackCiHealReview({ pr: 3103, headSha: <full 3dabd061b>, examinedHead: <full 4bd8c1513>, base: 'e8268403c^1', exec: <fake returning review:accepted>, park: <recorder>, restamp: <recorder> })`. Show that `park` got the marker body and `restamp` was not called. Paste all three outputs in the PR body.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/ci-heal-revert-check.test.mjs we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs we:scripts/operations/__tests__/probation-heal-run.test.mjs` passes (drop the `we:` prefix to run it). `we:scripts/conveyor/__tests__/ci-heal-revert-check.test.mjs` fails before this lands (the module does not exist) and passes after.
2. The #3103 replay CLI exits 3 and names the two import lines in we:scripts/merge-ai-prs.mjs; the control replay exits 0.
3. `handBackCiHealReview` with an `examinedHead` never restamps an acceptance on a heal that deleted PR-added lines; it parks `review:human` with the marker comment instead.
4. Both heal paths pass the examined head: the brief's step 7 command and the probation wrapper's `markHealed`.
5. The brief's step 3 forbids removing the PR's own change and names the `needs-human` exit; the ledger lists that line as enforced by `ci-heal-revert-check`.

## Follow-ups

- Machine review of every healed PR re-checks the card's Done when against the final diff (the automated half of part 3). It needs we:scripts/operations/review-pr-io.mjs to pass a "healed" flag into the review mandate. File it after open PR #3507 lands.
- The drain (we:scripts/merge-ai-prs.mjs) could run the same check at land time, as a backstop for a heal that skipped the hand-back. File only if a heal is seen bypassing it.
