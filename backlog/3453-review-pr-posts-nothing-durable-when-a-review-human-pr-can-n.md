---
bornAs: xlw02hw
kind: story
size: 5
parent: "3383"
status: resolved
dateOpened: "2026-09-02"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
graduatedTo: none
tags: []
---

# review-pr posts nothing durable when a review:human PR can never reach a real confirm answer

Root-caused live 2026-09-01/02 on PRs #1814/#1815: node we:scripts/operations/run.mjs review-pr judges a PR then suspends at confirm; only record ever posts anything, and only once confirm has a real answer. On a review:human PR no advisory-only session has one to give -- accept is refused, changes would fake the human bounce, abstain posts nothing. Real findings, nothing written; both sessions had to gh pr comment by hand.

**Root cause detail.** `--answer=accept` is refused in `decideSetLabel`'s pure core (INVARIANT 2, correct and untouched); `--answer=changes` would apply the real human-ceremony label swap with no human behind it, which an advisory-only pass has no authority to do; and `--answer=abstain` -- the only semantically-honest answer an advisory pass could give -- makes `record`'s `effects` fn return `[]`. So `judge`+`reduce` alone leave the PR with real findings computed and nothing durable written anywhere, and no legitimate path through `confirm`/`record` changes that for this PR type.

## Not the same as #2326 or #3270

- `#2326` (resolved 2026-07-08) gave the DRAIN's own inline auto-review an advisory take on `review:human` — but
  that predates the declared-operation engine (`#3035`/#3319 landed weeks later) and its comment path is the
  drain's own hand-rolled one, not `we:scripts/operations/review-pr.mjs`'s `record` step. It does not touch the
  gap here at all.
- `#3270` states the ESCALATING session's obligation (the drain, right before it applies `review:human`) to run
  the advisory review, fix, and suggest a verdict. This item is about a DIFFERENT session — one running
  `review-pr` independently, later, against a PR that already carries `review:human` — for which the operation
  itself has no route to ever post anything, no matter how disciplined the caller is. #3270's obligation cannot
  be met by a caller alone when the tool it obligates them to run has no reachable "post" state.

## Done when

1. **Executable** — a test drives `reviewPrOperation` (stub reader, `labels: ['review:human']`) through
   `judge`+`judgeSecurity`+`reduce` with NO `confirm` answer ever supplied (mirroring a session that never
   resumes because it has no legitimate answer), and asserts a durable comment-post effect was declared and
   applied — clearly marked advisory/informational, with NO label-swap effect alongside it. The same test
   fixture with `labels: ['review:pending']` (today's normal path) asserts BYTE-IDENTICAL behavior to before
   this item — zero effects until `confirm` is answered — proving the fix is additive, not a change to the
   ordinary path.
2. The advisory comment's rendering is unit-tested against the real `record`-step comment's rendering and
   proven textually distinct: no `**Decision:**` line, no `review:accepted`/`review:changes` language framed as
   applied, and an explicit "advisory only, not a recorded verdict — the human ceremony is still required"
   sentence.
3. `npm run check:standards` and the full `we:scripts/operations/__tests__/review-pr.test.mjs` suite (plus any
   touched io/render test files) stay green.

## Resolution (2026-09-02)

Added a new declared `advise` step (`we:scripts/operations/review-pr.mjs`, an `effect` step) between `reduce`
and `confirm` — it runs UNCONDITIONALLY as soon as `reduce` has a verdict, no `--resume`/answer of any kind
required. On a `review:human` PR it declares one `review.advisory-note` effect, rendered by the new
`renderAdvisoryNote` (textually distinct from `renderVerdictWriteUp`: no `**Decision:**` line, no label
payload, an explicit "advisory only, not a recorded verdict" statement top and bottom) and posted through a
bare `gh pr comment` (`we:scripts/lib/review-label-provider.mjs#createGhProvider`'s `postComment`, reused
rather than re-implemented; never `we:scripts/review-set-label.mjs`, which always couples a comment with a
label swap). On every other PR (`review:pending`) it declares `[]`, which resolves inline with no suspend at
all — that path is byte-identical to before this item.

Tests: three new operation-level tests proving the note posts with no `confirm` answer ever supplied and that
`review:pending` is unaffected, plus a direct textual-distinctness test against `renderVerdictWriteUp`'s
output; a new io-sink test for the injectable `postComment`. Updated 9 pre-existing tests whose fixed step
indices/counts shifted by the new step (cursor numbers, effect keys, the derived `--help` step list, sink
maps needing the new effect type registered) — all mechanical, none changing what they assert.

Landed via `we:scripts/operations/review-pr.mjs`, `we:scripts/operations/review-pr-io.mjs`,
`we:scripts/operations/__tests__/{review-pr,review-pr-io,http-adapter}.test.mjs`,
`we:skills-src/review/SKILL.md`.
