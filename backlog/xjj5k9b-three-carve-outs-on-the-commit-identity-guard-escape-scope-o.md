---
kind: story
size: 2
status: open
dateOpened: "2026-08-25"
tags: []
---

# Three carve-outs on the commit-identity guard: escape scope, order-insensitivity, message values

The #3269 arm (`we:scripts/guard-bash.mjs`, landed via PR #1550) converged at `accept` on round 5 carrying
three CONFIRMED findings, all dispositioned carve-out. None blocks — the arm denies every override it was
built for and no longer over-reaches — but each is a real edge, recorded here rather than dropped.

1. **The escape only works glued to the segment (degraded).** `reason()` tests
   `/\bCOMMIT_IDENTITY_OK=1\b/` against the CURRENT segment, so
   `export COMMIT_IDENTITY_OK=1 && git -c user.email=… commit` is still denied. The deny message says
   *"prefix `COMMIT_IDENTITY_OK=1`"* and the prefix form does work, so the documented path is honest — but an
   operator who reaches for `export` gets a refusal with no hint why. The whole-command half already reads
   the full text; the per-segment half should too.

2. **The whole-command check is order-insensitive (degraded).** `commitIdentityCommandReason` denies whenever
   ANY segment sets an identity and ANY segment commits, regardless of order — so
   `git commit -m ok && git config user.email x@y` is refused even though the commit was already correctly
   attributed and the config write follows it. The PR text says a standalone config write is legitimate;
   this denies one that merely shares a command line with an earlier, innocent commit.

3. **`isGitCommitSegment` scans message values (cosmetic).** It looks for a literal `commit` token across
   every raw token, including `-m` values — unlike `isCommitIdentityOverride` directly above it, which
   exempts message values by position. So `git tag -m commit …` or `git merge -m commit …` reads as a commit
   for the whole-command gate. Harmless today (it only matters when another segment also sets an identity),
   but the two halves of one arm disagree about what "commits" means, which is the kind of drift that bites
   later.

## Why this is filed rather than fixed in-place

The arm took **four review rounds**, each finding a real defect: two bypasses (shell quoting; git's
case-folding of config keys), one coverage gap (cross-segment overrides), then two over-reaches — plus a
third I introduced while fixing those, which briefly made the arm deny nothing at all. Round 5 accepted.

Continuing to patch a 40-line shell-string matcher across a sixth round has a worse expected value than
stopping: each round's fix has itself introduced or exposed the next defect. The remaining three are small,
bounded and written down. If a future round finds a fourth class of defect here, that is the signal that
shell-string matching is the wrong shape for this rule — see the note below.

## Done when

1. **Executable** — the escape is honoured wherever it appears in the command, not only in the offending
   segment; a test pins `export COMMIT_IDENTITY_OK=1 && git -c user.email=… commit` as allowed.
2. **Executable** — an identity write that strictly FOLLOWS every commit in the command is allowed; one that
   precedes any commit is still denied. Both directions pinned.
3. **Executable** — `isGitCommitSegment` exempts message values the same way `isCommitIdentityOverride`
   does, and a test pins `git tag -m commit` as not-a-commit. The two halves share one definition rather
   than each carrying their own.

## Note — the shape question, if this recurs

A shell-string guard can only ever enumerate spellings, and git offers many (`-c`, `--author`, env pairs,
`git config`, per-segment and cross-segment, folded case, quoted, glued). The structural alternative is to
check the RESULT rather than the invocation: a `post-commit` hook, or a push-time check that refuses a
commit whose author does not match the configured identity. That closes every spelling at once and cannot
be evaded by a new one. Out of scope here; worth ruling if a fourth defect class appears.
