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

Nothing is silently filtered either. A near-match, an ambiguous paraphrase and a bare numeral in
unrelated prose are exactly what the person doing the correcting needs to see, so every site is reported
and *labelled* — `exact`/`normalized` are `confirmed`, `near`/`token` are `undecided`, and a site inside a
retraction's own neighbourhood is listed with `retracted: true` rather than dropped. Only an unretracted
`confirmed` site is a survivor, and only survivors set the exit status.

The corpus is `git ls-files` over the working tree plus any document supplied with `--document`, so
`report.completeness` is **always** `partial` — there is no branch that sets it otherwise. Every report
names what it could not reach: commit messages already written, PR titles/bodies/review comments on
GitHub, merged PRs, the sibling constellation repos, and untracked/ignored/binary/over-size files.

## Done when

1. **Executable** — `npx vitest run claim-sweep -t "#3307" | grep -qE "Tests +[0-9]+ passed"`. Fails
   before this item lands — `we:scripts/lib/claim-sweep.mjs` and its suite do not exist, so the filter
   selects nothing and there is no `Tests N passed` line to match — and passes after (42 passed).
   The `grep` is load-bearing: a `-t` filter matching nothing is an empty selection, and vitest exits
   **0** on one, so the bare form would be green before the work (`3319`'s criterion records the same
   trap).
2. **Real specimen** — the frozen fixtures replay the `84 recorded verdicts` figure at the moment its
   correction was half applied: parent `3318` already retracted, child `3319` still asserting it,
   `we:scripts/lib/jury-core.mjs` carrying the numeral in a comment. The sweep names `3319` as the one
   surviving site, reports the code comment as `undecided`, and lists `3318` as already-retracted.
3. **Mutation** — correcting only the quoted site drops the survivor count to 0 while the code comment
   is still named; re-introducing the claim in a fourth file raises it there; deleting the retraction
   marker turns the parent card's quotation back into a survivor.
4. `npm run check:standards` — 0 errors.
