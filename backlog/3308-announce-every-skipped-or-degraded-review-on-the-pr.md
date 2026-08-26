---
bornAs: x5pen0r
kind: story
size: 2
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
scope:
  - we:scripts/merge-ai-prs.mjs
tags: []
---

# Announce every skipped or degraded review on the PR

22.5% of merged PRs carry no recorded verdict. That is a ruling (#2631), not an omission — but nothing says so on the PR, and a silent absence reads as a clean bill of health. merge-ai-prs already carries a per-PR skip reason; post it, along with juror timeouts and any partial review, in the "Incomplete review — these files were not examined" shape.

## Done when

1. **Executable** — the drain's review-coverage reader and its announcement surface are proven:

   ```sh
   npx vitest run merge-ai-prs -t "#3308" 2>&1 | grep -qE "Tests +[0-9]+ passed"
   ```

   The `grep` is load-bearing, not decoration: `vitest -t <filter>` exits **0** on a tree where the filter
   matches nothing (a selection of zero is a success), so the bare exit code cannot distinguish "the tests
   pass" from "the tests do not exist". Asserting a `Tests N passed` line is what makes it fail before this
   item lands. Observed on `origin/main` (`f4160eaa`): `Tests  400 skipped (400)` ⇒ grep exit **1**.
   Observed after: `Tests  33 passed | 400 skipped (433)` ⇒ grep exit **0**.

   > **Corrected twice.** This line first read `Tests  27 passed | 400 skipped (427)`, then
   > `Tests  32 passed | 400 skipped (432)`. Neither was wrong when written — the round-1 correctness fix
   > added five cases, and the noise measurement below then replaced six condition cases with seven
   > exclusion cases. Every figure above was re-measured rather than carried forward.

2. **Not noisy — measured, not asserted.** Replayed over the 60 most recently merged PRs in this repo, the
   shipped `reviewCoverageGaps` posts a notice on **8 (13.3%)**, all of them `no-recorded-review`. The
   pre-measurement version of the same function posts on **59 of the same 60 (98.3%)**, which is the failure
   this criterion exists to catch: an announcement on nearly every PR trains readers to skip it, recreating
   the silence it was built to end. Four conditions were cut on that measurement, each with its rate pinned
   in a test of its own so a later change that re-adds one has to argue with the number:

   | cut condition | fired on | why it is not a departure |
   | --- | --- | --- |
   | self-declared single-lens run | 21/60 (35%) | the record already says so in its own body — and #3319 retired the sentence from the renderer, so a detector reads legacy records only |
   | re-stamped acceptance | 31/60 (52%) | the drain's own content-preserving rebase path, granted only after the reviewed-contribution markers clear it |
   | moved head sha ("stale basis") | 12/60 (20%), all false | #2409 already refuses to merge a PR whose acceptance does not cover its head, so a sha difference reaching the merge cascade is proof that gate ran |
   | `clear-human` ceremony clearance | 1/60 | its own comment states exactly what it proves and what it does not (#2895) |

   Both terminal record shapes (re-stamp, `clear-human`) stop the analysis rather than falling through to
   the basis checks — reading either as an accept would manufacture `unstated-basis` on 53% of merges, the
   same noise by a different door.

## Why the manual alternative does not count — "accidentally honest"

On PR #1609 a reviewing session wrote a full lens disclosure by hand: it recorded that the security pass had
been done **by the session itself rather than by a juror**, and that four of the five lenses never sat. That is
exactly the information this item exists to surface, volunteered without any mechanism asking for it.

The session that wrote it made the argument against relying on it, in its own words:

> My hand-written disclosure was **not reliably honest, it was accidentally honest.** I did that because I
> *knew* the panel was unwired, not because any mechanism told me. On a different day, with a different
> reviewer, that disclosure simply would not have been written — there is nothing that makes it happen.

**Anything that depends on a reviewer volunteering what it did not do is a control that works only when it is
least needed.** A reviewer who has understood the gap will disclose it and did not need the notice; a reviewer
who has not understood it writes nothing, and that silence is indistinguishable from a clean review — which is
the exact failure this item names in its first line.

That is the argument for the announcement being **derived from the record** rather than authored. It is also
why the noise measurement above is load-bearing rather than polish: a notice that fires on 98.3% of merges is
ignored on exactly the same schedule as a disclosure nobody writes, and the two failure modes are
indistinguishable to a reader.

## What shipped

A `review-coverage` comment posted by the drain before `gh pr merge`, as a fourth `drainReasonMarker` kind with
its own marker and dedupe bucket, so it survives on the merged PR. It reads the durable review records already
on the PR and names what was **not** examined, firing only on the five kept codes — `no-recorded-review`,
`unseated-mandatory-lens`, `unstated-basis`, `relief-waived`, `relief-waived-pass-wide`.

A review that never ran produces no verdict comment and so cannot host the announcement of its own absence; the
drain is the only actor that sees every landing PR either way, which is why the notice is its own comment rather
than an addition to a verdict. The pre-existing land stamp is gated on `hasManifest`, which is precisely why it
missed this population — the no-verdict PRs are the manifest-less orphan and implementation halves.

### Known limits, not fixed here

- **Juror-level degradation has no machine-readable field**, so the reader parses rendered prose. The durable
  fix belongs in `we:scripts/operations/record-verdict.mjs` / `we:scripts/lib/jury-core.mjs`.
- **An errored or timed-out juror is invisible**, for the same reason.
- **"Narrower than the care level called for" is not computable** — the record does not carry the care level.
- A parked PR gets no notice, deliberately: it has not landed, so nothing has been accepted silently.
