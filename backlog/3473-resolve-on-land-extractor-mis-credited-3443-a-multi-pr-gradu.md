---
bornAs: xy43dll
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-03"
tags: []
relatedTo: ["3441"]
---

# resolve-on-land extractor mis-credited #3443 (a multi-PR graduation item) as fully resolved from one partial-increment PR

Confirmed 2026-09-03: PR #1866 (WE #3443: readiness/computeFreeSlots excludes dirty (orphaned) unleased lanes, lane/3443-computefreeslots-excludes-dirty-lanes) merged and the drain's resolve-on-land (commit 3fbe79cf0, drain: resolve #3443 on land (#2748)) immediately flipped #3443 status:open->resolved, even though #1866's own body says 'this PR does not resolve #3443, it lands one increment of it' and #3443's own Done-when #1 (zero commits left ahead of origin/lane/mechanical-dispatcher, or an explicit dropped/superseded note) was never satisfied -- its own Progress section (same date) lists ~26 commits still ahead as future work. Root-caused to we:scripts/lib/open-pr-items.mjs's deliveredItemNumsFromPr: the leadTitleMatch regex credits ANY PR titled ^(WE )?#NNN: <subject> as fully delivering NNN -- a repo-wide title convention every WE PR uses regardless of whether NNN is a single-PR leaf story or a multi-PR graduation/epic-shaped tracking item. A NEW gap, not the one #3441 hardened: #3441's 8 rounds fixed citation-vs-delivery anchoring, batch/verb-led ref ambiguity, date-span false reads, and isAnnotationPr scope-authoring exclusion -- none of those rounds considered a multi-increment item whose own constituent PRs explicitly disclaim full resolution. Filed per the operator's own instruction tonight: file real extractor bugs under this epic without fixing them immediately.

## Evidence trail (so a future session doesn't have to re-derive this)

- `git log --oneline -- backlog/3443-*.md` shows `3fbe79cf0` ("drain: resolve #3443 on land (#2748)") landing
  the very next commit after `f5b99abad` ("WE #3443: readiness/computeFreeSlots excludes dirty (orphaned)
  unleased lanes"), same author/date (`Thu Sep 3 09:09:56 2026 -0400` vs. `08:48:52`) — that second commit
  is PR #1866's merge commit on `main`.
- `node -e` against `we:scripts/lib/open-pr-items.mjs`'s `deliveredItemNumsFromPr` directly, reproducing the
  exact PR #1866 ref/title (`lane/3443-computefreeslots-excludes-dirty-lanes`,
  `"WE #3443: readiness/computeFreeSlots excludes dirty (orphaned) unleased lanes"`), returns `['3443']` —
  the `leadTitleMatch` regex (`/^\s*(?:WE\s+)?#?(\d{2,5})\s*:/`) matches the title's leading `"WE #3443:"`
  and credits full delivery. `isAnnotationPr` does not exclude it (it is a real code PR, not scope-authoring),
  and none of the other four guards (batch/verb-led ambiguity, date-span exclusion, lead-verb collision, bare
  `#NNN` citation) apply either — this ref/title combination sails straight through every existing check.
- PR #1866's own body states explicitly: *"Graduates `origin/lane/mechanical-dispatcher`'s `c7316eb40` onto
  `main`, as one small piece of the ongoing graduation tracked by #3443 — this PR does not resolve #3443, it
  lands one increment of it."* The PR author correctly understood #3443's multi-PR nature; the mechanical
  extractor did not.
- **A second, independent instance was hit live filing THIS very item.** The PR that reopened #3443
  (`status: resolved` → `active`) and filed this task — ref `lane/3443-reopen-and-3441-gap-followup`, title
  `"backlog/3443: reopen (false auto-resolve) + file the extractor gap it exposed"` — merged (`97dd1693e`),
  and the drain's resolve-on-land fired AGAIN one commit later (`63551c9ad`, same `"drain: resolve #3443 on
  land (#2748)"` message), flipping #3443 straight back to `resolved` before this item's own filing had even
  landed. This time the credit came from a DIFFERENT vector than #1866's: not `leadTitleMatch` (the title
  starts with `"backlog/3443:"`, which the anchor regex does not match) but the REF's lead segment —
  `deliveredItemNumsFromPr('lane/3443-reopen-and-3441-gap-followup', <that title>)` returns `['3443']` because
  segment 0 after `lane/` is `3443`, the repo's own standard single-item ref convention
  (`lane/<NNN>-<slug>`) that `#3441`'s own rounds 6/7 deliberately preserved as a valid delivery signal. Fixed
  by re-editing #3443 back to `active` a second time and landing that fix through a THIRD PR whose ref/title
  were deliberately crafted to carry no digit sequence at all (verified against `deliveredItemNumsFromPr`
  before pushing) — the only way, short of a real fix, to land a change under #3443 without re-triggering
  this bug. **This means essentially any PR authored the normal way under a multi-PR/graduation-tracked item —
  via either of this repo's two standard conventions, a `"WE #NNN: <subject>"` title OR a `lane/<NNN>-<slug>`
  ref — will trip this, not just PR #1866's specific shape.** The gap is systemic to any item like #3443, not
  a narrow one-off.
- `backlog/3443-*.md`'s own "Done when" #1 requires either `git rev-list --left-right --count
  origin/main...origin/lane/mechanical-dispatcher` reporting `0` on the lane-ahead side, or an explicit note
  naming deliberately-dropped/superseded commits. Neither is true: its own Progress section (dated
  2026-09-03, the same day it was auto-resolved) states "Still ahead on
  `origin/main...origin/lane/mechanical-dispatcher`: ~26 commits" and lists several as candidates for a
  *future* increment — describing ongoing work, not something resolved. (This item itself was reopened,
  `status: resolved` → `active`, `dateResolved` stripped, as a companion fix landed alongside this filing.)

## Relationship to `#3441` — a new gap, not the one it already hardened

`#3441` (parent `#3383`, `deliveredItemNumsFromPr`'s own origin) ran 8 adversarial rounds against exactly this
function, but every round fixed a different failure shape: round 1 anchored `leadTitleMatch` to the subject
position and distinguished a delivery marker from a bare `#NNN` citation; rounds 2/5 excluded annotation
(scope-authoring) PRs and handled retry-letter refs; rounds 3/4 added batch-ref trailing-segment credit and
`YYYY-MM-DD` date-span exclusion; rounds 6/7 detected lead-vs-verb-led id collisions. None of those eight
rounds ever considered an item that is itself explicitly multi-PR by design (`#3443`'s own "Covers the whole
ongoing effort, not one PR" and Done-when #3, "never a bulk merge... each landed increment is its own small
PR") receiving a real, non-annotation, non-ambiguous, correctly-anchored `"WE #NNN: <subject>"` title from
ONE of its many constituent PRs. The `leadTitleMatch` anchor rule round 1 introduced was calibrated against
single-PR leaf stories, where "a WE PR titled `#NNN: <subject>`" and "the PR that delivers `NNN`" are the
same fact; #3443 breaks that assumption by being a graduation-tracking story where they are not. This is a
genuinely different gap in the same function, not a case the #3441 fix already covers.

## Done when

1. **Executable** — two unit tests in `we:scripts/lib/__tests__/open-pr-items.test.mjs` reproducing (a) PR
   #1866's exact ref/title (`lane/3443-computefreeslots-excludes-dirty-lanes`,
   `"WE #3443: readiness/computeFreeSlots excludes dirty (orphaned) unleased lanes"`, the title-anchor vector)
   and (b) the reopen PR's ref/title (`lane/3443-reopen-and-3441-gap-followup`,
   `"backlog/3443: reopen (false auto-resolve) + file the extractor gap it exposed"`, the ref-lead-segment
   vector) against `deliveredItemNumsFromPr`, both asserting `[]` (or some other non-full-delivery signal),
   not `['3443']` — both currently fail (return `['3443']`), both must pass once fixed.
2. A stated mechanism for `deliveredItemNumsFromPr` (or its caller in
   `we:scripts/merge-ai-prs.mjs`/`landedIdsForCandidate`) to recognize a multi-PR/graduation-tracked target
   item — e.g. reading the target item's own frontmatter/body for a marker equivalent to "this item resolves
   only via an executable multi-PR Done-when," or requiring the PR body itself to not contain an explicit
   disclaimer like "does not resolve #NNN" — and skip the auto-resolve for it, leaving it to the item's own
   real Done-when check (or a human) instead.
3. No regression against `#3441`'s existing 39+ unit tests and its own documented 31+ real/constructed
   ref/title shapes.
