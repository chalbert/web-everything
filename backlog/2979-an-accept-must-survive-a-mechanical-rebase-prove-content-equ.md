---
bornAs: x169fqe
kind: story
size: 3
status: active
dateOpened: "2026-08-08"
dateStarted: "2026-08-08"
relatedTo: ["2409", "2737", "2416"]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/merge-ai-prs.mjs
tags: [review, drain, trust-chain, escalation, accept-staleness]
---

# An accept must survive a mechanical rebase — prove content equivalence, not SHA identity

The drain rebases an already-accepted PR onto main (dropping the transient we:.lane-manifest.json) seconds after the accept, which advances the head; acceptanceCoversHead keys on head-SHA IDENTITY, so the accept goes stale and the PR is re-parked to review:pending. Since main advances continuously, an accept essentially never survives long enough to be consumed and the queue sits in a re-review treadmill. Stamp a fingerprint of the REVIEWED DIFF alongside the reviewed SHA and let an accept cover a new head only when the reviewed content is provably identical — honouring the intent of #2409 (never honour an accept against a tree the reviewer never saw) instead of loosening it.

## The treadmill, measured live (2026-08-08)

Three accepts were applied by hand and all three were reverted by the drain within ~3 minutes, 3 for 3:

| PR | accepted at | drain rebased at | re-parked at |
|---|---|---|---|
| #1080 | 00:07:41Z | 00:10:01Z | 00:10:23Z |
| #1081 | 00:07:46Z | — | 00:10:18Z |
| #1075 | 00:07:49Z | — | 00:10:31Z |

The sequence on #1080, from its own timeline: we:scripts/review-set-label.mjs stamped `reviewed-sha: d2481e66`;
18 seconds later we:scripts/merge-ai-prs.mjs ran its rebase-drop pass ("drain: rebase … onto origin/main, drop
transient we:.lane-manifest.json"), moving the head to `c45ecfbb`; the review gate then ran **in the same pass**,
compared the two SHAs, and correctly declared the accept stale.

Nothing here is malfunctioning in isolation. `isRebaseDropCandidate` (we:scripts/merge-ai-prs.mjs) does not consult
review labels at all, so it happily rebuilds an accepted PR; `acceptanceCoversHead`
(we:scripts/lib/review-escalation.mjs) keys on head-SHA identity, so it correctly reports the rebuilt head as
uncovered. The two are individually right and jointly fatal: because `main` advances continuously, essentially
every accepted-but-behind PR is rebased before its accept can be consumed.

## Why a fingerprint and not a re-stamp

The obvious cheap fix — re-stamp `reviewed-sha` for the new commit whenever the drain itself did the rebase — was
rejected. It asks the gate to *trust* that the rebase preserved content, on the say-so of the code that performed
it, which is exactly the kind of unverified assertion this trust chain exists to refuse. It also reverses #2409's
ratified posture rather than satisfying it.

The fingerprint *proves* the property instead. #2409's rule is "never honour an accept against a tree the reviewer
never saw", enforced via a head-SHA **proxy**. Comparing the normalized reviewed diff enforces the rule itself: if
the fingerprints match, the reviewer did see this content, whatever commit now carries it — and a commit that rides
in after the accept still changes the diff and is still refused, so the PR #368 hole stays shut.

## What the fingerprint normalizes away, and what it must not

**Every exclusion is a potential collision**, so the list is as short as the problem allows. Exactly two things
are dropped: git's `index <old>..<new>` blob headers (they restate hashes of content already present in the diff
body — this is the one that makes a rebase recognisable at all), and the **repo-root** we:.lane-manifest.json
section, matched on git's exact header string. Everything else is kept — hunk headers, file modes, renames, CRLF,
and all whitespace — because a changed line number means the surrounding file moved and the reviewer's reading of
it may no longer hold.

### Three collisions found in review, all pinned by tests

The first cut of this was wrong twice, and the independent review of PR #1086 reproduced both with real inputs:

1. **Nested manifest lookalike.** The skip tested `line.includes('/' + LANE_MANIFEST)`, which also matched a
   manifest-named file in a SUBDIRECTORY. A ride-in commit adding a file at that suffix had its whole section
   dropped from both sides and hashed identically to a diff that never contained it — the gate returned
   `covers: true` on genuinely unreviewed content. Now only git's exact root header is skipped.
2. **Trailing whitespace stripped from content lines.** A ride-in changing only a meaningful trailing space (a
   markdown hard break, a fixture, a patch file) collided. Whitespace is content; the per-line strip is gone.
3. **The whole-text `trim()`** (found while fixing 2). Trimming the diff before hashing strips trailing
   whitespace off the LAST line, so the same attack still worked at end-of-diff. The hashed text is now never
   trimmed; only trailing wholly-EMPTY lines are dropped, which carry nothing.

The lesson worth keeping: on a fingerprint that gates trust, every normalization must be justified against "what
two materially different inputs does this now make equal?", not against "what noise does this remove?"

Fail-closed on every path: a missing, empty, or unparseable fingerprint on **either** side falls through to the
pre-existing SHA-identity verdict. A read failure can therefore only ever cost a false re-park, never honour an
accept it should not. Every pre-#2979 accept carries no fingerprint and so behaves exactly as before.

## Follow-up (2026-08-08): the fingerprint was fed the WRONG DIFF

The first cut fingerprinted `gh pr diff` on both sides. That is the THREE-DOT diff, which still lists a sibling
lane's file that has already landed on main as if this PR added it — the exact phantom #2450 exists to strip. So
the fingerprint changed **every time any other lane landed**, and an accept went stale for reasons having nothing
to do with its own PR. The mechanism was sound and the input was polluted; #1086 only survived because it landed
within minutes, before siblings moved main.

Both sides now use `computeNetDiffText` — the two-tree `git diff <forkpoint> <head>`, content-only and
ancestry-independent, which the repo already maintains for precisely this reason.

Measured on the live board:

| PR | `gh pr diff` files | net-diff files |
|---|---|---|
| #1080 | 24 | 0 |
| #1075 | — | 10 |
| #1070 | — | 5 |
| #1021 | — | 3 |

#1080's three-dot diff had grown to include four backlog items and three script files belonging to other PRs,
including this very item. The net diff strips all of it.

**A zero-file net diff is not a failure — it is a finding.** #1080 and #1081 both return empty, and both branch
tips are provably ancestors of `origin/main`: their content already landed via sibling lanes, so those PRs are
no-ops that should be closed rather than reviewed. The three-dot diff hid that behind 24 phantom files.

Fail-soft is unchanged: an unscored or empty basis stamps no marker, and the gate falls back to the pre-existing
SHA-identity check — the stricter path — so this can only ever cost a false re-park.

## Acceptance

1. **Executable** — a vitest case where the same reviewed change replayed onto a newer base, with different
   `index` blob headers and the lane manifest dropped, yields an identical fingerprint and `covers: true`.
2. **Executable** — a vitest case where a ride-in commit appended after the accept yields `covers: false`
   (the PR #368 hole stays shut).
3. **Executable** — a vitest truth table over the incomplete pairs (accept-side only, live-side only, empty
   string, both null) asserting `covers: false` in every one — the fail-closed proof.
4. **Executable** — a round-trip: `buildReviewedDiffMarker` → `parseReviewedDiff` → back into
   `acceptanceCoversHead`, proving a STORED fingerprint compares equal to a RAW live diff (the production path).
5. **Observable** — the real 2026-08-08 rebase of `lane/2950-disposition-routing` (`5b8d2a33` → `ff00434a`):
   fingerprints match, and the gate returns `covers: true` where it returned `covers: false` before.
6. **Executable** — `npm run check:standards` green and the existing review-escalation suite stays green.
