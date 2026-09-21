---
bornAs: xp3usow
kind: story
size: 8
parent: "3054"
status: open
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-21"
blockedBy: ["3828"]
relatedTo: ["3735", "3179", "2409", "3021", "3024"]
tags: [review, drain, review-escalation, acceptance, merge-commit, design-first]
---

# Build the merge-only approval carry per #3735

#3735 is ratified (we:docs/agent/platform-decisions.md#merge-only-push-approval-carry): an approval carries across a push only when the drain replays each merge of main hermetically and gets the pushed tree, with no conflict, no non-merge commit and no main-side change to the PR's files. Build the pure mergeOnlyCarry decision, its git probe, the decideReviewGate route, the rebaseDropContent re-park and the carry record. Design-first.

**Design-first and deliberately not cleared for the conveyor.** Settle the design section below on this card
first; only then clear it (the `add` command of we:scripts/conveyor/queue.mjs).

## FOUND (2026-09-21)

- **The ruling.** we:docs/agent/platform-decisions.md#merge-only-push-approval-carry, rules 1–9. The card
  [#3735](/backlog/3735-may-a-review-human-approval-carry-across-a-push-that-only-me/) holds the code shape
  of the pure `mergeOnlyCarry` (including the chain-linkage check) and the full Definition of done copied below.
- **One staleness gate.** `acceptanceCoversHead` (we:scripts/lib/review-escalation.mjs:1590) has one caller,
  `decideReviewGate` (`:2258`), which the drain calls. It knows nothing about merges or trees; no code in
  we:scripts/ compares trees for review coverage today.
- **The drain's re-stamp.** `needsAcceptanceRestamp` (we:scripts/merge-ai-prs.mjs:752) is only
  `rebase?.action === 'rebased' && !!v.humanCleared && !v.reviewHeld`; it does not check that the merged lane tip
  was covered by the acceptance. `rebaseDropContent` merges are re-stamped the same way; the ruling (rule 5)
  makes them re-park.
- **The head binding is its own card.** `--expect-head` on `--to=restamp` and in `restampAcceptance` is filed
  separately as [3828](/backlog/3828-bind-restamp-to-the-proven-head-expect-head/) (a bug under any
  ruling); this story depends on it. The standards check that every restamp or carry call site passes an
  expected head is [3830](/backlog/3830-standards-check-restamp-call-site-passes-expected-head/).
- **Fork 4's gate path waits on #3179.** Until the #3179 ledger exists, a carried human clearance does not
  suppress the anti-test-tampering re-park, and no gate parses `carried-human-from`.

## DESIGN TO SETTLE

1. **Where the probe lives and what it costs.** The probe (resolve `reviewed-sha`, walk to it, one hermetic
   `git merge-tree --write-tree` per merge, one `git diff --name-only --no-renames` per merge) sits beside
   `computeNetDiffText` in we:scripts/merge-ai-prs.mjs. Decide the walk's cap (how many merges before it gives
   up as `unproven`) and whether it runs only when the SHA route already said "stale". #3735 ratified no
   value for the cap, so it is a named exported constant (for example `MERGE_ONLY_WALK_CAP`) that the tests
   read; its value is set here, at build time.
2. **The reviewed file set.** Which net-diff read supplies `reviewedPaths` (the PR's own files at the reviewed
   SHA), and how it behaves when that read fails (rule 7: no carry). **Settled for empty sets:** an empty
   file set is never read as "shares nothing". A set read that fails, or returns empty while the two trees it
   compares differ, is a failed read (rule 7: no carry). **Settled for renames:** both file sets
   (`reviewedPaths` and main's side per merge) are read with `--no-renames`, so a rename contributes both its
   old and its new path (rule 4). The replay itself pins `-c merge.renames=true` (git's default) with the other
   hermetic pins of rule 3; rename-following in the replay cannot hide an overlap, because the overlap test
   never rename-collapses.
3. **The carry comment.** Its heading, and the exact markers: source `reviewed-sha`, destination head,
   `carried-human-from` for a human clearance, never `cleared-human`.
4. **The re-park comment add-on** showing the conflicted files and the changed `+/-` lines on a conflicted
   merge: here, or left to #3024.
5. **Order against #3179.** Whether this story ships the #3179 ledger write for a carried human clearance, or
   only the fail-closed behaviour and leaves the ledger write to #3179.

## Done when

1. **Executable** — a vitest run of the test file `we:scripts/__tests__/review-human-carry-over.test.mjs`
   fails before this item lands (the file does not exist yet) and passes after. It holds these cases, from #3735's Definition of done:
   - Replay #2365 (`0ed03ddce` → `b889a718a`): carries, with a durable carry comment.
   - Replay #2347 (`ed4103e9e` → `efa134d33`): does not carry; re-parks with the resolution delta shown.
   - A clean merge where main changed a PR file: re-parks.
   - A merge with main as the first parent and the PR as the second: judged by ancestry, same outcome.
   - An author commit followed by a merge of main: re-parks.
   - A drain re-stamp whose merged lane tip is not covered by the acceptance: re-parks, never re-stamps.
   - A drain `rebaseDropContent` merge on an accepted PR: re-parks.
   - A merge commit with a hand edit (tree ≠ git's merge): re-parks.
   - A disconnected chain (each entry a clean merge of main, the last entry's PR parent equal to
     `reviewed-sha`, but some `chain[i].prParent !== chain[i+1].sha`): `mergeOnlyCarry` returns no carry.
   - Merge of a non-main branch: no carry. The merge's other parent is an unreviewed side branch (another PR's
     tip, or a scratch branch) that is not an ancestor of `origin/main` and only adds new files sharing no path
     with the reviewed PR, so the merge is clean, tree-equal and has no file overlap: the carry is refused
     (rule 1, "the other is an ancestor of `origin/main`").
   - An octopus merge (three or more parents) of main and the PR: no carry (rule 1, "exactly two parents").
   - A live head whose walk never reaches `reviewed-sha` (the reviewed commit is not an ancestor of the head,
     e.g. history rewritten, every commit on the walked path a clean merge of main): no carry (rule 1, "the
     path must end at `reviewed-sha`").
   - A merge that `git merge-tree` reports as conflicted (non-zero exit), even when the author committed git's
     conflicted result verbatim so the trees are equal: no carry (rule 1, "must exit 0").
   - Rename overlap: the PR modified a file A; main renamed A to a new path B; the author's merge is clean and
     tree-equal. Main's side, read with `--no-renames`, lists A, so the PR re-parks (rule 4). Fails if either
     file set is read with rename detection.
   - The head moves between probe and stamp (the replay proves H1; H2 is pushed before the restamp child runs):
     `--to=restamp --expect-head=H1` refuses, nothing is stamped, and the next pass judges H2 from scratch. A
     restamp with no `--expect-head` also refuses.
   - The carry comment records both the source `reviewed-sha` and the destination head.
   - The carry comment is written by `--to=restamp` with `--actor=drain`, under its own heading, never under the
     PR author's or the pusher's actor (rule 9).
   - The carry comment names the original clearer: the actor of the acceptance it carries from (rule 9).
   - The pusher is the PR author: the author merges main and pushes; the carry comment's actor is `drain`, and
     no comment written for the carry names the author as the one who certified it (rule 9, "the pusher never
     certifies its own push").
   - The carry's restamp call gets `--expect-head=<the head the walk started from>`, the head the proof
     reached (rule 8).
   - The carry is decided inside `decideReviewGate`: a test through `decideReviewGate` (not `mergeOnlyCarry`
     alone) on the #2365 replay returns the carry route (rule 9).
   - A single-parent commit whose message reads "Merge branch 'main'" and whose tree equals a clean merge of
     main: no carry (rule 1, "a commit message, a commit's shape or its pusher proves nothing").
   - Two successive clean merges of main with no file overlap: carries (rule 1, the walk crosses a chain).
     Same chain, but only the second merge's main side touches a PR file: re-parks (rule 4, checked per merge).
   - A clean merge of main followed by an author commit on top (the non-merge commit is the live head): re-parks
     (rule 2, "anywhere on the path").
   - A `rebaseDropManifest` merge whose merged lane tip is covered by the acceptance: still re-stamps (rule 5,
     the positive side of "only when").
   - The same merge-only push on a PR cleared by `--to=clear-human` and on one accepted by `--to=accepted`:
     both carry (rule 6, "follow the same rule").
   - A `reviewed-sha` that cannot be resolved in the drain's clone (unknown object, or a prefix matching
     more than one object): no carry, and the gate's
     decision equals its decision with the carry route removed (rule 7).
   - Hermetic replay: the replay's git argv carries `-c rerere.enabled=false`, `-c merge.renames=true`,
     `-c attr.tree=<empty tree>` and `-c core.attributesFile=/dev/null`, and no `-X` or `-s` option; its env
     sets `GIT_ATTR_NOSYSTEM=1`, `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null` and has no
     `GIT_CONFIG_COUNT` or `GIT_CONFIG_PARAMETERS`, even when the drain's own env sets them; its `--git-dir` is
     not the drain clone's (rule 3).
   - Hermetic replay, one planted-driver case per route, each on a same-line conflict that the planted driver
     (a custom `merge.<name>.driver = cp %B %A`, and separately the built-in `union`) would merge cleanly: the
     replay still conflicts and the PR re-parks (rule 3, "no configured merge drivers"). Routes: the drain
     clone's `$GIT_DIR/info/attributes` with the driver in its local config; `core.attributesFile` set in the
     clone's local config; `$XDG_CONFIG_HOME/git/attributes` (the default `core.attributesFile`); a global
     config (`$HOME/.gitconfig`) setting `core.attributesFile` and the driver; a system config (via
     `GIT_CONFIG_SYSTEM`) doing the same; the drain's env (`GIT_CONFIG_COUNT`/`GIT_CONFIG_PARAMETERS`) doing the
     same. Each case fails against a replay that carries only the three original pins.
   - Hermetic replay: the drain's clone sets `merge.renames=false`; the replay's result equals the result with
     git's default (rule 3, rename detection pinned).
   - Hermetic replay: a PR adding `.gitattributes` with `merge=union` on a file, plus a same-file main edit
     merged by the author with the union driver: re-parks — once with the file test on, and once with it
     bypassed, proving the replay (`attr.tree` = empty tree) conflicts on its own.
   - Hermetic replay: an author merge made with rerere enabled or `-X ours`/`-X theirs`, where that changed
     the result: re-parks, even when the drain's clone has rerere enabled.
   - A carried human clearance with a test-tampering hit: re-parks `review:human` while #3179 is unbuilt. No
     carry comment contains `cleared-human`. A comment with `carried-human-from` alone never suppresses the
     anti-test-tampering re-park.
   - A read failure: no carry, no revocation, retried next pass.
   - Failed or empty file-set reads, each on the otherwise carrying #2365 replay, each asserting no carry
     (rules 4 and 7; an empty set "shares nothing" and would carry): the `reviewedPaths` read throws; it
     returns `[]` while the reviewed PR's diff is non-empty; main's per-merge
     `git diff --name-only --no-renames` read throws; it returns `[]` while that merge's main side changed files.
   - Failed or empty tree reads: the replay's printed tree and the merge commit's own tree both read as empty
     (or either read throws) on a merge whose real trees differ: no carry (rule 1, trees "equal").
   - An ancestry read (`git merge-base --is-ancestor`) that errors, rather than answering yes or no, while the
     walk classifies a parent: no carry (rule 1, "found by ancestry"; rule 7).
   - Walk cap, read from the exported constant: a chain of exactly cap clean, non-overlapping merges of main
     carries; a chain of cap+1 is `unproven`, no carry, and runs at most cap `merge-tree` calls.
   - The lane-tip coverage read behind a `rebaseDropManifest` re-stamp throws, or returns empty digests on both
     sides: re-parks, never re-stamps (rule 5, "only when"; rule 7).
   - Missing acceptance, a review hold, or `review:changes`: the carry refuses. One case per condition: no
     `review:accepted`; `review:human` present; `review:changes` present (rule 9, "a carry never creates an
     acceptance").
2. **Executable** — `npm run check:standards` reports 0 errors.
