---
kind: task
status: active
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs"]
relatedTo: ["3494"]
scaffoldedBy: "investigate-15-stuck-prs"
dateScaffolded: "2026-09-05"
dateOpened: "2026-09-05"
tags: [conveyor, gh, bug]
---

# parked-PR conflict watch never actually applies its conflict label -- repo resolves to null, gh fails on every write

we:scripts/conveyor/parked-pr-conflict-watch.mjs (landed #3494/PR #1927 as this repo's answer to the PR #1920 stale-conflict incident) correctly DETECTS a newly-conflicting review-parked PR every sweep (isParkedConflictTarget/planConflictLabelChange both fire correctly), but has NEVER successfully applied a single merge-status:conflicting label since landing. Root cause confirmed live 2026-09-05 running node we:scripts/conveyor/parked-pr-conflict-watch.mjs sweep directly: it correctly flagged PR #1932 (isConflicting:true, newlyDetected:true) then failed the actual gh label create call with 'expected the [HOST/]OWNER/REPO format, got null' -- watchParkedPrConflicts's repo parameter defaults to null and is passed straight through, unresolved, into we:scripts/lib/review-label-provider.mjs's GH_ARGV.ensureLabel/setLabels/postComment, which unconditionally splice --repo, repo into their argv with no null guard (unlike this same watch's OWN defaultListParkedPrs reader, which correctly guards with if (repo) argv.push(...)). Because the runner's default invocation (runQuiet(conveyor watch script, ['sweep'])) never passes --repo unless the runner ITSELF was started with one, repo stays null on every normal tick, and every write silently fails inside the pass's own best-effort try/catch. we:scripts/review-set-label.mjs (the provider's original, intended caller) already solves this correctly: it resolves repo once via provider.currentRepo() when repoOptional and no --repo was given, before any write -- the provider's own currentRepo() docblock says it exists exactly for this ('fires only when --repo was omitted'), but the parked-PR conflict watch never called it. Confirmed downstream effect: PR #1932 (review:pending, mergeable:CONFLICTING since ~2026-09-05T05:07Z) still carries ZERO merge-status:conflicting label as of this writing, and #1853 (headRefName lane/mechanical-dispatcher, the long-lived prototype-branch tracking PR for epic #3383, carries no review labels at all so is correctly OUT of this watch's scope by design, not a gap).

## Done when

1. **Executable** — a new unit test in `we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` proving
   `watchParkedPrConflicts` calls a stub `provider.currentRepo()` and uses ITS return value for
   `ensureLabel`/`setLabels`/`postComment` when `repo` is not supplied — fails before this item's fix (a null
   `repo` reaches the provider unresolved), passes after.
2. `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s `watchParkedPrConflicts` resolves `repo` via
   `provider.currentRepo()`, lazily (only when there is an actual label/comment write to make — never on an
   empty sweep), mirroring `we:scripts/review-set-label.mjs`'s own `repoOptional` resolution pattern.
3. Re-running `node we:scripts/conveyor/parked-pr-conflict-watch.mjs sweep` from the primary checkout against a
   real conflicting PR (e.g. PR #1932, still `mergeable:CONFLICTING`/`review:pending` at filing time) actually
   applies the `merge-status:conflicting` label and posts the one-time comment, with no `gh … got "null"` error.
4. No regression in the existing `we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` suite.
