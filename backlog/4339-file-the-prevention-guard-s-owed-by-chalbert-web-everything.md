---
bornAs: xzvaya6
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "1398f53dfb9a9e32fb73dfdd84e17d8a6a26803a"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2835's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/lease-reaper.mjs` — Add a deterministic real-Git regression with unique merge-resolution content and require the containment check to reject it; conservatively reject unaccounted-for merge commits.
2. `we:scripts/conveyor/lease-reaper.mjs` — Add a deterministic real-Git test that squashes two distinct feature commits into one upstream commit and verifies safe reclamation using aggregate containment evidence.
3. `we:scripts/conveyor/lease-reaper.mjs:392` — A `check:standards` rule requiring git-integration tests that verify branch-level equivalence to operate on N>1 commit cardinality, preventing trivial single-commit false proofs.
4. `we:scripts/conveyor/lease-reaper.mjs:380` — A review lens or lint ensuring every explicit defensive parsing claim in prose is paired with a negative test case exercising the malformed input.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2835@b0da85e383921e3024cb8711605df3a3d4f49535

## Design

**Premise check (against `main` @ 1398f53df).** Guard 1 is ALREADY DONE: `#4337`'s own fixture at
`we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1263` builds a real git repo whose HEAD is a merge commit with
unique amended resolution content, asserts cherry alone reads "contained", and requires `laneQuietSincePr` → `false`;
the next fixture (content-free merge, starts at `:1317`) pins the conservative reject. The reject itself is the
`git rev-list --merges` veto in `we:scripts/conveyor/lease-reaper.mjs#defaultGitIsAncestor` (~lines 471-494). Guard 1 needs no work. Guards 2–4 are
genuinely open.

**Guard 2 (the real gap).** `defaultGitIsAncestor` (`we:scripts/conveyor/lease-reaper.mjs:431`) falls back to `git cherry -- <sha> HEAD`
(~line 453), a per-commit patch-id match. A GitHub *squash* of a lane with N>1 commits yields ONE upstream commit whose
patch-id equals none of the N lane commits, so cherry prints N `+` lines and the function returns `false`. That is safe
but means a genuinely landed multi-commit squash is never reclaimed early (it rides the TTL). Every existing squash
fixture (`we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1239`) uses a single lane commit, so the N>1 case is untested. Add an *aggregate* tier. **Restructure required:** today `if (!cherryContained) return false` returns BEFORE the
`rev-list --merges` veto, so the veto must be lifted to run on both the cherry-contained and the cherry-unmatched
paths (no merge commit in `sha..HEAD` on either), then the aggregate check runs only when cherry reported `+` lines.
Aggregate check: compare the FIRST whitespace-separated token of
`git diff $(git merge-base HEAD <sha>) HEAD | git patch-id --stable` against that of
`git diff <sha>^ <sha> | git patch-id --stable`. **Both tokens must be non-empty and equal** — `patch-id` prints
nothing for an empty diff, so two empty outputs must NOT count as equal (else an empty-net-diff lane vs an empty `sha`
reads "contained"). Equal ⇒ `true`. Require `sha` to be single-parent (mechanism: `git rev-list --parents -n1 <sha>`
shows exactly one parent; a merge `sha` skips the tier ⇒ `false`). Any git-read failure, including `merge-base`
failing ⇒ `null` (same three-way contract); differing ids ⇒ `false`. `patch-id` ignores whitespace, so "equal" means
patch-equivalent, not byte-identical — disclose this in the docblock (low risk: still the safe direction, since it only
turns `false` into `true` when the aggregate change matches a single-parent upstream commit). Reuse `isCherryOutputAllPatchEquivalent`'s
neighbours in `we:scripts/lib/git-patch-equivalence.mjs` only if a shared parse falls out naturally; otherwise keep the
spawn local like the cherry call.

**Guards 3 and 4** are `check:standards` rules / a review lens. They live in `we:scripts/check-standards-rules.mjs` and
the review docs, entirely outside this card's `scope:` (the two reaper files), and each is its own design (rule 3 needs
a heuristic for "git-integration test verifying branch-level equivalence"; rule 4 needs a way to pair a prose
defensive-parsing claim with a negative test). Forcing them here would blow the scope, so they are split out.

## MVP

Musts: (a) record that guard 1 is already satisfied by `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1263`; (b) the N>1 squash regression test (RED first);
(c) the aggregate-containment tier in `defaultGitIsAncestor` that makes it pass; (d) negative aggregate cases (below) that stay `false`;
(e) the veto lifted to cover both paths, the empty-patch-id guard and the single-parent check; (f) docblock update for
the new tier (incl. the whitespace-insensitivity disclosure); (g) file backlog items for guards 3 and 4 (as children of
`4075`) before this card resolves, so the debt cannot vanish.
OUT (see Follow-ups): implementing guard 3 standards rule, guard 4 review lens/lint.

## Test plan

All real-git fixtures in the lease-reaper test file, next to the `#4337` describe block, calling `laneQuietSincePr` with no
mocked readers.
1. **N>1 squash → `true`.** Lane has two distinct commits (`a`, `b`); `sha` is one squash commit adding both. Fails RED
   today: cherry gives two `+` lines so `defaultGitIsAncestor` returns `false`.
2. **Incomplete squash → `false`.** Lane holds `{a,b}`; the squash adds only `a`. A second sub-case: squash touches
   the same two files but with different content in `b`. Guards against over-accepting; passes before and after.
3. **Veto is the deciding factor → `false`.** Lane = commits `{a,b}` plus a content-free `merge main` whose
   `merge-base..HEAD` diff still equals the squash diff (aggregate ids equal). Without the lifted veto this would read
   `true`, so it FAILS RED if the veto is not applied on the aggregate path; it passes today only via the `+` early
   return, and pins tier order afterwards.
4. **Merge-commit `sha` → `false`.** `sha` is a real `--no-ff` merge whose diff would otherwise match; the
   single-parent check skips the aggregate tier.
5. **Empty diff → `false`.** Lane with a net-empty diff (commit then revert) vs an empty `sha` commit: both patch-ids
   are empty and must not compare equal.
6. **Aggregate read failure → `null`.** Injected fake `exec` (dispatching on `args[0]`/`args[1]`): `merge-base
   --is-ancestor` throws `{status:1}`, `cherry` returns `+` lines, `rev-list` returns empty, `diff` succeeds, and the
   `patch-id` spawn throws. Expect `null` (RED today: returns `false`). Mirrors the `:1365` describe.

## Proof plan

Run the real function against a throwaway git repo (created under a temp dir, never in a lane) reproducing the
N=2 squash (no branch switching — build with `git commit-tree`/separate refs): print `laneQuietSincePr` "before"
(importing the module from `main` @ 1398f53df via `git show`/a second clone: `false`) and "after" (the lane's change:
`true`), plus the raw `git cherry` output showing two `+` lines, plus the incomplete-squash (`false`) and empty-diff
(`false`) outputs. Paste all in the PR body. Then run
the lease-reaper vitest file (`npx vitest run lease-reaper`) green.

## Follow-ups

- (Filed by the builder per Must (g), not left as prose.)
- Guard 3: `check:standards` rule requiring git-integration tests that assert branch-level equivalence to use N>1 commit
  cardinality (file as a new backlog item scoped to `we:scripts/check-standards-rules.mjs`).
- Guard 4: review lens or lint pairing every prose defensive-parsing claim with a negative test (new backlog item;
  design needed for how a claim is detected).
- Guard 1: nothing owed — already covered by `#4337`.

## Done when

1. **Executable** — `npx vitest run lease-reaper -t "multi-commit squash"` fails
   before this item lands and passes after.
