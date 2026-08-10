---
bornAs: xw3l8bh
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-10"
relatedTo: ["3057", "3050", "3051"]
scope:
  - "we:skills-src/jury/panel-fanout.mjs"
  - "we:skills-src/jury/subject-jury.workflow.js"
tags: [plateau-loop, jury, judge, panel, prompt, measurement, capture-only]
---

# Re-run the #3057 equivalence at production juror settings, and A/B the mandate Return-line

The [#3057](/backlog/3057-migrate-the-subject-jury-fan-out-off-subagents-onto-judgepan/) migration compared the
old subagent fan-out against the new `judgePanel` fan-out, got two different panel verdicts — `changes` before,
`prevention-outstanding` after — and attributed the gap to model variance on one boolean (`parallelizable`) from
one seat. Two things undermine that attribution: **neither leg ran at the model/effort that actually ships**, and
**the two juror Return-lines are not byte-identical, and the difference lands on exactly the fields that flipped**.
This card is **capture only**. It names both, states the run that would discriminate each, and leaves open the
design question the second one raises.

## Problem A — the comparison never touched production settings

**Measured (both legs, from #3057's own write-up).** The "after" leg is recorded: *"Three live panels at 4
headless `haiku`/low jurors each"*. The "before" leg's model is recorded **nowhere** — the card records the four
subagents' session ids, never their model.

**What ships is not that.** The harness's dial is
[we:skills-src/jury/subject-jury.workflow.js](../skills-src/jury/subject-jury.workflow.js) lines 152–153:

```js
const PANEL_JUROR_MODEL = 'sonnet';        // judge-spawn's DEFAULT_MODEL — the cheap middle a juror earns.
const PANEL_JUROR_EFFORT = 'medium';       // judge-spawn's DEFAULT_EFFORT.
```

mirroring `DEFAULT_MODEL = 'sonnet'` / `DEFAULT_EFFORT = 'medium'` in
[we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs). Those two constants are deliberately **not**
launch-overridable (the dial block above them states why: they reach a child's argv, so the harness opens no route
from a launch config to them). A run at `haiku`/low therefore cannot have come through the harness at all — it can
only have come from a hand-built payload handed straight to
[we:skills-src/jury/panel-fanout.mjs](../skills-src/jury/panel-fanout.mjs), which reads `model` / `effort` /
`budget` off the payload and forwards them to `judgePanel`.

**And the old leg's model is a free variable, not a matched one.** The pre-migration fan-out called
`agent(jurorPrompt(…), { label, phase, schema })` — **no `model`, no `effort`**. An `agent()` with no model
inherits the launching session's (the same contract the parallel-batch workflow documents as *"Omit → all agents
inherit the session model"*). So the before-leg ran at whatever the operator's session happened to be, and that
value was never written down.

**Consequence for the conclusion.** "A second live sample of the migrated path reproduced `parallelizable: true` on
all four seats, so the outlier is the *old* leg's single subagent" is two samples **of the same model** agreeing
with each other. It bounds within-`haiku`/low variance and nothing else. It does not compare the two legs at a
common model, and it never touches the settings the shipped jury runs at.

**The discriminating run.** Re-run the same subject (the 10-line added-file off-by-one) with the model held fixed
at `sonnet`/`medium` on both sides, and **record the model of every leg**. If the pre-migration harness is no
longer runnable, the honest substitute is to take N samples of the *new* leg at `sonnet`/`medium` and report the
`parallelizable` distribution — a variance measurement at production settings is worth more than a two-sample
equality claim at settings nothing runs at.

## Problem B — the Return-lines differ, on exactly the fields that flipped

**The delta is real.** The pre-migration `jurorPrompt` asked for:

> `Return { lens: "<lens>", findings: [{ summary, file?, failure_scenario?, category?, line?, impactIfUnfixed, rootCause, prevention, preventionCaptured }] }. For EACH finding include impactIfUnfixed (…) + rootCause + prevention + preventionCaptured.`

The three direction booleans appear **nowhere** in it. `jurorMandate` in
[we:skills-src/jury/panel-fanout.mjs](../skills-src/jury/panel-fanout.mjs) now asks for:

> `Return { lens: "<lens>", findings: [{ …, introduced, worseThanBase, parallelizable }] }. … AND the three direction booleans your mandate asks for — introduced, worseThanBase, parallelizable. **Omitting any of the three leaves the finding BLOCKING; they are the only way to route one to a carve-out.**`

`deriveFindingDisposition` in [we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs) routes
`introduced && worseThanBase && !parallelizable → blocker`, everything else → `carve-out`. So the prompt delta and
the divergence sit on the same three fields. That is a plausible causal chain that is **not** model variance, and
one sample of each leg cannot separate the two.

**But the sharper version of this — "the juror is NOW told what its answer will cause" — is not what the code
says, and the correction changes what the A/B tests.** The shared adapter mandate `buildSubjectMandate` lives in
[we:scripts/lib/jury-core.mjs](../scripts/lib/jury-core.mjs), which #3057 left **byte-unchanged** (pinned by a
test), and **both** legs pass the adapter's mandate to the juror verbatim. That pre-existing mandate already spells
out the full routing rule, more completely than the new Return-line does:

> `Exactly one combination earns a round (\`blocker\`): introduced AND worse-than-base AND NOT parallelizable. Everything else routes to \`carve-out\` …`
>
> `THE THREE ANSWERS ARE THE ONLY WAY TO UN-BLOCK A FINDING. Omitting any of them leaves it BLOCKING …`

So the routing consequence was disclosed to **both** legs' jurors, in the same words. What the migration changed is
narrower: the three fields moved from *absent in the concrete key list* to *present in it, with the omission
consequence restated adjacent to the shape the juror must fill*. The A/B is therefore not "does disclosing routing
lead the juror" — it is **"does restating the routing consequence in the key list, next to the schema, change the
answer, when the mandate already said it?"** That is a smaller and more tractable question, and it is testable.

## The design question this raises — stated, deliberately not answered

Independently of whether it caused this flip: **should a judge's mandate state the routing consequence of its
answers at all?** There is a real tension and this card does not resolve it.

- **Against:** a judge that knows which answer produces which verdict can reason backwards from the outcome it
  wants. `parallelizable` is a genuinely debatable call; a juror told that `true` is the route to a carve-out and
  omission is the route to blocking has been handed the lever, not just the definition.
- **For:** the disclosure is load-bearing and was put there on purpose. The migration's own first live panel had
  **all four seats drop the triple entirely**, which fails closed — every finding blocking, i.e. a jury strictly
  stricter than the one it replaced, unable to route anything to a carve-out. Removing the disclosure may buy a
  less leading prompt at the price of a silently stricter jury.
- The distinction worth testing is **what a field means** (necessary) versus **what a field does** (the leading
  part) — and whether they can actually be separated in prose a juror will follow.

**The A/B.** Hold model and effort fixed at `sonnet`/`medium`, hold the subject fixed, and run N samples of two
arms: with and without the routing sentence. Score **two** things, because the sentence does two jobs — the
`parallelizable` answer distribution (is it leading?) and the **omission rate** of the triple (is it necessary?).
An arm that is less leading but drops the triple more often has not won.

## Cost

Small. The migration's entire live measurement was **$0.320542** — three 4-seat panels at `haiku`/low, ~$0.10 each,
36–39 s wall. `sonnet`/`medium` will bill more per panel, so the honest expectation is single-digit dollars for a
handful of arms, not the ~$0.10/panel figure. The order of magnitude is dollars.

## Where this sits

- [#3050](/backlog/3050-judge-panel-fan-judgespawn-out-to-n-distinct-jurors-awaited-/) (resolved) is the panel
  primitive the arms would run on.
- [#3057](/backlog/3057-migrate-the-subject-jury-fan-out-off-subagents-onto-judgepan/) (resolved) is the migration
  whose equivalence claim this re-tests. Nothing here says the migration was wrong — the mechanism evidence
  (identical roster, identical seats, identical reduction under identical inputs, four distinct session ids) stands
  on its own. What is unsupported is specifically the *attribution of the verdict gap to model variance*.
- [#3051](/backlog/3051-benchmark-which-reviewer-prompt-formulation-actually-finds-t/) (parked,
  `parkedReason: maturityGated`) is the general programme: measure which reviewer-prompt formulations actually find
  the most defects. **This is a concrete first case for it** — one subject, one field, two arms — and it is far
  smaller than the full benchmark. Worth noting while here: #3051's `maturityTrigger` reads *"judgePanel (#3050) has
  landed"*, and #3050 is now resolved, so that park gate has cleared.
