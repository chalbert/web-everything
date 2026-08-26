---
bornAs: xmxjxjz
kind: story
size: 5
parent: "3029"
status: open
relatedTo: ["3094", "3151"]
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/engine.mjs", "we:scripts/operations/__tests__/engine.test.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/http-adapter.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:backlog/3282-the-verdict-write-up-renders-the-juror-s-findings-so-an-oper.md"]
dateOpened: "2026-08-25"
tags: [operations, epic-3029, review-pr, bug]
---

# the verdict write-up renders the juror's findings, so an operator override bounces a PR with no stated reason

`renderVerdictWriteUp` (`we:scripts/operations/review-pr.mjs:336`) hands `renderPanelComment` the JUROR's
verdict and findings, and puts the operator's answer only in a trailing `**Decision:**` line. When the
operator overrides `accept` to `changes`, the posted comment reads *"✅ pass — no blocking findings"*
above *"Decision: `changes`"*. Across #1556, #1560, #1562, #1563 and #1564, **17 of 23** write-ups render
that pair and **9 of the 17** also show *"Findings (0) — No findings"*: a bounce with no stated reason.
No channel carries the operator's reason at all — and, per *The reason has no channel* below, the one this
card first prescribed does not exist.

> **Count corrected.** This card was filed saying **16 of 22** write-ups and **9 of the 16**. That was the
> true count when it was filed and is now stale: one further write-up was posted to #1560 at
> `2026-08-26T01:27:47Z` (a `✅ pass` headline beside `Decision: changes`, juror findings non-empty), which
> moves the totals to 23 / 17 / 9. Re-derived in full by re-parsing every `## Human review verdict —`
> comment on the five PRs on 2026-08-26; the parse is reproduced under *The symptom on the real PRs*.
> **This number keeps moving** — every override posted from here adds one. Criterion 5 no longer pins it.

## What the code actually does — checked, not taken on report

The brief that prompted this card described the render mechanism correctly. Verified line by line:

- **`we:scripts/operations/review-pr.mjs:338-341`** — `renderVerdictWriteUp` passes
  `findings: verdict.findings`, `verdict: verdict.verdict` and `lensVerdicts: { [lens]: verdict.verdict }`
  into `renderPanelComment`. Every one of those three is the reduced JUROR result off the `reduce` step. The
  operator's answer reaches the body at exactly one place, **`:362`** —
  `` `**Decision:** \`${answer}\` — recorded by ${actor}.` ``
- **`we:scripts/lib/review-render.mjs:132-135`** turns that juror verdict into the comment's `**Verdict:**`
  headline, and **`:146-149`** renders `### Findings (0)` / `_No findings._` when the juror returned none. So
  on an override the headline and the findings section both describe the answer that was overruled.
- **`we:scripts/operations/review-pr.mjs:592`** is the only production call site: the `record` effect step
  builds the body with `answer` (the operator's) and `verdict` (the juror's) side by side and renders them at
  different weights. (Three further call sites are in `we:scripts/operations/__tests__/review-pr.test.mjs`; they are named in criterion 1.)

**And the reason cannot be supplied even if the render were fixed.** The `confirm` step declares
`options: [...CONFIRM_OPTIONS]` (**`:543`**, `CONFIRM_OPTIONS` = `['accept', 'changes', 'abstain']` at
**`:146`**). `confirm()` in `we:scripts/operations/step-kinds.mjs:149-174` seals only
`{kind, reads, asks, of, options}` — there is no free-text field — and `we:scripts/operations/engine.mjs:269-274`
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

## The reason has no channel — and a declared `input` is not one

**Retracted.** This card was filed with the following bullet under *Not in scope*:

> **Adding a fourth `confirm` option, or free text to the `confirm` step kind.** `we:scripts/operations/step-kinds.mjs`
> and `we:scripts/operations/engine.mjs` are deliberately outside `scope:`. The reason rides as a declared
> `input` on this operation — the pattern `aim` already establishes at **`:431`** (free text, no `enum`) and
> `actor` at **`:433`** — so the closed answer set and the engine's membership check are untouched.

**That was wrong, and it foreclosed the only workable channel.** A declared `input` is start-time only, so it
cannot carry a datum that does not exist until after the juror has answered.

**The adapter refuses it, in so many words.** `we:scripts/operations/cli-adapter.mjs:294-297`:

```js
// A resume carries no input — the run record already holds it. Passing both is a confusion worth refusing.
if (control.resume && Object.keys(raw).length) {
  errors.push('a --resume carries no input: the run record already holds it. Drop the input flags.');
}
```

Fired, not read:

```
$ node scripts/operations/run.mjs review-pr --resume=nonexistent-run --answer=changes --actor=someone
error: a --resume carries no input: the run record already holds it. Drop the input flags.
```

The operation's own `--help` states the same shape — the resume form takes no input flag at all:

```
usage: run.mjs review-pr --pr=<number> --repo=<string> [--lens=…] [--aim=<string>] [--actor=<string>…] …
       run.mjs review-pr --resume=<run-id> [--answer=<option>] [--json] [--cwd=<lane>] [--model=<alias>]
```

And the answer cannot arrive early either: `we:scripts/operations/cli-adapter.mjs:298-304` refuses `--answer` without `--resume`,
because *"the confirm step is a SUSPEND … there is no way to pre-answer it."*

**The cited precedent does not carry the property it was cited for.** `aim` and `actor` are both PRE-RUN
data. `aim` is labelled in source as a caller's hypothesis (`we:scripts/operations/review-pr.mjs:425-427`: *"IT IS A HYPOTHESIS,
NOT A VERDICT … an aim that tells a juror its conclusion buys a reviewer who confirms it either way"*). An
override reason is POST-JUROR data — a conclusion drawn from the juror's answer plus the operator's own read
of the subject. Citing a start-time field as the pattern for an answer-time one points at real lines whose
conclusion does not hold.

**What the retraction costs, stated rather than hidden.** Under the retracted scope the only way to attach a
reason would have been to abandon the suspended run and start a second one with the reason pre-committed —
paying a second juror spawn and leaving an orphan run record — or to keep hand-writing the second comment
this card exists to remove. That trade was never named on the card. Naming it is the point of this section.

**So the channel is the RESUME, and `scope:` is widened to it.** The three files the resume path crosses are
now in `scope:`:

- `we:scripts/operations/cli-adapter.mjs` — a control flag on the resume form (alongside `--answer`), NOT an
  input field. Input flags stay refused on a resume; the refusal above is correct and stays.
- `we:scripts/operations/engine.mjs` — the resume object already carries side-band data beyond `value`:
  `withTelemetry` (**`:300`**) reads `resume.telemetry` and is gated BY STEP KIND, explicitly refusing it on
  a `confirm` resume (**`:288`**). An operator reason is the mirror image — a `confirm`-only side-band datum
  — so the same kind-gated shape applies, and `withFinding` at **`:276`** (which records `resume.value` and
  nothing else) is where it has to land.
- `we:scripts/operations/http-adapter.mjs` — the HTTP spelling of the same resume (**`:206`**, route at
  **`:513-532`**) builds `{ step, value: body.value }` at **`:530`** and would otherwise be the one caller
  that still cannot state a reason.

The closed answer set is still untouched: `CONFIRM_OPTIONS` stays three strings and the membership check at
`we:scripts/operations/engine.mjs:269-274` stays exactly as it reads. What changes is that a resume may carry a reason ALONGSIDE
the answer, not that the answer itself becomes free text. `we:scripts/operations/step-kinds.mjs` stays out of
`scope:` on that basis — the reason is a property of the resume, gated by kind in the engine the way
`telemetry` already is, not a new field sealed into the `confirm()` declaration.

**Prevention.** The reviewer asked whether "an answer-time datum has no declared channel" needs its own item
under #3029. It does not: widening `scope:` to the resume path means THIS card builds that channel, and the
`telemetry` precedent shows the engine already has the shape for it. If a later implementer reverses this and
keeps the engine untouched, the gap returns and must be filed then.

## The symptom on the real PRs

Measured by parsing every `## Human review verdict —` comment on the five PRs on 2026-08-26: **23**
write-ups, **17** rendering a `✅ pass` headline beside `Decision: \`changes\``, **9** of those with
`Findings (0)` / `_No findings._`. The remaining 3 `changes` decisions are not `✅ pass` headlines, so 17 is
exactly the accept→changes override count.

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

That hand-written paragraph is the workaround this card exists to remove. **#1568 — this card's own PR — is
the second instance**: it was bounced with a `✅ pass` / `Findings (0)` write-up and a hand-written findings
comment beside it.

## Why it matters

An override is not the exceptional path. **17 of 23** measured write-ups are one, because the juror judges
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
- **Adding a fourth `confirm` option, or free text to the ANSWER.** `CONFIRM_OPTIONS` stays three strings and
  `we:scripts/operations/engine.mjs:269-274` keeps refusing anything outside them. The reason travels BESIDE the answer on the
  resume — see *The reason has no channel* for why a declared `input` cannot carry it and what that widened
  the scope to. `we:scripts/operations/step-kinds.mjs` stays outside `scope:` for the reason stated there.
- **Refusing an input flag on a resume.** `we:scripts/operations/cli-adapter.mjs:294-297` is right and stays. The reason is a
  CONTROL flag on the resume form, not run input.
- **Requiring a reason.** Making it mandatory would wedge an in-flight run whose caller has no flag for it.
  Absent, the write-up says the reason was not recorded; it does not refuse.
- **Backfilling the write-ups already posted.** They stand as the record of what happened.
- **The ledger's `verdict`/`findings` fields.** Named above so it is not rediscovered; changing the row shape
  touches #3007's shadow consumer and is its own item. (The reason reaching the ledger row is likewise that
  item's business, not this one's.)

## Done when

1. **Executable** — a test in `we:scripts/operations/__tests__/review-pr.test.mjs` renders
   `renderVerdictWriteUp` with `verdict.verdict === 'accept'`, `verdict.findings === []` and
   `answer === 'changes'`, and asserts the body does **not** contain `✅ pass — no blocking findings` and does
   **not** contain `_No findings._`. It fails on today's `main`: the local repro above prints both strings.
   All three existing `renderVerdictWriteUp` tests (`:721`, `:764`, `:778`) pass `answer: 'accept'`, so no
   current test covers the override render at all.
2. **Executable — the reason arrives WITH THE ANSWER, on the resume.** A `confirm` resume carrying both the
   answer and a reason drives the run to `record`, and the operator's text reaches the `review.write-up`
   effect's `payload.body` verbatim. Assert on the effect payload from `advance`, in the shape the `#3063`
   suite already uses at `:963` — which drives `resume: { value: 'changes' }` over a clean juror answer, i.e.
   an override run already exists in the suite and asserts only `findings.confirm`, never the body.
   **A start-time assertion does not satisfy this criterion**: `we:scripts/operations/cli-adapter.mjs:294-297` refuses input flags
   on a resume, so a test that supplies the reason at start-time would go green over a feature unusable in
   the flow *Why it matters* describes. Cover the CLI (`--resume` + the reason control flag) and the HTTP
   route (`POST …/advance` with the reason in the body) — both adapters, since both are in `scope:`.
3. **Executable** — a resume carrying **no** reason still renders, and the body says the reason was not
   recorded rather than showing the juror's verdict as the headline. Absence must not be silent. This is the
   path every already-scripted caller takes, so it is the compatibility criterion, not an edge case.
4. **Mutation** — reverting `renderVerdictWriteUp` to pass `verdict.verdict` / `verdict.findings` straight
   into `renderPanelComment` (i.e. restoring `:338-341` as they read today) must turn criterion 1 RED. If
   that revert leaves the suite green, the test is asserting the footer rather than the headline and does not
   hold the property. Second mutant: dropping the reason from the resume plumbing (engine or adapter) must
   turn criterion 2 RED — otherwise criterion 2 is asserting the render, not the channel.
5. **Observable** — after the change, re-running the parse over #1556, #1560, #1562, #1563 and #1564 reports
   the SAME historical count it reports the moment before the change lands (nothing is rewritten), while the
   same parse over any write-up posted by the new code reports zero `✅ pass` headlines beside
   `Decision: \`changes\``. **Measure the "before" figure at implementation time and do not compare against a
   number written on this card** — it grew from 16 to 17 between filing and first review, and grows with
   every override posted.
