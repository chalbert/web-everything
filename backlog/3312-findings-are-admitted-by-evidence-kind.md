---
bornAs: xchz076
kind: story
size: 5
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/__tests__/jury-core.test.mjs
relatedTo: ["3351"]
tags: [review, jury, testing]
---

# Findings are admitted by evidence kind

A finding blocks only when it carries machine-checkable evidence — a repro, an embedded re-runnable command, or a resolved citation whose source text is quoted. Assertion-only findings advise and never block, and self-rated severity leaves the gate entirely (it is measured near-random). BLOCKED on suite runtime: test:unit is 693s against a 20-minute juror kill, so a red-before/green-after repro does not fit inside a review.

## The evidence ladder, and what each rung actually confirms

Four rungs, ordered by *what a pure function checked*, never by how convincing the finding reads. Nothing here reads `verdict`, `severity` or `impactIfUnfixed` to place a rung — that is the card's "self-rated severity leaves the gate" clause, honoured by construction.

| Rung | What is confirmed | What is **not** |
|---|---|---|
| `assertion` | nothing | — |
| `resolved-citation` | the named file really is in the subject's changed set | anything about whether the claim is true |
| `repro` | a single-line, command-shaped `reproCommand` is attached | that it was **run**, or that it reproduces anything |
| `quoted-citation` | the supplied source text really contains the `quote` | that the quoted words **imply** the defect |

**Deliberately excluded: a failing test.** That is the card's strongest evidence kind and it is out of reach — the parent's own blocker line — because `test:unit` is ~693s against a 20-minute juror kill. `repro` is *not* a stand-in for it and must not be read as one.

## The ruling: the floor ships OFF, and that is the point

The card's headline — *assertion-only findings advise and never block* — is **not** shipped as the default, and reversing that should be a measured decision, not an intuition.

Withholding a finding from the verdict is the DROP direction, and this repo has ruled on it twice on this exact seam. [#3351](/backlog/3351-validate-a-juror-s-cited-file-against-the-net-diff-and-cover/) chose downgrade-and-disclose over dropping a finding whose cited path is *demonstrably false*, because an escaped defect costs more than a wasted round; and `admitsCitation` fails **open** on an unrecognised scope word for the same stated reason. Both of those withhold on **disproof** — a fact the run checked and found false. An evidence floor withholds on **absence** — the run had nothing to check. Absence is a strictly weaker basis.

The parent programme's own record says so. On PR #1569 the `claim-accuracy` juror found a real test defect **two rounds before anyone else** and rated it `PLAUSIBLE`/`cosmetic`, saying *"I did not execute this in a live clone"*. Under a default-on assertion floor that real, early, correct finding would have been demoted to advisory. #3318 draws the opposite lesson from it in as many words: what belongs in the brief is the mutation probe, *"not a ranking of lenses"*.

So: **classify and disclose always; demote only when a caller raises `EVIDENCE_FLOOR`,** which ships at the bottom rung where it demotes nothing. Same shape as `earnsRound`'s `disposition` — a dial the caller turns on, never a verdict change nobody opted into.

Two things are never demoted however high the floor goes: a finding at or above `EVIDENCE_EXEMPT_IMPACT_BAR` (`unrecoverable`), and a finding that never earned a round anyway. And the floor refuses to enforce at all when the ground truth it needs is missing — no changed-file list, no `sources` for a top-rung floor, an unrecognised floor word — mirroring `scopeFindingsToCitedFiles`'s `enforced: false` guard against reaching the drop direction by omission.

`admitFindingsByEvidence` and `scopeFindingsToCitedFiles` stay **orthogonal and composable in either order**: disproof vs. absence, with different defaults for that exact reason.

## Done when

1. **Executable** — the block runs green on this branch and selects nothing on `origin/main`:

   ```
   npx vitest run jury-core -t "#3312" | grep -qE "Tests +[0-9]+ passed"
   ```

   On `origin/main` the filter selects zero tests, so the `Tests N passed` line is absent and the grep fails. Assert the line, not vitest's exit code — a filter matching nothing exits `0`.

2. A well-evidenced finding still blocks, and the shipped default still blocks an assertion-only one. Both asserted.

3. Wiring the dial into `we:scripts/operations/review-pr.mjs` is **follow-up, not this item** — the engine primitive lands first, and the floor should be raised on measured per-category precision (front A of #3318), not on the intuition that prose is weak.
