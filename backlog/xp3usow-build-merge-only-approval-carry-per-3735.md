---
kind: story
size: 8
parent: "3054"
status: open
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-21"
blockedBy: ["xm88lki"]
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
  separately as [xm88lki](/backlog/xm88lki-bind-restamp-to-the-proven-head-expect-head/) (a bug under any
  ruling); this story depends on it. The standards check that every restamp or carry call site passes an
  expected head is [xw8cc2j](/backlog/xw8cc2j-standards-check-restamp-call-site-passes-expected-head/).
- **Fork 4's gate path waits on #3179.** Until the #3179 ledger exists, a carried human clearance does not
  suppress the anti-test-tampering re-park, and no gate parses `carried-human-from`.

## DESIGN TO SETTLE

1. **Where the probe lives and what it costs.** The probe (resolve `reviewed-sha`, walk to it, one hermetic
   `git merge-tree --write-tree` per merge, one `git diff --name-only` per merge) sits beside
   `computeNetDiffText` in we:scripts/merge-ai-prs.mjs. Decide the walk's cap (how many merges before it gives
   up as `unproven`) and whether it runs only when the SHA route already said "stale".
2. **The reviewed file set.** Which net-diff read supplies `reviewedPaths` (the PR's own files at the reviewed
   SHA), and how it behaves when that read fails (rule 7: no carry).
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
   - The head moves between probe and stamp (the replay proves H1; H2 is pushed before the restamp child runs):
     `--to=restamp --expect-head=H1` refuses, nothing is stamped, and the next pass judges H2 from scratch. A
     restamp with no `--expect-head` also refuses.
   - The carry comment records both the source `reviewed-sha` and the destination head.
   - Hermetic replay: a PR adding `.gitattributes` with `merge=union` on a file, plus a same-file main edit
     merged by the author with the union driver: re-parks — once with the file test on, and once with it
     bypassed, proving the replay (`attr.tree` = empty tree) conflicts on its own.
   - Hermetic replay: an author merge made with rerere enabled or `-X ours`/`-X theirs`, where that changed
     the result: re-parks, even when the drain's clone has rerere enabled.
   - A carried human clearance with a test-tampering hit: re-parks `review:human` while #3179 is unbuilt. No
     carry comment contains `cleared-human`. A comment with `carried-human-from` alone never suppresses the
     anti-test-tampering re-park.
   - A read failure: no carry, no revocation, retried next pass.
   - Missing acceptance, a review hold, or `review:changes`: the carry refuses.
2. **Executable** — `npm run check:standards` reports 0 errors.
