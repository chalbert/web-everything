---
bornAs: x7qu5y1
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# the drain now calls review-set-label with a --repo it may not be standing in

`we:scripts/review-set-label.mjs` computes its reviewed-diff fingerprint with NO explicit cwd, and its own comment calls that an invariant rather than an oversight: the CLI was single-PR and operator-invoked, so it ran from the PR's own repo. It states the condition that would break it — 'if this CLI ever grows a --repo that can name a repo other than the cwd's, this call has to take a cwd with it, or it will fingerprint the wrong tree'. The #3200 drain re-stamp made the drain a caller, passing an explicit --repo that can name a remote constellation repo, while the drain sweeps three repos in one process. The condition is now met. It does not fire only because `restamp` is absent from the `accepted || clear-human` list that computes the fingerprint, so nothing is computed and only reviewed-sha is stamped.

## Why this is a trap rather than a live bug

Today the re-stamp is safe, and safe for an accidental reason. `restamp` stamps only `reviewed-sha`, because
the block that computes `reviewedDiff` is gated on `to === 'accepted' || to === 'clear-human'` and `restamp`
was never added to it. No fingerprint is computed, so no fingerprint can be computed against the wrong tree.

That is sufficient for the loop #3200 fixes — the SHA marker matches the new head, which is the staleness
gate's first tier — and it degrades toward the STRICTER path, never the looser one.

The trap is the obvious next improvement. Someone will reasonably want the re-stamp to carry the diff and
contribution fingerprints too, so a LATER head move is still covered. Adding `restamp` to that list is a
one-word change that looks harmless and would silently fingerprint whatever tree the drain happens to be
standing in — for a remote constellation repo, not the PR's repo at all. A wrong fingerprint does not throw:
it produces a marker that never matches, so the PR re-parks forever, which is the exact failure #3200 was
built to end.

## Two ways to close it

- **Thread a `cwd` through.** `restampAcceptance` already knows the repo's clone directory — the rebase-drop
  loop computes `cloneDir` immediately above the call site. Passing it, and having the CLI accept and use it,
  makes the invariant hold by construction rather than by the absence of a list entry.
- **Refuse instead.** Have the fingerprint block throw when `--repo` names a repo that is not the cwd's, so the
  wrong-tree case is impossible rather than merely avoided. Stricter, and it converts a silent wrong answer
  into a loud refusal.

The second is better if the CLI is ever invoked from somewhere else too; the first is enough for this caller.

## Done when

1. **Executable** — a test that invokes the fingerprint path with a `--repo` naming a repo other than the
   process cwd's, and asserts it either uses that repo's clone or refuses. It would pass vacuously today, so it
   must be written against a `restamp` that DOES compute a fingerprint.
2. The comment in `we:scripts/review-set-label.mjs` that states the invariant is updated to say which callers
   now pass `--repo`, so the next reader is not told the CLI is still single-PR and operator-invoked.
3. The single-PR operator path is unchanged — this must not make the ordinary `--to=accepted` run require a
   flag it never needed.
