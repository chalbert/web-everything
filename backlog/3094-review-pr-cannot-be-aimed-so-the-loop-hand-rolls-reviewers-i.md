---
bornAs: xf0ey61
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-13"
dateResolved: "2026-08-16"
graduatedTo: none
tags: [plateau-loop, operations, engine, review, delivery]
scope:
  - we:scripts/operations/review-pr.mjs
  - we:scripts/operations/__tests__/review-pr.test.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
---

# `review-pr` cannot be aimed, so the loop hand-rolls reviewers instead of using it

We have a declared review operation and the delivery loop does not use it. Over one session driving
[#3090], [#3091], [#3037] and [#3098] to merge, **every** review was a hand-written mandate passed to a
headless process, and none went through the declared operation. That is a smell about the operation, not
only about the driver: the loop routed around its own machinery because the machinery could not express the
thing that made those reviews work.

## What the operation does today, verified

`we:scripts/operations/run.mjs review-pr --pr=<n> --repo=<s> [--lens=…] [--actor=…]` — registered, runnable,
`read(compute) → judge(judge) → reduce(compute) → confirm(confirm) → record(effect)`. It is **not broken**.
It is under-powered for this loop in four specific ways.

**1. There is no way to aim it.** `buildPanelMandate` already takes a `goal`
(`we:scripts/lib/review-core.mjs:1022`) and the operation fills it with the PR title
(`we:scripts/operations/review-pr.mjs:389`). Nothing can pass *"this author's recurring defect is a statistic
computed over one population and applied to another's decision — hunt that first."*
`we:docs/agent/delivery-loop.md` calls that the single highest-yield line in a mandate, and this session is
the evidence: the [#3037] per-item dispatch lockout, [#3098]'s false all-clear on a third of the board,
and [#3090]'s four rounds of population defects were each found by a reviewer told what shape to look for.

**2. One juror, one lens.** `lens` takes a single value from `PANEL_LENSES`. [#3050] shipped the fan-out as
`we:scripts/lib/judge-panel.mjs` and it is **not wired in** — `we:scripts/operations/review-pr.mjs` says so in
its own comment, and notes the verdict write-up renders a one-row panel table on that basis.

**3. No mutation instruction.** Every finding that mattered this session arrived as *"I broke this line and no
named test reddened."* Nothing in the panel mandate asks a juror to do that, so the operation cannot produce
the class of finding the loop actually relies on.

**4. It stops at `confirm`.** Correct for the human ceremony it was built for, and it means the operation is
not a drop-in for an unattended bounce/accept loop. Not a defect — a scope boundary, recorded so nobody
"fixes" it by deleting the stop.

## Design (decided)

**Add a targeting input; do not build a second review path.** The `goal` slot exists and is already threaded
to the juror, so this is plumbing, not a redesign.

- a new optional input `aim` (string) on the declaration, passed into `buildPanelMandate` **alongside** the
  title rather than replacing it — the title is context, the aim is instruction, and a juror needs both;
- `buildPanelMandate` renders it under a heading marking it as the caller's HYPOTHESIS, not established
  fact, so a juror that finds the named defect absent says so instead of manufacturing it. A mandate that
  asserts the defect exists produces a reviewer who finds it whether or not it is there — the exact failure
  this repo has spent the week on.

**Fork RULED (2026-08-14).** Unconditional in `buildPanelMandate` — not gated behind a caller flag. Reasoning:
every mandate this session that actually found a real defect included the mutation instruction, unprompted by
the caller; making it opt-in relies on every future caller remembering to ask for the thing that has been the
single highest-yield instruction all session. The `simplicity` concern is real but narrower than it first
looks — `we:scripts/lib/jury-ledger.mjs:157` confirms `simplicity` IS a live `PANEL_LENSES` entry, so this
isn't hypothetical. Resolved by PHRASING, not by gating: the instruction reads as *"if you find a
correctness-affecting or behavior-changing defect, state whether breaking the guarded line makes a named test
redden — this does not apply to pure style/simplicity findings that change no behavior."* A simplicity-lens
juror reads that sentence and it is naturally inapplicable to what it's judging, rather than the operation
gating the instruction on a lens-type branch. Cheaper than a conditional, and it means a caller cannot
accidentally omit the one instruction that has produced every real finding this session by forgetting to set
a flag.

Wiring [#3050]'s panel is deliberately **out of scope** — its own change with its own budget question, and
bundling it is how a 3 becomes a 13.

## Interface and protocol

```js
// we:scripts/lib/review-core.mjs
buildPanelMandate({ lens, contextIsolation, netChangedFiles, goal, round, aim })
//   aim?: string — the caller's hypothesis about what to hunt. Rendered under an explicit
//   "STATED BY THE CALLER, NOT ESTABLISHED" heading. Absent/blank ⇒ byte-identical output to today.
```

```
# we:scripts/operations/review-pr.mjs — input schema
aim: { type: 'string', required: false }     # surfaces as --aim=<string> in the derived --help
```

The empty case must be **byte-identical** to today's mandate: every existing caller passes no `aim`, and a
whitespace diff in the mandate changes what every juror sees.

## Done when

- [x] `buildPanelMandate({ …, aim })` renders the aim under a heading marking it the caller's hypothesis, and
      a test asserts the juror is told it may find the named defect ABSENT.
- [x] Omitting `aim` produces output byte-identical to the current mandate — asserted against a fixture, not
      by inspection (`we:scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt`, the exact
      pre-#3094 bytes; the ONLY permitted delta is the ruled mutation probe, appended verbatim).
- [x] `--aim=<string>` appears in the derived `--help` and reaches the judge request, proven by driving a run
      with a stub judge and asserting on the request the step declares.
- [x] The mutation-instruction fork is RULED on this card before any code lands — ruled unconditional,
      phrased to be a natural no-op for non-behavior-changing findings.
- [x] One real review of a real PR is driven through the operation with `--aim` and its verdict recorded —
      see the live proof below. HALF-DONE, stated honestly: the verdict was recorded HERE and not ON the PR,
      for the reason given.

## Live proof (2026-08-14) — run `review-pr-8c65ff09-cb23-497c-b41c-fa6900045c3c`

One REAL review, driven through the operation, with a real `gh` read and a real spawned juror — no stub
anywhere:

```
JUDGE_LANE_CWD=<a lane of the juror's own> node scripts/operations/run.mjs review-pr \
  --pr=1263 --repo=chalbert/web-everything --actor=build-3094-proof \
  --aim="This repo's recurring defect is a signal computed over ONE population and applied to ANOTHER's
         decision. Here the completion signal is a PR discovered by item-id lookup over head refs, while the
         thing resolved is ONE dispatch entry. Hunt first for a PR that does not belong to THIS dispatch …"
```

**Verdict: `accept`** (`loop: converged`, round 1/5), one finding, `disposition: carve-out`,
`impactIfUnfixed: degraded`. Cost `$1.2871`, 295.3s, one `correctness` juror.

THE AIM WORKED, AND SO DID THE MUTATION PROBE — which is the whole claim this card had to prove:

- the juror did not merely echo the aim back. It reported the SYMMETRIC form of the named class it actually
  found: `classifyDispatchPr` compares a merged PR's `mergedAt` only against its own entry's `startedAt`, so a
  later retry's merged PR can resolve a DEAD EARLIER entry for the same item as `succeeded`. The aim named the
  predecessor→retry direction; the juror found the retry→predecessor one and said so.
- it answered the mutation instruction unprompted, in the finding's own words: *"no named test in this diff
  constructs two entries with different `startedAt` values for the same item … so no test reddens for this
  scenario."* That sentence is the class of finding the loop has been relying on, produced by the declared
  operation instead of by a hand-rolled mandate.

**Why the verdict was NOT recorded on #1263.** The `confirm` step was answered `abstain` — 0 effects, nothing
posted, no label touched. Between the run starting and its verdict landing, a sibling reviewer accepted that PR
(`review:accepted` + `ready-to-merge`), so recording would have written a second verdict comment onto a PR
already cleared and mid-land. A proof-of-concept run must not race another agent's review; the non-mutating
exit exists for exactly this, and the verdict is recorded here instead. The finding above is a live carve-out
against #3095 and is owed a filing by whoever picks that thread up.

## Tasks

1. ~~Rule the mutation-instruction fork.~~ Done above.
2. `aim` through `buildPanelMandate`, plus the byte-identical-when-absent fixture test, plus the unconditional
   mutation-instruction sentence.
3. `aim` as a declared input on the operation; assert it reaches the judge request.
4. ~~Drive one real review through the operation and record the verdict.~~ Done — see "Live proof" above.

## Delivery shape

Lands incrementally behind `main`. Every step is additive and the absent-`aim` path is unchanged, so no
caller breaks at any point and no branch is needed.

## Watch for

- **`aim` must not become a way to tell the juror its conclusion.** The value is in naming the search, not
  the answer. The "may find it absent" test is the guard on that and is not optional.
- The operation **works**. This card is about reach, and must not turn into a rewrite.

## Verified & resolved 2026-08-16 — shipped via merged PR #1266, status was stale

Re-verified against the live tree before resolving (a queue-generation scan flagged this card's `status: open`
as lagging reality; checked independently rather than trusted). The card's own body already carries every
Done-when box checked and a "Live proof" section — this closes the bookkeeping to match:

- **PR [#1266](../../pull/1266)** ("#3094 review-pr can be aimed: --aim, and the mutation probe every
  mandate now carries", head `lane/build-3094`) is `state: MERGED`, merge commit `827cb396`, which is an
  ancestor of `origin/main` HEAD.
- [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) — `buildPanelMandate` takes the optional
  `aim` param (`:1046`), renders it under the caller's-hypothesis heading with the unconditional mutation
  instruction (`:1076-1086`).
- [we:scripts/operations/review-pr.mjs](../scripts/operations/review-pr.mjs) declares `aim` as an optional
  string input (`:373`) and threads it into the mandate build (`:400-411`).
- The byte-identical-when-absent fixture
  [we:scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt](../scripts/lib/__tests__/fixtures/panel-mandate.correctness.pre-3094.txt)
  exists.
- [we:scripts/lib/__tests__/review-core.test.mjs](../scripts/lib/__tests__/review-core.test.mjs) (287 tests)
  and [we:scripts/operations/__tests__/review-pr.test.mjs](../scripts/operations/__tests__/review-pr.test.mjs)
  (50 tests) — 337 tests total, all green (`npx vitest run`).
- `npm run check:standards` — 0 errors on the current tree.

All Done-when items are satisfied by code already on `main`; nothing further to build.
