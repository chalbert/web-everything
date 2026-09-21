---
bornAs: xdqy6xk
kind: decision
parent: "3383"
status: open
relatedTo: ["3772", "3443", "3804", "3802"]
scope: ["we:skills-src/conveyor/runner.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/session-reaper.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Decision: accept each of the five catch-up merge forks before the prototype branch is fast-forwarded

Rule whether to accept, in five places, the behaviour the merge of `main` into the prototype branch `lane/mechanical-dispatcher` kept. The merge (54 conflicted files, no rebase, no force) is staged on `origin/lane/mechanical-dispatcher-catchup`, sha dd9d51bfb, and was NOT pushed to the shared branch. The merge kept the BRANCH's behaviour (fork 4 took `main`'s) and named `main`'s half. **After this ruling the operator fast-forwards the shared branch to the staging ref.** One card, not five: the forks share one ref and one fast-forward. Relates #3772, #3443 and the reaper graduation card.

*Not prepared:* no skeptic pass has run on the forks below and there is no `preparedDate`. Each default is mine. The two sides are copied from the catch-up worker's result file (section UNRESOLVED-BY-JUDGMENT); the code was re-read on the staging ref.

## FOUND (re-verified 2026-09-21)

- **The staging ref can no longer be fast-forwarded.** `git merge-base --is-ancestor origin/lane/mechanical-dispatcher origin/lane/mechanical-dispatcher-catchup` fails now: the shared branch gained 12 commits after the ref was cut (12 only on the branch, 427 only on the ref). The first step of the operator's fast-forward is therefore to merge the new branch tip into the staging ref (the result file's step 2b: `git merge origin/lane/mechanical-dispatcher-catchup` on the branch, never a force), then check and push. Never `--force`, never a push of the staging ref to `main`.
- **Checks on the staging ref (the worker's numbers, not re-run here):** `npm run check:standards` 0 errors; scripts and conveyor and skills-src suites green with 15 skipped (3 of them fork 1's). Not run: branch-coverage (`check:standards` needs a clean tree for it) and nothing ran live.
- **Nothing is renumbered.** No card was renamed; the one id fix is a prose reference in #3331 (main says #3605, the tree now says #3606).

## Fork 1 — `we:skills-src/conveyor/runner.mjs#makeCliMechanicalPasses`

Branch: heartbeated passes (each renews the 15-minute singleton lease mid-tick), `main-ref-sync` and `poc-branch-sync` first, and a blocking mechanical review dispatch. Main: a repo-scoped fan-out over the constellation repos, a per-repo PR snapshot (`--prs-file=`), the advisory-label sweep and the operator-notify pass as mechanical passes, and the `unsupported-repo` ledger write. The merge kept the branch's function whole (main-only fragments spliced into it were a syntax error) and `describe.skip`ped the three `we:skills-src/conveyor/__tests__/runner-repos.test.mjs` cases with a header saying how to re-enable them.

- **(a) [default] Accept the branch's pass list for now, and treat main's fan-out as OWED work before the runner graduates.** The owed work is to port main's per-repo fan-out INTO the branch's heartbeated list (one pass set, scoped per repo, still heartbeated), then delete the `.skip`. The prototype's runner is what runs live and the heartbeat is what keeps it alive across a long tick.
- **(b) Take main's function.** Rejected: it loses the heartbeat (the 15-minute lease can lapse mid-tick), the two sync passes and the blocking review dispatch, which the running conveyor depends on.
- **(c) Keep both pass sets side by side.** Rejected: two lists of mechanical passes for one runner is the drift this card's merge exists to remove.

## Fork 2 — `we:scripts/conveyor/reconcile-fix-dispatch.mjs`: a pull request with no item number

Same evidence (PR #2210, head ref `lane/file-2206-review-findings`), opposite conclusions. Branch: "a missing item number is not a refusal": scope is the PR's own changed files and the repair is attributed honestly as `PR #<n>`. Main: refuses with `no-item-num` because without an item number there is no honest `WE #<n>:` commit prefix. The merge kept the branch's; two of main's cases that encode the refusal were dropped and its three safe-scope-sanitiser cases were ported and pass.

- **(a) [default] Accept the branch: dispatch it as `PR #<n>`.** The repair can run and the attribution is truthful about what it is; main's evidence cites the same PR as proof the refusal is a bug to route around, not a guard. Cost: on graduation `main` must drop its `no-item-num` refusal and two of its tests.
- **(b) Take main: refuse.** Rejected: leaves the reviewed pull request undispatchable, so a human must fix it by hand every time the head ref carries a number that is a PR, not an item.
- **(c) Refuse only when no scope can be derived.** Viable and narrower, but it is a third behaviour neither side built; leave it to a follow-up if the operator wants it.

## Fork 3 — `we:scripts/conveyor/session-reaper.mjs`: repo guessing and lookup caching

Main's reaper guessed `repo: 'we'` for an untagged PR session name and cached one ground-truth answer across repos. The branch leaves an untagged name repo-less ("the resolver must not guess `we`") and resolves each row through the verdict axis. The merge kept the branch's split reaper (26 exported names against main's 13). Main's three test cases asserted the guessing shape and were rewritten to assert the repo axis they exist for (tag parsing, an explicit `--repo` on every lookup, a global call cap); the reap and keep outcomes they also asserted are NOT covered any more.

- **(a) [default] Accept the branch's no-guess resolution, and owe back the lost reap/keep coverage as new tests.** A guessed `we` is wrong for legacy sessions (the live `review-148` was plateau-app#148); the cross-repo check is what the reaper graduation card's Fork 3 keeps.
- **(b) Take main's guess and cache.** Rejected: wrong for legacy untagged names and caches one answer across repos.
- **(c) Accept the branch and drop the lost coverage.** Rejected: the outcomes those cases pinned (which sessions are reaped and which kept) are the reaper's whole job.

## Fork 4 — `--session-id` in the spawn argv (the one place `main` won)

Both sides fixed #3331 (the CLI ignores `--session-id` on `--bg` and mints its own id). The branch kept sending the flag ("harmless, forward-compatible"); main dropped it. The merge took main's argv shape: the CLI provably discards the flag, more than seven cases on main pin the argv shape, and the branch's own docblock calls the flag non-load-bearing. Four branch comments and two branch test hunks were adapted, each with a dated note at the site. The other half of that fork went the branch's way: on an unparseable banner the branch THROWS (`no parseable session handle`) where main fell back to the minted id.

- **(a) [default] Accept main's argv (no flag) and the branch's throw on an unparseable banner.** No behaviour change for the live CLI, and a spawn with no parseable handle is a loud failure instead of a made-up id.
- **(b) Restore the branch's flag.** Rejected: dead weight the CLI discards, and it breaks more than seven of main's pinned tests for a hypothetical future CLI.
- **(c) Take main's fallback to the minted id on an unparseable banner.** Rejected: it records a session id that may not exist, which is how #3331 started.

## Fork 5 — `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs`: cross-repo independence of the action record

The branch's case asserted that a review on `we#77` does not block a fix on another repo's PR #77. Main has since made `dispatchFix` refuse any repo but WE outright (`unsupported-repo`), at the top of the function and before the record is read. The case now asserts that refusal; the action record's own repo-independence is no longer exercisable from there and is not covered.

- **(a) [default] Accept the changed test.** It asserts what is now true; cross-repo fix dispatch is refused by design until it has its own brief and gate. Add the record-level independence test back at the same time as cross-repo fix dispatch is enabled.
- **(b) Add a record-level test now** (against the action-record store's repo key directly). Cheap and keeps the coverage, but it tests a path nothing can reach today.
- **(c) Revert main's refusal on the branch.** Rejected: it undoes a deliberate safety refusal main added.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*decision-accept-each-of-the-five-catch-up-merge-forks*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the chosen option for each of the five forks).
2. After the fast-forward, `git rev-list --left-right --count origin/main...origin/lane/mechanical-dispatcher` shows zero commits only on main and no commit on the branch was rewritten (the old branch tip is an ancestor of the new one).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
