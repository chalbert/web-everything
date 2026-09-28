---
kind: story
size: 5
priority: high
parent: "4075"
status: open
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# lease-reaper branch fallback: reject lanes with unlanded merge-commit changes

we:scripts/conveyor/lease-reaper.mjs#defaultGitIsAncestor's squash/rebase fallback (git cherry sha HEAD) excludes merge commits entirely: a lane whose HEAD carries a merge commit with unique conflict-resolution content, but whose non-merge commits are already patch-equivalent upstream, reads as empty/all-'-' — falsely 'contained' — so we:scripts/conveyor/lease-reaper.mjs#laneQuietSincePr corroborates reclamation and the merge-resolution work is lost. CONFIRMED, impact broken, on PR #2835 (still unfixed on main 2026-09-28). Fix the containment check itself (not only a regression test) to conservatively reject a HEAD carrying an unaccounted-for merge commit rather than trusting cherry's per-commit view alone.

## Risks

- Must stay conservative in the SAFE direction only: `we:scripts/conveyor/lease-reaper.mjs#defaultGitIsAncestor` already fails closed (`null` on any unresolvable read, never a guess) — the fix should turn the merge-commit blind spot into a `false`/`null` (not contained / unknown), never relax an existing true-negative into a false "contained".
- The common case (a real `--no-ff` merge commit, or a genuinely single-commit squash) must keep working exactly as today — this file's own extensive doc comments (lines ~360-432) record several rounds of convergence findings on this exact function; a fix that reintroduces one of those (e.g. the squash/rebase patch-equivalence case) is a regression, not a fix.
- No mutation-tested proof was possible for the reviewer that raised this (read-only shell) — this card's own test plan must actually exercise a real git repo with a genuine merge commit carrying unique content, not a mocked `git cherry` call.

## Test plan (each fails before the change, passes after)

1. A real-git integration test (alongside the existing suite in we:scripts/conveyor/__tests__/lease-reaper.test.mjs) that: creates a lane branch, merges it into a copy of upstream with `--no-ff` producing a merge commit with unique conflict-resolution content, makes the lane's own non-merge commits patch-equivalent upstream by other means, then asserts `defaultGitIsAncestor`/`laneQuietSincePr` returns `false` (not contained), not `true`.
2. The existing squash/rebase-merge regression(s) in the same file still pass unmodified (no regression on the cases this function already handles correctly).

## Tasks

1. Extend `we:scripts/conveyor/lease-reaper.mjs#defaultGitIsAncestor`'s `git cherry` fallback to detect when HEAD's history includes a merge commit not present verbatim in `sha`'s history (e.g. via `git rev-list --merges` bounded to the HEAD..sha / sha..HEAD range) and treat that as "unaccounted for" — `false`, never a guess.
2. Add the real-git regression from Test plan #1.
3. Cross-check against the sibling xzvaya6-derived prevention card (approval-prevention-key:chalbert/web-everything#2835) filed in the same PR as this card — that card asks for the regression test; this card is the production fix it depends on.

## Proof plan (live, before/after)

- BEFORE: the Test plan #1 integration test fails — the merge-commit-only change is reported as contained and the lease is reclaimable.
- AFTER: the same test passes — the lane is correctly retained — and every pre-existing test in we:scripts/conveyor/__tests__/lease-reaper.test.mjs still passes.

## Done when

1. **Executable** — the Test plan #1 real-git integration test, red before this lands, green after.
