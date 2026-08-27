---
bornAs: x2ra4b2
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
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
> outnumbering `retracted` (91) itself. The corpus figures are quoted at `origin/main` rather than at
> this branch's tree on purpose: the branch's own retraction prose moves them, and a reviewer can
> reproduce the `origin/main` numbers.

> **Retracted, in turn — the retraction above said "the two ways review #1620 found", and closed "Both
> defects are fixed and pinned by tests that redden on reversion".** Both halves were wrong, and the
> second was wrong in exactly the way this card exists to stop.
> - There was a **third** way, found on the next round: the paragraph scan recorded a folded hit and
>   then `continue`d past the whole sentence loop, so an independent, token-less paraphrase sharing that
>   paragraph reached no tier at all — absent from survivors, from undecided, from `retractedSites` and
>   from `coverage.skipped` alike. The same two sentences split across two paragraphs both reported, so
>   the answer depended on the blank line rather than on the text.
> - "Pinned by tests that redden on reversion" did not hold for the first fix's sibling change.
>   Removing the near tier's per-block `break` was pinned by a test *named* for it whose two fixture
>   lines were literal substrings of the claim, so the document-wide `exact` scan answered them and the
>   near tier never ran on them; re-introducing the `break` left the suite green. A test can be named
>   for an invariant it does not exercise — round-1 finding 3 recurring inside the round-2 prevention.
>
> All three are fixed, and each is now pinned by a mutation that was actually re-run in this lane.

> **Retracted, a third time — the retraction above said "There was a **third** way" and closed "All three
> are fixed".** Written at round 3 and left standing through rounds 4 and 5, each of which found another
> way. **Five, not three** — three that dropped a site to no tier at all, two that laundered a live site
> into ALREADY RETRACTED and took the exit code to 0 "clean".
> - **Fourth** (round 4, laundering): a `~~strike~~` ANYWHERE on the site's own physical line counted as
>   retracting it, without ever asking whether the strike *covered* the claim. Not a contrived shape — it
>   is this repo's **dominant** strike convention to strike the old value and assert the corrected one
>   beside it on the same line, so the permissive rule laundered the common case. Now `struckCovers` asks
>   whether a struck span contains the text *this* site matched on, falling back to the strict whole-line
>   rule when there is no match text.
> - **Fifth** (round 5, silent drop): the numeral scanner read `\d[\d,]*`, swallowing a following comma
>   into the token, so a claim writing `84,` demanded that exact comma-adjacency and never saw `84`
>   written bare. Its **mirror** sat in `tokenPattern`, whose numeric tail rejected any following comma,
>   so a *site* writing `84,` was dropped just as silently. The review prescribed the first half only;
>   the second was found by testing the fix, and either alone leaves the drop reachable from the other
>   side. A comma is now internal only where it is a thousands separator — followed by exactly 3 digits.
>
> All five are fixed, and each is pinned by a mutation that was actually re-run in this lane. The count
> is corrected in the module header, on this card and in the PR body **together** — a count corrected in
> one place and left stale in another is precisely the defect this card exists to catch.

What is reported, accurately: a near-match, an ambiguous paraphrase and a bare numeral in unrelated prose
are exactly what the person doing the correcting needs to see, so a site that scores into a tier is
reported and *labelled* — and whether it scores does **not** depend on what else its paragraph happens to
contain. `exact`/`normalized` are `confirmed`, `near`/`token` are `undecided`, and a site
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
   before this item lands — `we:scripts/lib/claim-sweep.mjs` and its suite do not exist, so vitest finds
   no test *file*, prints `No test files found` and exits 1 — and passes after (93 passed).
   > **Retracted — this line read "(42 passed)".** That was the count at the first cut. Review #1620
   > bounced the PR for two silent-drop defects and two untested first-cut fixes; the prevention for all
   > four took the suite from 42 to **68**. Re-measured on this branch, not carried over.
   > **Retracted again — "(68 passed)".** Review #1620 bounced round 2 for a third silent drop and for a
   > test that did not exercise its own name; that prevention took the suite from 68 to **73**. Measured
   > in this lane in this session (`npx vitest run claim-sweep` → `Tests  73 passed (73)`), not carried
   > over from the line above.
   > **Retracted a third time — "(73 passed)".** Two further rounds each added prevention: round 4's
   > strike-coverage narrowing took the suite 73 → **82**, and round 5's numeral-comma fix took it
   > 82 → **93**. Re-measured in this lane in this session (`npx vitest run claim-sweep` →
   > `Tests  93 passed (93)`), not carried over from either line above.
   The `grep` is load-bearing, but not for the reason first written here.
   > **Retracted — this read "a `-t` filter matching nothing is an empty selection, and vitest exits 0 on
   > one, so the bare form would be green before the work."** The first half is true; the conclusion is
   > false for *this* criterion. Measured in the lane, all three rows:
   >
   > | tree state | `-t` filter | bare exit | with `\| grep -qE` |
   > |---|---|---|---|
   > | `main` (neither file exists) | `#3307` | **1** — `No test files found` | **1** |
   > | this branch | `#3307` | 0 — `93 passed` | **0** |
   > | this branch | matches nothing | **0** — `93 skipped` | **1** |
   >
   > So before the work the bare form already fails, because there is no test *file* — not because of an
   > empty selection. The `grep` earns its place against the OTHER row: once the file exists, a renamed
   > `it()` or a drifted filter selects nothing, vitest reports `93 skipped` and exits **0**, and the bare
   > form would go green while testing nothing. That is the trap `3319`'s criterion records.
   >
   > **Retracted — this table read `68 passed` / `68 skipped`.** The figures were right when measured and
   > the round-3 prevention moved them. All three rows were re-run in this lane in this session at 73,
   > including the `main` row (both new paths moved aside): bare exit 1 on `No test files found`, grep
   > exit 1. The shape of the argument is unchanged; only the count moved.
   >
   > **Retracted again — the table then read `73 passed` / `73 skipped`.** Rounds 4 and 5 moved it twice
   > more. All three rows were re-run in this lane in this session at **93**, the `main` row included
   > (both new paths moved aside → bare exit **1** on `No test files found`, grep exit **1**). The
   > argument for the `grep` is untouched: only the third row's count moved, and it is the row the
   > `grep` exists for.
2. **Real specimen** — the frozen fixtures replay the `84 recorded verdicts` figure at the moment its
   correction was half applied: parent `3318` already retracted, child `3319` still asserting it,
   `we:scripts/lib/jury-core.mjs` carrying the numeral in a comment. The sweep names `3319` as the one
   surviving site, reports the code comment as `undecided`, and lists `3318` as already-retracted.
3. **Mutation** — correcting only the quoted site drops the survivor count to 0 while the code comment
   is still named; re-introducing the claim in a fourth file raises it there; deleting the retraction
   marker turns the parent card's quotation back into a survivor.
4. **No silent drop, either way** — the directions a sweep can lie, each pinned by a test that reddens
   when its fix is reverted:
   - a site that reaches the top of the `near` tier (shingle-containment exactly 1 on a NON-substring)
     is reported, not dropped for scoring too well;
   - a claim beside ordinary prose using a marker phrase in a non-retraction sense (`it read`,
     `was wrong`, `superseded`, …) stays a **survivor** and the CLI still exits 1;
   - a `near` paraphrase is reported **whatever else its paragraph contains** — sharing a block with a
     verbatim copy of the claim must not suppress it, and N restatements in one paragraph are N sites.
     A paragraph carrying the claim wrapped twice reports both copies, and a single wrapped copy whose
     sentence opens on an earlier line is still ONE site, not two.
   Every fix in this card is re-reverted and the suite re-run; the mutation log is in the commit that
   made it. A green suite over an unreverted fix proves nothing, which is how the first cut shipped two
   "fixed here" defects with no test on either.
   > **Retracted — this item said "the two directions a sweep can lie", and the sentence under it
   > claimed every fix in this card was re-reverted.** There was a third direction (above), and one
   > round-2 fix was not covered: the near tier's per-block `break` had a test named for it that did not
   > exercise it, so re-introducing the `break` left the suite green. The mutation was not actually run
   > against that test. It is now, and it reddens.
   >
   > **Retracted, a third time — "There was a third direction (above)".** There were **five** in the end,
   > and the two that arrived after this item was written are pinned by the bullets added above:
   > - a `~~strike~~` sitting anywhere on the site's line no longer retracts a claim it does not cover,
   >   so the repo's dominant "strike the old value, assert the corrected one beside it" shape stays a
   >   **survivor** and the CLI still exits 1 (round 4);
   > - a comma next to a numeral no longer changes whether the token tier can see it, in **either**
   >   direction — claim-side or site-side — while `84` still does not match inside `84,000` (round 5).
   >
   > Each of the five is pinned by a mutation actually re-run in this lane, with the log in the commit
   > that made it. The pattern to notice is that this item's own count went stale three times in five
   > rounds; that is the defect this card exists to catch, arriving on the card that describes it.
5. `npm run check:standards` — 0 new errors and 0 new warnings vs this lane's `main`, measured both ways
   in the same session rather than compared against a number written on a card. Measured at the tip:
   **0 error(s), 1438 warning(s)** on the branch and **0 error(s), 1438 warning(s)** on the same tree with
   the two new paths moved aside and this card restored to `origin/main` — the two sorted issue lists are
   1438 lines each and byte-identical (`diff` empty), and no warning names either new file
   (`grep -c claim-sweep` → 0).
   > **Retracted — this item read "4 error(s), 1438 warning(s)" on both sides, and named four
   > `number-stranded` strays (`3358`, `3359`, `3360`, `3361`) as deliberately not bundled.**
   > True when written and false now: those four were JIT-numbered and healed on `main` at `6fbecfe1`
   > (→ `#3358`, `#3359`, `#3360`, `#3361`), so the rule no longer fires. Re-measured in this lane in
   > this session, both sides are **0 errors**. The strays needed no action from this PR and got none;
   > the reasoning for not bundling them stands unchanged for the next branch that meets one —
   > `number-stranded` rewrites citations in `we:docs/agent/platform-decisions.md`, which turns a
   > one-card change into a statute edit and parks it waiting for a human over a mechanical rename.
   >
   > This figure has now moved **twice** inside this item's life: 0 → 4 when four strays landed on
   > `main` mid-session, and 4 → 0 when the heal landed. That is the whole argument for the "measured
   > both ways in the same session" clause, and it is why the *procedure* is the criterion here and the
   > number is only its output.
