---
kind: story
size: 3
parent: "2527"
status: open
blockedBy: ["2832"]
dateOpened: "2026-08-02"
tags: [drain, review, merge, gate, totality, tech-debt]
---

# Merge-gate consumer totality — discover every decision-gate site instead of remembering them

A discover-based guard that fails when any merge-decision gate in we:scripts/merge-ai-prs.mjs neither handles reviewHeld nor is explicitly exempted — built on the landed we:scripts/lib/verdict-totality.mjs, not a hand-rolled source scanner.

## Why

#2820 made a green PR under an uncleared review hold `decision:'skip'` with `reviewHeld:true`. That single status
change re-routed the PR through **every** site gated on the merge decision (`decision ===/!== 'merge'`) in
we:scripts/merge-ai-prs.mjs. Across three review rounds on the #2820 PR, four such sites were found by memory —
the escalation-pass escape, the id-collision heal, the `!escalate` dead zone, and then a **fifth** (the review-label
mint set) that slipped precisely because the guard added in round 2 pinned the `reviewHeld` predicate's *meaning*
and never enumerated its *consumers*.

The class is real and it is not closed: a sixth site added by any future PR inherits the same silent miss.

## Provenance — why this is filed rather than shipped in the #2820 PR

Round 3 of the #2820 PR did attempt this guard (a `merge-gate-totality` lib plus a `merge-gate-consumers` test) and
it was **removed on the operator's scope call**, for two reasons worth carrying forward:

1. **It hand-rolled a parser.** The guard stripped comments with its own character scanner that had no
   regex-literal handling. It already mis-parsed two real lines in we:scripts/merge-ai-prs.mjs (the
   `/^refs\/heads\//` and `/^lane\//` literals), and a regex whose body yields a comment-opener would silently put
   the scanner into comment mode and blank arbitrary code — making the guard return "no errors" on a file with a
   real unguarded gate. **A guard that fails toward under-matching is worse than no guard**, because a vacuous pass
   reads as coverage. Its preceding-comment walk could also borrow an exempt marker from an unrelated doc block
   above, falsely exempting a new site.
2. **It was built on unlanded code.** It was patterned on we:scripts/lib/verdict-totality.mjs, which is not on
   `main` — it lands with #2832. Building on it coupled two in-flight PRs that already collided on three files.

Both problems dissolve once we:scripts/lib/verdict-totality.mjs has landed: the pattern is then real, proven, and
reusable instead of re-implemented from scratch under review pressure.

## What to build

Reuse the landed we:scripts/lib/verdict-totality.mjs mechanism rather than writing a second scanner. Every
merge-decision gate in we:scripts/merge-ai-prs.mjs must either:

- reference `reviewHeld` in its gate expression (**covered**), or
- carry an explicit marker with a stated reason for why the hold is irrelevant there (**exempt**).

An unmarked, uncovered gate is an error. The five legitimately-exempt sites are already annotated in the #2820 PR
and each was independently verified correct — carry those reasons over:

- the manifest-strip predicate (a held PR must never be force-push-mutated),
- the merge-order builder in `planLabelDrain` (a held PR must not join the merge cascade),
- the downgrade-only `!REVIEW_ESCALATION` backstop (a held PR is already `skip`),
- the final `toMerge` filter (the hard AND that must exclude held PRs),
- the human-readable stderr log (no control flow).

## Acceptance

- The guard **discovers** its sites from source; it carries no hand list, so a newly-added gate cannot pass by
  omission.
- **It cannot pass vacuously.** Asserting `errors === []` is not sufficient — the guard must also assert it found
  the expected number of real sites, so a parse failure that finds *zero* gates fails loudly instead of reporting
  green. This is the specific defect that got the first attempt pulled.
- Comment/string handling is correct for the constructs actually present in we:scripts/merge-ai-prs.mjs —
  regex literals containing `/` and quote characters, template literals, and apostrophes inside line comments. If
  reusing we:scripts/lib/verdict-totality.mjs does not already cover these, fix it there once rather than forking a
  second scanner.
- An exempt marker is attributed only to the gate it actually annotates — never inherited from an unrelated
  preceding comment block.
- Regression: injecting a new unguarded merge-decision gate into the real file makes the guard fail with an
  actionable message naming the line.
- Reverting any one of the three shipped `reviewHeld` fixes makes the guard fail (proving it is load-bearing).
