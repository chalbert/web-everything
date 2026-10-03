---
bornAs: xgtcfie
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4871-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Add a prepare-brief lens item: when a card says 'on every X run, do Y', enumerate each code path that r… (from chalbert/web-everything#3706 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4871-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md:58` — Add a prepare-brief lens item: when a card says 'on every X run, do Y', enumerate each code path that reaches X (direct accept, accept via resume, queued accept) and require one test per path. This is a review lens, not a script-decidable gate.
2. `we:backlog/4871-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md` — Add a Must and test requiring every juror-supplied field written into the card (title, summary, prevention, line, anchor) to be either fenced as body text or passed through a cleaner. Better: a lint/write-gate that fails when a filing-input builder interpolates unsanitized finding fields into frontmatter or title.
3. `we:backlog/4871-review-a-finding-that-contradicts-the-pr-s-own-goal-blocks-a.md` — Specify one rollup card per accepted run (or a max-N cap with the overflow listed in a single card) and add a CLI test with many carve-outs asserting the filing count is bounded.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3706@85922b08e28e7cc7e1abd36ee3053b950f08dfd8

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
