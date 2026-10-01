---
bornAs: xkkm28u
kind: story
size: 2
status: resolved
scope: ["we:skills-src/conveyor/prepare-item-worker-brief.md", "we:skills-src/conveyor/prepare-item-agent-brief.md"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Prepare worker must correct a stale premise or scope, not stop

Live 2026-09-30: three of three Codex prepare runs (#4397, #4383, #4398) stopped with could-not-prepare because the card's premise or scope was stale (code moved: e.g. the catch now lives in laneLivenessGate at we:scripts/lib/lane-salvage.mjs:371). Root cause: we:skills-src/conveyor/prepare-item-worker-brief.md:10 says "If scope needs correction ... report could-not-prepare and stop", which contradicts what prepare is for (check the premise against main and correct the scope). Every stale card therefore bounces and never gets prepared. Fix: the brief tells the worker to correct factual drift in the card itself (moved code, stale file:line, missing test paths, narrower/wider scope) and record what changed; stop with could-not-prepare only for a genuine judgment call / design fork, or when the goal is already delivered (then report already-done with the commit). Mirror in we:skills-src/conveyor/prepare-item-agent-brief.md. Proof: re-run prepare on #4397/#4383/#4398 and show stamped cards with corrected scope.

## Done when

1. Both briefs authorize factual premise/scope corrections and record evidence; unresolved judgment/design forks still stop, and already-delivered goals return `already-done` with the delivering commit.
2. Replay preparation of #4397, #4383 and #4398 with corrected scopes and real preparation stamps; keep the implementation diff confined to the two briefs.
3. The following executable contract probe fails before and passes after (run from the checkout):

```bash
node <<'JS'
const fs = require('node:fs');
const assert = require('node:assert/strict');
for (const name of ['worker', 'agent']) {
  const path = `we:skills-src/conveyor/prepare-item-${name}-brief.md`;
  const s = fs.readFileSync(path.slice(3), 'utf8');
  assert.match(s, /Correct factual drift/, name + ': authorize factual correction');
  assert.match(s, /scope:/, name + ': permit scope edit');
  assert.match(s, /Progress/, name + ': record evidence');
  assert.match(s, /already-done/, name + ': retain delivered-goal exit');
  assert.match(s, /genuine.*judgment.*design fork/, name + ': retain human fork stop');
  assert.doesNotMatch(s, /If scope needs correction.*stop|resolve it instead with|except the one premise-check exit/);
}
console.log('PASS: both briefs correct drift and preserve stop boundaries');
JS
```


## Design

Authorize factual corrections to the card body and `scope:` in both briefs while preserving the original goal and other metadata. Require old/new premise and scope plus code evidence in Progress. Distinguish factual drift from judgment that research cannot settle. Remove the agent brief's contradictory already-done resolve exception: both briefs stop with the delivering commit. Worker stamping remains runner-owned; agent stamping remains in its existing lifecycle.

## MVP

Only the two declared briefs change behavior. No runner, gate, lifecycle implementation, shared agent documentation or original proof-case cards change.

## Test plan

Run the contract probe above against the old and new briefs; review all stop rules and frontmatter permissions for contradictions. Run `node we:scripts/verify-lane.mjs` (strip the locus prefix when executing).

## Proof plan

Manually repeat the preparation method on copies of the three reported cards against this checkout, inspecting current source and authoring all five sections. Stamp those copies through `node we:scripts/backlog.mjs prepare-stamp <id> --backlog-dir=<fixture-directory>` in the lane. This exercises real preparation and the stamp writer without dispatching commits or PRs. Preserve the stamped results below so proof survives removal of local fixtures.

## Progress

- 2026-09-30 BEFORE: the executable probe exited 1 with `AssertionError: worker: authorize factual correction`. The old worker prohibited scope edits and explicitly stopped when scope needed correction. The old agent brief escalated wrong premises and resolved already-done items despite its normal no-resolve rule.
- AFTER: the same probe exited 0: `PASS: both briefs correct drift and preserve stop boundaries`. Worker scope permission, correction evidence, genuine-fork stop, delivered-goal exit and runner-owned stamping were reviewed together; the mirrored agent rule keeps its own stamp lifecycle.
- Validation: verifier-selected tests passed (2 files, 180 tests); the unchanged standards checker exited 0 with 0 errors and 4521 warnings; `git diff --check` passed. Required `node we:scripts/verify-lane.mjs` was attempted but sandbox EPERM blocked its marker under `we:.git/`. Its supported `run` mode and `npm run check:standards` also hit the host-shared admission-directory write restriction before checks. Ran the exact selected Vitest command and `node we:scripts/check-standards.mjs` directly; no test, checker or gate implementation changed, and no green lane marker is claimed.
- Preparation replay: manually applied the edited method to the three real cards copied under ignored `we:node_modules/.cache/we-4658-proof/`. This is a local manual replay, **not a new Codex dispatch or a measured three-run model success rate**. All three sanctioned `prepare-stamp` commands exited 0. Original cards remain unchanged to respect this card's declared implementation scope. Stamped snapshots follow; each contains the five authored preparation sections and old/new evidence.

<details>
<summary>#4397 — stamped preparation replay</summary>

```yaml
bornAs: x7pj0mw
kind: task
parent: "4075"
status: open
blockedBy: ["4273"]
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/lib/__tests__/lane-salvage.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "d6b9bed7a74c0b2d04a921205a25d15818cb345a"
tags: []
```

## Design

Classify entries with the existing lstat result in copyLitterTreeSync before copyFileSync. Copy regular files, directories and symlinks as today. For sockets, FIFOs and devices, record relative path and special-file reason in the persisted salvage litter metadata, propagating nested skips to salvageLane. Preserve throws on regular-file read/copy errors and bundle verification failures.

## MVP

Handle and record special entries at top level and nested within litter. Preserve ordinary content and fail-closed behavior for real copy errors. No reclaim policy changes.

## Test plan

Add a real Unix socket fixture at top level and nested in litter; salvage must complete, retain a neighboring regular file and report each skipped path and reason in the index. Existing unreadable-directory test must still throw. Close sockets in finally. The current copyFileSync path fails the special-entry case.

## Proof plan

Run the real socket salvage fixture before and after; inspect the returned result and persisted index, and verify regular bytes survived. Run npx vitest run we:scripts/lib/__tests__/lane-salvage.test.mjs (strip the we: locus prefix when executing).

## Follow-ups

No implementation is part of this preparation proof. Build and mutation validation remain the eventual delivery task.

## Progress

2026-09-30 manual prepare replay for #4658 against the current checkout: Before: the card names recursive cpSync and omits the test file. After: we:scripts/lib/lane-salvage.mjs:428 owns copyLitterTreeSync; its fallback at line 436 uses copyFileSync on every non-directory/non-symlink, including special entries. The salvage caller at line 493 still propagates that failure. Add the existing test file to scope.

</details>

<details>
<summary>#4383 — stamped preparation replay</summary>

```yaml
bornAs: xggb0ep
kind: task
status: open
scope: ["we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "d6b9bed7a74c0b2d04a921205a25d15818cb345a"
tags: []
```

## Design

Thread the required-check result already computed by reconciliation through runReviewTick to tagReviewStatus and deriveReviewStatus. Use the same required-check classifier rather than judging optional failures. Extend STATUS_LABEL_RE with ci-red. Preserve live review/fix/heal precedence; at the idle fallback distinguish pending required checks from completed required failure. For draft completed-red, emit the requested owed-to-author label alongside ci-red using the existing provider label port, clearing that signal once no longer owed. Missing check evidence must not become red.

## MVP

Cover required pending, green and completed-red on draft/non-draft; wire the real daemon caller, label provisioning and author signal cleanup. Historical PR backfill is excluded.

## Test plan

Pure derivation tests for pending/green/red and live-agent precedence; provider-spy tests for ci-red plus draft author signal and cleanup; runReviewTick test proves completed required-failure evidence reaches tagStatus. Current code cannot receive the evidence and returns awaiting-ci for draft red.

## Proof plan

Run npx vitest run we:scripts/conveyor/__tests__/review-status-tag.test.mjs we:skills-src/conveyor/__tests__/review-daemon.test.mjs (strip we: when executing). Feed a completed failed required check through runReviewTick with injected reads/provider; before is awaiting-ci, after ci-red plus draft author signal, without changing remote labels.

## Follow-ups

No implementation is part of this preparation proof. Build and mutation validation remain the eventual delivery task.

## Progress

2026-09-30 manual prepare replay for #4658 against the current checkout: Before: scope named only the tagger and claimed it already derives check-run states. After: we:scripts/conveyor/review-status-tag.mjs:92 has no CI input and line 152 unconditionally maps an otherwise idle draft to awaiting-ci. we:skills-src/conveyor/review-daemon.mjs:383 passes draft/conflict facts but no CI facts. Add the real caller and both test files.

</details>

<details>
<summary>#4398 — stamped preparation replay</summary>

```yaml
bornAs: xycb80x
kind: task
parent: "4075"
status: open
blockedBy: ["4273"]
scope: ["we:scripts/lib/__tests__/lane-salvage.test.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "d6b9bed7a74c0b2d04a921205a25d15818cb345a"
tags: []
```

## Design

Exercise the exported laneLivenessGate with a real temporary git lane and unreadable nested litter, empty injected agent and cwd readers, positive quietMs and fixed nowMs. First prove newestContentMtimeMs throws on this fixture. Assert the actual gate returns eligible:false for the quiet-period reason. Restore permissions in finally. No production seam is needed.

## MVP

One regression for the existing exported production gate, plus a quiet readable control. No production logic change and no mirrored eligibility expression.

## Test plan

Use the existing non-root unreadable-directory fixture discipline. The throw precondition prevents a root-run false green. Mutating the production catch to newestMtimeMs=null must make the new test fail; restoring nowMs must pass. The readable aged control must be eligible.

## Proof plan

Run npx vitest run we:scripts/lib/__tests__/lane-salvage.test.mjs as a non-root user (strip we: when executing), then the catch mutation probe and restore. Capture refusal from laneLivenessGate itself, not a reconstruction.

## Follow-ups

No implementation is part of this preparation proof. Build and mutation validation remain the eventual delivery task.

## Progress

2026-09-30 manual prepare replay for #4658 against the current checkout: Before: scope was we:scripts/lane-pool.mjs and the body described an unexported local catch. After: we:scripts/lane-pool.mjs:3759 delegates to the exported laneLivenessGate; we:scripts/lib/lane-salvage.mjs:371 catches newestContentMtimeMs errors. Existing tests at we:scripts/lib/__tests__/lane-salvage.test.mjs:90 cover owner/process/read failures but not this exception. Narrow scope to the test file.

</details>

## Follow-ups

The local replay demonstrates the revised method and stamp path; a future production dispatch can measure model compliance with the revised wording. Do not run the normal producer in this job: the operator explicitly forbids commits, pushes and PRs. Test lessons stay here rather than in shared agent documentation.
