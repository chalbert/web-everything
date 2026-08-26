---
bornAs: x6t2z6h
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/review-render.mjs
  - we:scripts/operations/review-pr.mjs
  - we:scripts/operations/__tests__/review-pr.test.mjs
tags: [review, jury, testing]
---

# Validate a juror's cited file against the net diff, and cover the AI seam with fake-juror fixtures

Nothing in the review pipeline checks that a juror's finding cites a file actually in the run's net changed-file list, so a hallucinated path flows through to a published verdict and can bounce a PR on its own. Close that, and pin the whole AI seam with a fake-juror fixture library — realistically-bad answers driven end-to-end through the real engine.

## The hole, precisely

`we:scripts/operations/review-pr.mjs`'s `reduce` step already reads `findings.read`, which carries `netChangedFiles` — the run's own ground truth, computed from the two-tree diff and stated to the juror verbatim in `buildPanelMandate`'s `GROUND TRUTH` block. Nothing on the way back compares a finding's `file` against it. `normalizeFinding` copies `raw.file` through with `String(raw.file)` and no further question asked, so a finding naming a path this PR never touched reaches `deriveVerdict` as an outstanding, undeclared-disposition finding, which fails closed to blocking, which is `changes`. One fabricated path bounces the PR for a round on its own, and the published comment cites it as though it had been checked.

The existing suite drives the real engine end-to-end, but its canned juror has exactly two shapes and both are perfectly formed. There is no coverage of a juror that is *plausible and wrong*, which is the only failure mode a language-model seat actually has.

## The ruling on what to do with an off-scope citation

**Downgrade to non-blocking and keep it fully visible — never drop, never refuse the run.**

- **Not refuse.** The review happened. One bad citation from one seat would discard the sibling seat's legitimate findings too, and a fabricated path is a routine model failure, not a signal the run is unusable. Refusal is what the pipeline already does for a juror that said *nothing* (`review-pr.reduce`'s silent-juror throw) — that is `unrun`, and this is not.
- **Not drop.** A validator that deletes findings is strictly worse than the hole. A real defect described correctly with a slightly-wrong path (a rename, a `we:` prefix, a sibling-lane file) would vanish with no trace, and an escaped defect costs more than a wasted round.
- **Downgrade + disclose.** The finding stays in the published list, carries `citationScope: 'unverifiable'`, renders with an explicit marker, but is withheld from the set `deriveVerdict` reduces. So a claim whose only machine-checkable fact is false loses its *automated consequence* and keeps its *human-readable signal*.

The un-blocking is computed from ground truth the run owns, never from a word the juror said about itself — the reduce recomputes `citationScope` on every finding before use, so a forged value on the way in decides nothing. That is the same discipline `normalizeFinding` already applies to `disposition`.

Guarded in the negative direction, which matters more than the hole:

- A finding with **no** `file` is never flagged (a prose finding about the PR description is legitimate).
- Citations are compared after canonicalisation — a `we:` prefix, `./`, diff `a/`/`b/`, a trailing `:NNN`, surrounding backticks, a leading `/`.
- When the net basis is **degraded or unscored**, validation is skipped entirely. Otherwise every finding on a `ref-unresolved` run would read as hallucinated.

## Done when

1. **Executable** — the fixture suite runs and is green, and its assertions fail on `origin/main`:

   ```
   npx vitest run review-pr -t "#3351" | grep -qE "Tests +[0-9]+ passed"
   ```

   On `origin/main` the filter selects zero tests (the block does not exist), so the `Tests N passed` line is absent and the grep fails — which is the point of asserting the line rather than trusting vitest's exit code, since a filter matching nothing exits `0`.

2. A fake-juror fixture library covers, driven through the real engine to its `confirm` suspend: an off-scope cited file; a `line` past end-of-file and a negative/zero one; prose where structured findings belong; 50 findings; a missing and an unknown `disposition`; a `summary` that contradicts its own findings in both directions; the two seats disagreeing; empty/whitespace `summary`; a `findings` value that is not an array.

3. A legitimate in-scope finding still blocks, at every canonicalisation variant tested.
