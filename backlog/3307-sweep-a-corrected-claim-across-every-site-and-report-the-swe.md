---
bornAs: x2ra4b2
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/claim-sweep.mjs
tags: []
---

# Sweep a corrected claim across every site, and report the sweep

Correcting the quoted instance leaves the same claim standing elsewhere. This PR proved it three times, and a peer session reports it as the single defect class behind almost every bounce across 13 PRs in one day — instructing an agent to watch for it did not stop it recurring. Make it mechanical: grep every changed file plus the PR body and title for the claim, fix all sites, and emit the sweep so a reviewer can see it ran.

The three: r1 fixed the epic card and left the PR description; r2 fixed the description and left `we:scripts/lib/jury-core.mjs` and a sibling decision card; and one reported fix never applied at all, because a guard aborted the command chain containing it, so a stale body was uploaded and reported as done.

## It REPORTS every site; it does not fix them

> **Retracted — this card's opening paragraph said "grep every changed file plus the PR body and title
> for the claim, `fix all sites`, and emit the sweep". The `fix all sites` half is withdrawn as built.**
> Rewriting every site is how ONE wrong claim becomes N wrong claims. On 2026-08-26 a card id was
> believed nonexistent and "corrected" to a new id across a commit message, a PR title and a PR body —
> and the original turned out to be real and in flight. Three sites rewritten, every one of them wrong,
> from a starting position of one site that was right. Whether a replacement is correct is a review
> judgment; finding every site is not (#51 hookable-vs-judgment). So the deliverable is the sweep, and
> the edit stays with a human. `--fix` / `--rewrite` / `--apply` are recognised and REFUSED with that
> reason, rather than failing as unknown flags.

> **Retracted — this paragraph opened "Nothing is silently filtered either." That was false as built, in
> the two ways review #1620 found.** The `near` tier excluded a shingle-containment of exactly 1, so the
> strongest non-substring paraphrase it could see reached no tier and left no trace in the report; and
> `retractionNear` matched a dozen short English phrases as bare substrings anywhere in a ±6-line window,
> so an unretracted claim sitting beside "…on the old display it read as a jumble of digits" was filed
> under ALREADY RETRACTED and the CLI exited 0 "clean". Measured over the tracked markdown at
> `origin/main` (4133 files, 300929 lines), that rule put **11620 lines — 3.86%** inside a "retraction"
> window across **536 files**, with `superseded` (424), `it read` (133) and `was wrong` (124) each
> outnumbering `retracted` (91) itself. Both defects are fixed and pinned by tests that redden on
> reversion. The corpus figures are quoted at `origin/main` rather than at this branch's tree on purpose:
> the branch's own retraction prose moves them, and a reviewer can reproduce the `origin/main` numbers.

What is reported, accurately: a near-match, an ambiguous paraphrase and a bare numeral in unrelated prose
are exactly what the person doing the correcting needs to see, so every site that reaches a tier is
reported and *labelled* — `exact`/`normalized` are `confirmed`, `near`/`token` are `undecided`, and a site
under a retraction *label* is listed with `retracted: true` rather than dropped. Only an unretracted
`confirmed` site is a survivor, and only survivors set the exit status. Retraction detection is anchored
to the shapes a retraction is actually written in and errs toward leaving a site a SURVIVOR, because an
over-reported survivor costs one glance and a laundered one costs a bounce round.

The corpus is `git ls-files` over the working tree plus any document supplied with `--document`, so
`report.completeness` is **always** `partial` — there is no branch that sets it otherwise. Every report
names what it could not reach: commit messages already written, PR titles/bodies/review comments on
GitHub, merged PRs, the sibling constellation repos, and untracked/ignored/binary/over-size files.

## Done when

1. **Executable** — `npx vitest run claim-sweep -t "#3307" | grep -qE "Tests +[0-9]+ passed"`. Fails
   before this item lands — `we:scripts/lib/claim-sweep.mjs` and its suite do not exist, so the filter
   selects nothing and there is no `Tests N passed` line to match — and passes after (68 passed).
   > **Retracted — this line read "(42 passed)".** That was the count at the first cut. Review #1620
   > bounced the PR for two silent-drop defects and two untested first-cut fixes; the prevention for all
   > four took the suite from 42 to **68**. Re-measured on this branch, not carried over.
   The `grep` is load-bearing, but not for the reason first written here.
   > **Retracted — this read "a `-t` filter matching nothing is an empty selection, and vitest exits 0 on
   > one, so the bare form would be green before the work."** The first half is true; the conclusion is
   > false for *this* criterion. Measured in the lane, all four combinations:
   >
   > | tree state | `-t` filter | bare exit | with `\| grep -qE` |
   > |---|---|---|---|
   > | `main` (neither file exists) | `#3307` | **1** — `No test files found` | **1** |
   > | this branch | `#3307` | 0 — `68 passed` | **0** |
   > | this branch | matches nothing | **0** — `68 skipped` | **1** |
   >
   > So before the work the bare form already fails, because there is no test *file* — not because of an
   > empty selection. The `grep` earns its place against the OTHER row: once the file exists, a renamed
   > `it()` or a drifted filter selects nothing, vitest reports `68 skipped` and exits **0**, and the bare
   > form would go green while testing nothing. That is the trap `3319`'s criterion records.
2. **Real specimen** — the frozen fixtures replay the `84 recorded verdicts` figure at the moment its
   correction was half applied: parent `3318` already retracted, child `3319` still asserting it,
   `we:scripts/lib/jury-core.mjs` carrying the numeral in a comment. The sweep names `3319` as the one
   surviving site, reports the code comment as `undecided`, and lists `3318` as already-retracted.
3. **Mutation** — correcting only the quoted site drops the survivor count to 0 while the code comment
   is still named; re-introducing the claim in a fourth file raises it there; deleting the retraction
   marker turns the parent card's quotation back into a survivor.
4. **No silent drop, either way** — the two directions a sweep can lie, each pinned by a test that
   reddens when its fix is reverted:
   - a site that reaches the top of the `near` tier (shingle-containment exactly 1 on a NON-substring)
     is reported, not dropped for scoring too well;
   - a claim beside ordinary prose using a marker phrase in a non-retraction sense (`it read`,
     `was wrong`, `superseded`, …) stays a **survivor** and the CLI still exits 1.
   Every fix in this card is re-reverted and the suite re-run; the mutation log is in the commit that
   made it. A green suite over an unreverted fix proves nothing, which is how the first cut shipped two
   "fixed here" defects with no test on either.
5. `npm run check:standards` — 0 new errors and 0 new warnings vs this lane's `main`, measured both ways
   in the same session rather than compared against a number written on a card.
