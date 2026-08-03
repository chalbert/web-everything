---
bornAs: xy8e7h0
kind: task
relatedTo: ["2285"]
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
tags: []
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/__tests__/review-core-cli.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:skills-src/drain/SKILL.md
---

# Review mandates for couple PRs should carry the sibling repo/ref from the lane manifest

A fresh-context diff-only reviewer judging ONE half of a cross-repo couple false-positives on symbols the sibling PR adds: re-reviewing plateau#19 (impl half of the #2449 couple), the round-2 reviewer's only finding was that --under-lease does not exist in we:scripts/merge-ai-prs.mjs — it verified against WE main, where the couple's WE half (PR #441) had not landed. buildMandate()/buildPanelMandate() in we:scripts/lib/review-core.mjs take no couple context, yet the lane manifest already carries the couple's repos/refs. Fix: thread the manifest's sibling repo/ref list into the mandate text so reviewers judge cross-repo symbols against the couple, not each repo's main. Observed 2026-07-12 (dismissed-with-reason on plateau#19).

## Progress

**Delivered.** The mandate now carries the couple's sibling halves, following the
same purely-additive shape #2450 used for its `netChangedFiles` ground truth.

### The library seam

`we:scripts/lib/review-core.mjs` gains a private `coupleContextLines({ coupleRepos,
selfRepo })` helper, threaded through **both** builders the item names:

- `buildMandate({ …, coupleRepos, selfRepo })` appends the block as its **last**
  body line, so it can never split the #2336 no-checkout instruction it follows.
- `buildPanelMandate({ …, coupleRepos, selfRepo })` forwards both to `buildMandate`,
  so every lens reviewer in the v3 panel gets it.

`coupleRepos` takes the lane manifest's `repos` array verbatim — no caller-side
reshaping — and `selfRepo` is **filtered out**, so the block names only the halves
the reviewer cannot see. Naming the reviewer's own half as a "sibling" would be a
lie, and the filter lives inside the pure, tested function rather than at each call
site where it could be got wrong.

The block tells the reviewer that a symbol, flag, function, export, or file the diff
references may be **added by a sibling half** and therefore absent from this repo's
main, that it must verify against the named sibling ref before reporting it, and
that if it cannot inspect that ref it must mark the finding **uncertain** rather
than assert the reference is broken. That last clause matters: the failure mode is a
confident false negative, so the fallback has to be uncertainty, not silence.

### Additivity

Omitting the params — or passing `null`, `[]`, malformed entries, a non-array, or a
single-repo manifest that filters to empty — leaves the mandate **byte-for-byte**
unchanged. Most PRs are single-repo, so the common path is provably untouched.

### The call site

`we:skills-src/drain/SKILL.md` step 1 of the negotiation loop now takes `coupleRepos`
from the PR's lane manifest `repos` list — the manifest the ordering step already
reads off the head ref, so this costs no new fetch — and passes
`buildPanelMandate({ lens, netChangedFiles, coupleRepos, selfRepo })`.

### Oracles

Nine cases in `we:scripts/lib/__tests__/review-core.test.mjs` (suite: **226 passed**),
covering the sibling naming, the self-repo filter, the single-repo no-op, byte-for-byte
additivity across every malformed input, the ref-less half, the omitted-`selfRepo`
over-naming fallback, and an ordering assertion that the couple block follows — never
displaces — the #2336 no-checkout instruction.

### Deliberately NOT in this item

`we:scripts/review-core-cli.mjs`'s `buildMandateText()` calls `buildPanelMandate({ lens })`
with neither `netChangedFiles` **nor** the new couple params. That is a **pre-existing
shared gap** — #2450 did not thread its ground truth there either — so closing it for
one param and not the other would be incoherent. Captured as its own item rather than
grown into this one.
