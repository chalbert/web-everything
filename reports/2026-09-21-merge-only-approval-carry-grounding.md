# Carrying a review approval across a merge of main — grounding for #3735

Date: 2026-09-21. Session: prepare-3735. Main read at `9002a5f1e`.

## 1. How an approval is recorded and checked today

- An acceptance is a PR comment with HTML-comment markers, written by `we:scripts/review-set-label.mjs`
  (`buildVerdictComment`, `:1119-1241`; markers at `:1140-1147`): `reviewed-sha`, `reviewed-diff`,
  `reviewed-contribution`, `cleared-human` (only for `--to=clear-human`) and `cleared-by-actor`.
- The two digests come from the live net diff (`computeNetDiffText`, `we:scripts/merge-ai-prs.mjs:2701-2729`,
  basis `merge-base(origin/main, head)` → head, #2450). If that read fails, nothing is stamped
  (`we:scripts/review-set-label.mjs:835-868`, "FAIL-SOFT, DELIBERATELY").
- The `review-pr` operation does not write the comment itself. `we:scripts/operations/record-verdict-io.mjs`
  stages a request; CI's apply step shells `we:scripts/review-set-label.mjs`, which binds to whatever head is
  live at apply time.
- `acceptanceCoversHead` (`we:scripts/lib/review-escalation.mjs:1590-1663`) is the only coverage test. Order:
  missing SHA → covers (fail open); SHA prefix match; equal `reviewed-diff`; equal `reviewed-contribution`;
  read failure → not covered, not proven stale; else stale. Its only caller is `decideReviewGate`
  (`:2275`), called by the drain at `we:scripts/merge-ai-prs.mjs:4197`.
- `normalizeContributionFingerprint` (`:1292-1360`) keeps `+`/`-` lines, hunk lengths and context-run lengths;
  it drops context text, offsets, gaps and headings. Its known false-honour residual (#3021) is pinned in its
  test suite.
- No code compares trees, patch ids or range-diffs for coverage. `git merge-tree --write-tree` is used only
  for rebuilds and probes (`we:scripts/lib/rebase-drop-manifest.mjs`, `we:scripts/prune-landed-lanes.mjs:126`).

## 2. How the drain treats a new head

- Its "rebase" is a merge: `commit-tree <tree> -p <base> -p <mergeRef>`, pushed fast-forward
  (`we:scripts/lib/rebase-drop-manifest.mjs:186-195`). `rebaseDropContent` is the fallback for
  non-overlapping content conflicts.
- After its own rebase it re-stamps when `needsAcceptanceRestamp` holds (`we:scripts/merge-ai-prs.mjs:752-754`):
  `rebase?.action === 'rebased' && !!v.humanCleared && !v.reviewHeld`. Nothing compares the old markers.
  `decideSetLabel('restamp')` (`we:scripts/review-set-label.mjs:272-302`) checks labels only. The docstring at
  `we:scripts/merge-ai-prs.mjs:2196-2199` claims a contribution check that the code does not perform.
- A stale acceptance parks the PR (`review:human` when the tier or label requires it, otherwise
  `review:pending`), strips `ready-to-merge`, and never removes `review:accepted` (`:4291-4314`). Revoking an
  operator clearance posts a notice (`:4260-4273`); on a read failure that revocation is suppressed (#3184).
- `gh pr update-branch` is never called. `isMechanicalMergeCommit` (`:331-335`) recognises a merge commit by
  message only.

## 3. The two incidents, replayed

**PR #2365** (merged 2026-09-21T12:25:54Z). Timeline from `gh api …/issues/2365/timeline`:

| Time (UTC) | Event |
| --- | --- |
| 11:07:50 | Accepted via the `review-pr` operation. Markers: `reviewed-sha 0ed03ddce4`, `cleared-by-actor` only. |
| 11:07:56 | `ready-to-merge` added. |
| (push) | `b889a718a` "Merge branch 'main' into lane/3495-…", parents `0ed03ddce` + `a79476ce8`. |
| 12:23:15 | Drain removes `ready-to-merge`, adds `review:pending`: "review:accepted is STALE — head advanced to b889a718a626 past the reviewed commit 0ed03ddce4f0". |
| 12:24:27 | Second clearance, "Recorded by loop-console operator", "Independence NOT established". Now stamps all three markers. |
| 12:25:54 | Merged. |

Replay:

```
git merge-tree --write-tree 0ed03ddce a79476ce8   → 0490ef4ae570caaa8831551d3ad40026b492c4fe (exit 0)
git rev-parse b889a718a^{tree}                    → 0490ef4ae570caaa8831551d3ad40026b492c4fe
patch-id of PR diff before and after              → 2e05b9a0… both sides
files changed by the PR ∩ files changed by main   → none
```

The brief said #2365 "kept `review:accepted` and its `ready-to-merge` label". The label `review:accepted`
did stay, but the PR was re-parked and needed a second clearance.

**PR #2347** (2026-09-20). `git merge-tree --write-tree ed4103e9e 015e18a6f` exits non-zero with conflicts in
`we:docs/agent/testing.md`, `we:skills-src/conveyor/runner.mjs` and
`we:skills-src/conveyor/__tests__/runner.test.mjs`. The card's own measurement found 8 changed `+/-` lines
in the contribution.

## 4. Prior art

Fetched this session (quotes in the research topic):

- **Gerrit** `copyCondition`: `TRIVIAL_REBASE` requires a conflict-free rebase with the same diff;
  `MERGE_FIRST_PARENT_UPDATE` covers a merge commit that differs only in its first parent. `ChangeKindCacheImpl`
  re-merges in memory and requires tree equality; anything else is `REWORK`.
- **Chromium**: Code-Review copies on `NO_CHANGE OR NO_CODE_CHANGE OR TRIVIAL_REBASE` (plus committer-uploaded
  unchanged files); Commit-Queue only on `NO_CHANGE`.
- **GitLab**: patch-id comparison across `git rebase` / `git merge <target>`; Code Owner approvals drop when
  their files change.
- **GitHub**: stale approval dismissed when the recorded diff changes, including after **Update branch**; since
  2023-06-06 whenever the merge base changes. A search snippet saying approvals are preserved "in most
  situations where no new changes are introduced" could not be confirmed in the fetched page.
- **Phabricator**: sticky accept, no check.
- **git**: `patch-id` ignores whitespace and line numbers; `range-diff` output "is not intended to be
  machine-readable".

## 5. Statute

No anchor in `we:docs/agent/platform-decisions.md` codifies review binding to a commit (#2409), the re-stamp
or the fingerprint escape. Same-turf anchors: `#parked-pr-conflict-dispatched-not-scripted`,
`#clear-human-requires-current-head-advisory-review` (ruled; unbuilt, #3692),
`#review-human-declarative-leash-only`, `#review-pending-clean-verdict-mechanical-accept`.

## 6. Not verified

- Why the #2365 accept could not compute its net diff (no digests stamped).
- Whether the re-stamp gap (an author push re-stamped by the drain's own rebase) has ever fired in practice.
- GitHub's exact comparison method (not published).
