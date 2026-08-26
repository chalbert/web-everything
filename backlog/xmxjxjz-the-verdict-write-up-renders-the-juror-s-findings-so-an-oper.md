---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3094", "3151"]
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:backlog/xmxjxjz-the-verdict-write-up-renders-the-juror-s-findings-so-an-oper.md"]
dateOpened: "2026-08-25"
tags: [operations, epic-3029, review-pr, bug]
---

# the verdict write-up renders the juror's findings, so an operator override bounces a PR with no stated reason

`renderVerdictWriteUp` (`we:scripts/operations/review-pr.mjs:336`) hands `renderPanelComment` the JUROR's
verdict and findings, and puts the operator's answer only in a trailing `**Decision:**` line. When the
operator overrides `accept` to `changes`, the posted comment reads *"✅ pass — no blocking findings"*
above *"Decision: `changes`"*. Across #1556, #1560, #1562, #1563 and #1564, **16 of 22** write-ups render
that pair and **9 of the 16** also show *"Findings (0) — No findings"*: a bounce with no stated reason.
No input carries the operator's reason at all.

## What the code actually does — checked, not taken on report

The brief that prompted this card described the mechanism correctly. Verified line by line:

- **`we:scripts/operations/review-pr.mjs:338-341`** — `renderVerdictWriteUp` passes
  `findings: verdict.findings`, `verdict: verdict.verdict` and `lensVerdicts: { [lens]: verdict.verdict }`
  into `renderPanelComment`. Every one of those three is the reduced JUROR result off the `reduce` step. The
  operator's answer reaches the body at exactly one place, **`:362`** —
  `` `**Decision:** \`${answer}\` — recorded by ${actor}.` ``
- **`we:scripts/lib/review-render.mjs:132-135`** turns that juror verdict into the comment's `**Verdict:**`
  headline, and **`:146-149`** renders `### Findings (0)` / `_No findings._` when the juror returned none. So
  on an override the headline and the findings section both describe the answer that was overruled.
- **`we:scripts/operations/review-pr.mjs:592`** is the only call site: the `record` effect step builds the
  body with `answer` (the operator's) and `verdict` (the juror's) side by side and renders them at different
  weights.

**And the reason cannot be supplied even if the render were fixed.** The `confirm` step declares
`options: [...CONFIRM_OPTIONS]` (**`:543`**, `CONFIRM_OPTIONS` = `['accept', 'changes', 'abstain']` at
**`:146`**). `confirm()` in `we:scripts/operations/step-kinds.mjs:149-174` seals only
`{kind, reads, asks, of, options}` — there is no free-text field — and `we:scripts/operations/engine.mjs:269`
refuses any `resume.value` outside the declared options. The answer that reaches `record` at **`:560`** is
therefore one of three bare strings. **This, not the render, is the load-bearing half.**

**The split reaches the ledger too.** The `verdict-ledger.append` effect (**`:648-662`**) records
`verdict: verdict.verdict` and `findings: verdict.findings` — the juror's — beside `to` (the operator's
decision). The operator's decision is not lost there, but its basis is absent from the merge authority for
the same reason it is absent from the comment.

### Reproduced locally, deterministically

```
node -e "import('./scripts/operations/review-pr.mjs').then(({renderVerdictWriteUp:r})=>console.log(r({
  read:{repo:'o/n',pr:1564,labels:[],disposition:null,degraded:false,
        netBasis:{base:'aaa',rev:'bbb',revRef:'origin/lane/x'},netChangedFiles:['a.md']},
  verdict:{verdict:'accept',findings:[],lens:'correctness'},
  answer:'changes',actor:'operator',lens:'correctness'})))"
```

prints `**Verdict:** ✅ pass — no blocking findings`, then `### Findings (0)` / `_No findings._`, then
`**Decision:** \`changes\` — recorded by operator.` No juror, no network, no PR needed.

## The symptom on the real PRs

Measured by parsing every `## Human review verdict —` comment on the five PRs: **22** write-ups,
**16** rendering a `✅ pass` headline beside `Decision: \`changes\``, **9** of those with `Findings (0)`.

The clearest instance is **#1564**, where the reviewer said so in the PR itself. The operation's own comment
reads:

> **Verdict:** ✅ pass — no blocking findings
> … **Findings (0)** … _No findings._
> **Decision:** `changes` — recorded by operator.

and a **second, separate** comment — *"## Independent review findings — #1564 (round 1)"* — carries the two
real findings, opening:

> The `correctness` juror returned **0 findings** and `deriveVerdict` reduced to `accept`. The operator
> verdict **overrides that to `changes`** on two findings the juror did not raise. The verdict write-up
> posted above renders the JUROR's findings, so it shows "no blocking findings" beside `Decision: changes` —
> the reasons are here, not there.

That hand-written paragraph is the workaround this card exists to remove.

## Why it matters

An override is not the exceptional path. **16 of 22** measured write-ups are one, because the juror judges
the diff and a prepare PR most often fails on its *description* — a card whose stated grep baseline is
false, whose scope omits a file its own criteria name. The juror reads the diff and accepts; the operator
reads the claim against the repo and bounces.

So the operation's normal output on its most common outcome is a comment that **contradicts itself and
instructs nobody.** The author lane reads `review:changes`, opens the only comment, and finds a pass. It
either guesses, or waits for a human to write the second comment by hand. That second comment is outside
the run record: it is not in the ledger, not in the `reviewed-*` markers, and not replayable — every
durability property `record` was built for is bypassed the moment the reason lives there.

There is also a quieter cost: a reader skimming a bounced PR sees a green headline and can reasonably
conclude the bounce was a mistake.

## Not in scope

- **The multi-lens panel.** `we:scripts/lib/judge-panel.mjs` (#3050) is built and still not wired in; the
  one-row table stays a one-row table here. The single-lens prose at `:363-366` is correct and stays.
- **Changing what the juror is asked, or `deriveVerdict`.** The juror's verdict is not wrong — it answered
  the question it was given. Nothing about `reduce` or the mandate changes.
- **Adding a fourth `confirm` option, or free text to the `confirm` step kind.** `we:scripts/operations/step-kinds.mjs`
  and `we:scripts/operations/engine.mjs` are deliberately outside `scope:`. The reason rides as a declared
  `input` on this operation — the pattern `aim` already establishes at **`:431`** (free text, no `enum`) and
  `actor` at **`:433`** — so the closed answer set and the engine's membership check are untouched.
- **Requiring a reason.** Making it mandatory would wedge an in-flight run whose caller has no flag for it.
  Absent, the write-up says the reason was not recorded; it does not refuse.
- **Backfilling the 16 comments already posted.** They stand as the record of what happened.
- **The ledger's `verdict`/`findings` fields.** Named above so it is not rediscovered; changing the row shape
  touches #3007's shadow consumer and is its own item.

## Done when

1. **Executable** — a test in `we:scripts/operations/__tests__/review-pr.test.mjs` renders
   `renderVerdictWriteUp` with `verdict.verdict === 'accept'`, `verdict.findings === []` and
   `answer === 'changes'`, and asserts the body does **not** contain `✅ pass — no blocking findings` and does
   **not** contain `_No findings._`. It fails on today's `main`: the local repro above prints both strings.
   All three existing `renderVerdictWriteUp` tests (`:721`, `:764`, `:778`) pass `answer: 'accept'`, so no
   current test covers the override render at all.
2. **Executable** — `review-pr --help` lists the new reason input, and a run started with it carries the
   operator's text verbatim into the `review.write-up` effect's `payload.body`. Assert on the effect payload
   from `advance`, in the shape the `#3063` suite already uses at `:963` — which drives
   `resume: { value: 'changes' }` over a clean juror answer, i.e. an override run already exists in the
   suite and asserts only `findings.confirm`, never the body.
3. **Executable** — a run recorded with **no** reason still renders, and the body says the reason was not
   recorded rather than showing the juror's verdict as the headline. Absence must not be silent.
4. **Mutation** — reverting `renderVerdictWriteUp` to pass `verdict.verdict` / `verdict.findings` straight
   into `renderPanelComment` (i.e. restoring `:338-341` as they read today) must turn criterion 1 RED. If
   that revert leaves the suite green, the test is asserting the footer rather than the headline and does not
   hold the property.
5. **Observable** — after the change, re-running the parse over #1556, #1560, #1562, #1563 and #1564 still
   reports 16 historical instances (nothing is rewritten), while the same parse over any write-up posted by
   the new code reports zero `✅ pass` headlines beside `Decision: \`changes\``.
