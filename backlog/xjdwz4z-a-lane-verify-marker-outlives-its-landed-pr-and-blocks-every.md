---
kind: story
size: 2
status: open
dateOpened: "2026-09-06"
tags: []
---

# A lane verify marker outlives its landed PR and blocks every later verification in that lane

we:scripts/verify-lane.mjs writes a terminal green record to the lane's .git/.lane-verify and refuses to start a new run that would overwrite it - correctly, since destroying a live green would lose a result something may still need. But nothing clears the marker when the PR it certified LANDS. The green is then spent, and the lane is permanently unverifiable: every later run in that lane refuses with superseded, naming a sha that merged hours ago. Observed 2026-09-06: lane-1's marker held green for ef74eb85 (PR #1959, merged 19:42) and refused to verify 3a95983b, the very next change in the same lane. Resolution today is to remove the file by hand after proving the sha is an ancestor of origin/main - which is the right test but the wrong place for it. Either clear the marker at land (the drain knows the sha it merged), or teach the refusal to yield when its protected sha is already an ancestor of the integration branch, since a merged green protects nothing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. **Executable** — after a lane's PR merges, `we:scripts/verify-lane.mjs` in that same lane STARTS a run
   for the new head instead of refusing `superseded`. Reproduce by leaving a terminal-green marker whose
   `sha` is an ancestor of `origin/main`, then verifying a later commit in the same lane.
2. **A live green is still protected** — the refusal must stand when the marked sha is NOT yet an ancestor
   of the integration branch. That arm is the whole point of the guard and must keep its test.
3. A test covers both arms: merged-sha marker ⇒ proceeds; unmerged-sha marker ⇒ still refuses.

## The two candidate fixes

- **Clear at land.** The drain knows the sha it merged and owns the lane afterwards, so it can drop the
  marker. Narrow, but only helps lanes the drain lands.
- **Teach the refusal to yield to a merged sha.** `git merge-base --is-ancestor <marked sha> origin/main`
  is one call, and a merged green protects nothing by definition. Works regardless of how the PR landed —
  including the connector route this VM has to use, where the drain never sees the merge at all.

The second looks right, with the first as a tidy-up. Worth noting the check is the same one used by hand to
decide it was safe to delete the marker today — so the fix is moving an existing judgement into the code
that already needs it.

## Provenance

2026-09-06. `lane-1`'s marker held `green` for `ef74eb85` (PR #1959, merged 19:42) and refused to verify
`3a95983b`, the next change in the same lane. Two `verify` runs reported `unrun` / `did-not-run` /
`superseded` before the cause was found — and the operation's own output does not surface the marker's sha,
so the reason only became visible by running `we:scripts/verify-lane.mjs` directly. That is a second, smaller
gap: the wrapper swallows the detail that identifies the blocker.
