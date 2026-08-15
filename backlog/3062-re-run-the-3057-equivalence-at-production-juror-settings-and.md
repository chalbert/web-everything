---
bornAs: xw3l8bh
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-10"
relatedTo: ["3057", "3050", "3051"]
scope:
  - "we:skills-src/jury/measure-panel-arms.mjs"
  - "we:skills-src/jury/panel-fanout.mjs"
  - "we:scripts/lib/judge-panel.mjs"
scopeRationale: "The measurement is a new sibling script next to we:skills-src/jury/panel-fanout.mjs, importing panelJurors/panelFanout/jurorMandate/JUROR_SHAPE from that shim (read-only — production mandate text is not edited, see 'Decided design') and judgePanel directly from we:scripts/lib/judge-panel.mjs for the stripped-mandate arm. we:skills-src/jury/subject-jury.workflow.js is NOT touched: the measurement bypasses the harness entirely and calls the shim's own exports the same way #3057's own equivalence run did (a hand-built payload, not a harness invocation)."
tags: [plateau-loop, jury, judge, panel, prompt, measurement, capture-only]
---

# Re-run the #3057 equivalence at production juror settings, and A/B the mandate Return-line

**Size 3, basis stated.** One new sibling script that reuses `panelJurors` / `panelFanout` / `jurorMandate` /
`JUROR_SHAPE` verbatim from we:skills-src/jury/panel-fanout.mjs and `judgePanel` directly from
we:scripts/lib/judge-panel.mjs — no new production code path, no existing file edited. ~10 live panels at
`sonnet`/`medium` (single-digit dollars, per "Cost" below) plus a results section appended to this card at
resolution, the same shape #3057's own equivalence run used. Comparable in effort to that prior measurement
minus the migration it was measuring.

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

## Decided design — how to run this measurement

**One script, two arms, both problems answered from the same live runs.** The "with-sentence" arm IS the
production mandate at production settings, so it simultaneously answers Problem A (the production-settings
distribution) and serves as Problem B's baseline arm — there is no need for three separate measurement sets.

### The fixed subject

The exact bytes of #3057's "10-line added-file diff with one off-by-one" were never checked in (grepped for
`i === attempts` repo-wide and in git history for a payload/fixture file — nothing found; the only surviving
record is the prose in backlog/3057-*.md). Reconstruct a materially equivalent subject — a small added file
implementing a bounded retry with an off-by-one that silently swallows the final failure (e.g. `if (i ===
attempts) throw e` inside a `for (i = 0; i < attempts; i++)` loop) — and embed it as a literal constant in the
new script, the same pattern we:scripts/measure-judge-spawn.mjs already uses for its fixed `MANDATE`/`INPUT`
stimulus (a checked-in constant beats an ephemeral fixture: the script's own source is the record of what was
measured, at the commit that measured it). It does not need to be byte-identical to the original — it needs to
be held fixed **across both arms and across repeats**, which a literal constant guarantees.

### Reproducing the #3057 roster — verified, not assumed

`panelRigorForCareLevel('low')` (we:scripts/lib/jury-core.mjs:712-719) returns `{ lenses: PANEL_LENSES,
jurorsPerLens: 1 }` **unconditionally** — `PANEL_LENSES` (we:scripts/lib/jury-core.mjs:682) is `[correctness,
security, simplicity, standards-conformance]` (mandatory-then-advisory) for every care-`low` roster regardless of
which files are named in `--input`; `classifyTouchSet` (we:scripts/lib/review-core.mjs:902-912) only ever *adds*
a11y/visual/perf seats for UI/page paths, it never removes one of the four. So resolving the roster (the shim
`we:skills-src/jury/resolve-roster.mjs`, `--subject=pr-diff --care-level=low`, any plain non-UI/non-page changed
file path as `--input`) reproduces #3057's exact 4-seat roster — `correctness#1, security#1, simplicity#1,
standards-conformance#1` — with no guesswork. Confirmed by reading the dial directly, not by re-running it.

**The roster is embedded, not re-resolved at measurement time — decided, not left open.** The resolve-roster
shim exports nothing (we:skills-src/jury/resolve-roster.mjs has zero `export` statements; it is CLI-only), so
a script that imports production code cannot call it in-process, and shelling it as a subprocess at measurement
time would (a) need real subprocess-invocation code the interface sketch below does not show and (b) make the
resolve-roster shim a genuine runtime consumer that `scope:` would then have to name (checklist item 1). Avoid
both: run the resolve-roster shim **once, by hand, while writing the script** (Task 1 below), and paste its
`jurors` array into the script as a literal `ROSTER` constant, next to `SUBJECT_DIFF` — the same "checked-in
constant beats an ephemeral re-resolve" treatment already used for the fixed subject, for the same reason
(the roster must be held fixed across both arms and every repeat, and a literal is the only way that is
guaranteed rather than assumed).

### The two arms

- **Arm `with-sentence` (= production, unmodified).** Resolve the roster via the shim above, then call the
  panel-fanout shim's own `panelFanout({ payload: { subject, subjectNoun, jurors: roster.jurors, material:
  SUBJECT, model: 'sonnet', effort: 'medium', budget: 0.5 }, runId, depth: 0, maxDepth: 2, maxTotalBudgetUsd: 8
  })` **directly, byte-for-byte the production path** — `panelFanout` internally calls the unmodified
  `panelJurors` and `jurorMandate`, so this arm cannot drift from what ships. `depth`/`maxDepth`/
  `maxTotalBudgetUsd` mirror the harness's own constants (we:skills-src/jury/subject-jury.workflow.js:154-157).
- **Arm `without-sentence` (the manipulated arm).** Build the same seats via the panel-fanout shim's exported
  `panelJurors` (identical production seat/mandate construction — no duplicated prompt logic), then strip
  exactly the omission sentence from each seat's `.mandate` before handing the seats to `judgePanel` directly
  (imported from we:scripts/lib/judge-panel.mjs, since `panelFanout` offers no post-processing hook). Verified
  live during preparation (no billed call — pure string ops on the real `jurorMandate` output):
  `SENTENCE = 'Omitting any of the three leaves the finding BLOCKING; they are the only way\nto route one to a
  carve-out.'` is present verbatim in the real output and `mandate.replace(SENTENCE, '')` leaves clean,
  grammatical prose behind ("...worseThanBase, parallelizable. Return an EMPTY findings array..."). This is the
  exact text at we:skills-src/jury/panel-fanout.mjs:195-196. **Fail loud on drift**: if a seat's mandate does not
  contain `SENTENCE`, throw immediately naming the file:line to re-check — a silent no-op strip would make Arm B
  identical to Arm A and the whole A/B meaningless without anyone noticing.
- **What stays identical across both arms:** the roster, the fixed subject, the shim's `JUROR_SHAPE`
  (unmodified — the schema's `required: ['summary']` only, so the three direction booleans are NOT
  schema-required in either arm, which is exactly what makes the omission-rate half of Problem B measurable),
  `model`/`effort`/`budget`, and the adapter's own `buildSubjectMandate` text threaded through `mandate:` —
  untouched in both arms, matching #3057's own finding that this text is shared and byte-unchanged.

### Sample size and cost discipline

**N = 5 panels per arm** (10 panels total, 40 juror spawns) — a judgment call, stated rather than hidden: enough
to see a real split (e.g. 5/5 unanimous vs. 3/2) at a cost that stays in the "single-digit dollars" range #3057's
own Cost section anticipated for `sonnet`/`medium`, not enough to resolve a near-50/50 split with confidence. If
the first arm's results are genuinely ambiguous (close to even), that ambiguity is itself worth reporting rather
than silently re-run past N=5 chasing significance.

**Pilot before scaling.** Run one repeat per arm first, read the printed `totalCostUsd`, and confirm the
projected 10-panel total stays under a stated ceiling (e.g. $15) before running the full 5-repeat set. This
mirrors the aggregate-budget admission-control discipline already in `judgePanel` (checked pre-flight, never
mid-run) — the script does not enforce this across repeats automatically, so it is stated here as the operator's
own gate.

**Sequential, not parallel**, across repeats within an arm — cost visibility and abort-ability over wall-clock
speed; this is a one-off measurement, not a latency-sensitive path.

### What counts as a real result (not "run it and see")

- **Problem A.** Report the `parallelizable` answer distribution for the `correctness` seat specifically (the
  seat that flipped in #3057) across the 5 `with-sentence` repeats, plus the same distribution for the other
  three lenses as a sanity check. The write-up must state plainly whether the distribution bounds
  within-`sonnet`/`medium` variance consistent with #3057's own haiku/low observation (all-`true`) or reveals
  something different at production settings — a variance measurement, not an equality claim, exactly as the
  "Problem A" section above already concludes it must be.
- **Problem B.** For each arm, report (1) the `parallelizable` distribution and (2) the omission rate of the
  full `{introduced, worseThanBase, parallelizable}` triple, both as raw counts (e.g. "4/20 seat-answers omitted
  the triple in arm `without-sentence` vs 0/20 in arm `with-sentence`"), scored separately because the sentence
  does two jobs. The write-up must say, for each of the two questions — **is the sentence leading?** and **is it
  necessary?** — whether the two arms differ enough at N=5 to be worth acting on, showing the counts so the call
  is checkable, not just asserted.
- **Either way, the design question stays open.** Whether a mandate should ever state the routing consequence of
  its answers is explicitly NOT this item's call (see "The design question this raises" above) — the measurement
  informs that question, it does not answer it. If the numbers come back informative, file a follow-up decision
  item citing them; do not fold a ruling into this card's resolution.

## Interfaces and protocol

```js
// we:skills-src/jury/measure-panel-arms.mjs — new, sibling to the panel-fanout shim
import { randomUUID } from 'node:crypto';
import { panelJurors, panelFanout, JUROR_SHAPE } from './panel-fanout.mjs';
import { judgePanel } from '../../scripts/lib/judge-panel.mjs';

// The fixed subject, embedded (see "The fixed subject" above) — not read from a file.
const SUBJECT_DIFF = `...`;

// The #3057 roster, embedded (see "Reproducing the #3057 roster" above) — captured ONCE by running
// `node skills-src/jury/resolve-roster.mjs --subject=pr-diff --care-level=low --input='[...]' --json`
// by hand while writing this script, then pasted in verbatim. NOT re-resolved at measurement time: the shim
// exports nothing to import, and shelling it per-run would be a second, undeclared runtime consumer.
const ROSTER = { subject: 'pr-diff', subjectNoun: 'diff', jurors: [/* the 4 resolved seats, pasted verbatim */] };

// The exact tail sentence the shim's jurorMandate appends (panel-fanout.mjs line 195-196), pinned here so
// drift throws instead of silently collapsing the two arms into one.
const OMISSION_SENTENCE = 'Omitting any of the three leaves the finding BLOCKING; they are the only way\n'
  + 'to route one to a carve-out.';

// One arm, one repeat. `mode: 'with-sentence' | 'without-sentence'`.
async function runOnePanel({ mode, model, effort, budget, maxTotalBudgetUsd, maxDepth }) {
  const runId = `panel-arms-${mode}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  if (mode === 'with-sentence') {
    // Byte-for-byte the production path — panelFanout calls the unmodified panelJurors/jurorMandate itself.
    return panelFanout({
      payload: { subject: ROSTER.subject, subjectNoun: ROSTER.subjectNoun, jurors: ROSTER.jurors,
        material: SUBJECT_DIFF, model, effort, budget },
      runId, depth: 0, maxDepth, maxTotalBudgetUsd,
    });
  }
  // without-sentence: same seat/mandate construction, then a fail-loud string strip before judgePanel directly.
  // The strip leaves a doubled space where the sentence used to sit (line 195 ends, line 196 continues, both
  // sides of the join carry a space) — collapsed here so the juror reads clean prose, not a byte artifact.
  const seats = panelJurors({ subject: ROSTER.subject, subjectNoun: ROSTER.subjectNoun, jurors: ROSTER.jurors })
    .map((seat) => {
      if (!seat.mandate.includes(OMISSION_SENTENCE)) {
        throw new Error(`measure-panel-arms: OMISSION_SENTENCE not found in seat "${seat.lens}" mandate — `
          + 'the Return-line text has drifted; update OMISSION_SENTENCE before re-running');
      }
      const stripped = seat.mandate.replace(OMISSION_SENTENCE, '').replace(/[ \t]{2,}/g, ' ');
      return { ...seat, mandate: stripped };
    });
  return judgePanel({
    jurors: seats, runId, depth: 0, maxDepth, maxTotalBudgetUsd,
    input: SUBJECT_DIFF, shape: JUROR_SHAPE, model, effort, budget,
  });
}

// CLI: node <this-file> --arm=with-sentence|without-sentence|both --repeat=1
//        [--model=sonnet] [--effort=medium] [--per-juror-budget-usd=0.5] [--max-total-budget-usd=8] [--json]
// Prints, per arm: panels run, per-lens parallelizable true/false/undeclared counts, triple-omission count,
// totalCostUsd, wallMs, and a conditions block (gitHead, model, effort, timestamp) — the same discipline
// we:scripts/measure-judge-spawn.mjs's `conditions()` already uses, so a number without that block is not a
// measurement.
```

## Tasks

1. Resolve the #3057 roster via the resolve-roster shim for a plain non-UI/page `--input` path at
   `--care-level=low`; confirm it prints the same 4 seats in the same order (correctness, security,
   simplicity, standards-conformance) before writing anything else — the grounding above says it will, this is
   the cheap check that it actually does — then paste the printed `jurors` array into the script as the literal
   `ROSTER` constant (see "The roster is embedded" above). This is a one-time authoring step, not something the
   shipped script re-runs.
2. Write the new measurement script per "Interfaces and protocol" above: the embedded fixed subject, the
   embedded `ROSTER` constant, the `with-sentence` arm (unmodified `panelFanout`), the `without-sentence` arm
   (`panelJurors` + fail-loud strip + whitespace-collapse + direct `judgePanel`), the conditions block, and the
   CLI.
3. Pilot: one repeat of arm `with-sentence`, then one repeat of arm `without-sentence`. Read `totalCostUsd` on
   both; confirm the projected 10-panel total stays under the stated ceiling before scaling up.
4. Full run: 5 repeats per arm, sequential, recording the printed conditions block for each.
5. Append a "## The measurement, as run (<date>)" section to this card (mirroring #3057's own "The equivalence
   run, as measured" section) with: the raw distributions, the omission-rate table, the total spend, and the
   plain-language calls required by "What counts as a real result" above.
6. If the numbers are informative enough to bear on the open design question, file a follow-up decision item
   citing them — do not rule the question inside this card.

## Done when

- [ ] The new measurement script exists, reuses `panelJurors`/`panelFanout`/`JUROR_SHAPE` from the panel-fanout
      shim **unmodified** (no forked copy of the mandate-building logic), and its `without-sentence` arm throws
      immediately if `OMISSION_SENTENCE` is not found verbatim in a seat's mandate (asserted by actually
      breaking it once — change the sentence and confirm the script throws rather than silently degrading to a
      no-op strip).
- [ ] The panel-fanout shim, `judgePanel`, `jury-core` and the harness workflow file are byte-unchanged — this
      item ships a measurement tool and a report, never a production behavior change (per the tag
      `capture-only` and the open design question above).
- [ ] Both arms have been run live at `sonnet`/`medium`, N=5 each, and this card carries an appended results
      section with: the `parallelizable` distribution per arm (raw counts, correctness lens called out
      separately), the triple-omission rate per arm (raw counts), total spend, and a plain-language call on
      each of the two questions in "What counts as a real result."
- [ ] The design question ("should a mandate state the routing consequence of its answers") is NOT ruled by
      this item's resolution — the card's own resolution note says so explicitly, or names the follow-up
      decision item filed if the numbers warrant one.

## Delivery shape

Lands as one PR, atomically — a new script plus (at resolution) an appended results section on this same card.
No existing file is edited, so there is no incremental-behind-`main` concern and no branch-coordination need;
the live measurement runs happen before the PR is opened (script + recorded results land together, the same
shape #3057's own equivalence write-up used).

## Watch for

- **Sample-size honesty.** N=5 is cheap and directional, not statistically powered. The write-up must not
  overclaim a 3-2 split as a finding — "ambiguous at this N" is itself an honest, reportable result and is
  preferable to a larger, unbudgeted re-run chasing significance.
- **Cost overrun.** `sonnet`/`medium` is unmeasured territory for this shim (#3057 only ever ran `haiku`/`low`
  live); the pilot-then-scale step in Tasks exists specifically to catch a per-panel cost that invalidates the
  "single-digit dollars" estimate before all 10 panels are committed to.
- **Sentence-drift silently defeating the A/B.** Covered by the fail-loud guard above and its own Done-when
  bullet — this is the single highest-risk failure mode (a passing script that measures nothing).
- **Scope creep into the design question.** The temptation, once real numbers exist, is to use them to rule
  "should mandates state consequences" inside this same item. Don't — that question was deliberately left open
  and a decision needs its own preparation and ratification, not a rider on a measurement card.

## Cost

Small. The migration's entire live measurement was **$0.320542** — three 4-seat panels at `haiku`/low, ~$0.10 each,
36–39 s wall. `sonnet`/`medium` will bill more per panel, so the honest expectation is single-digit dollars for a
handful of arms, not the ~$0.10/panel figure. The order of magnitude is dollars. **This item's own design above
prices it more precisely: 10 panels (5 per arm) × 4 seats = 40 `sonnet`/`medium` juror spawns, piloted one repeat
at a time first to confirm the projection before committing to the full run.**

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

## Independent review — 2026-08-15 (checklist item 9)

Confidence: **High** (after the correction below; Medium-High as first drafted).

A fresh session re-derived every factual claim from the live code rather than trusting this card's own
citations, and all of them held: the roster-reproduction math (`panelRigorForCareLevel('low')` returning
`PANEL_LENSES` unconditionally, `classifyTouchSet` only ever adding seats), the mandate-construction mechanism
(`panelJurors`/`jurorMandate` exported, the omission sentence's exact text and internal `\n` verified against
we:skills-src/jury/panel-fanout.mjs:195-196, `judgePanel`'s real signature matching the sketch), the
dependency-direction claim (grepped: no real `scripts/*` → `skills-src/*` import exists today, confirming
`skills-src/jury/` as the right home), the "old harness is gone" premise (no per-seat `agent(jurorPrompt(...))`
call remains in we:skills-src/jury/subject-jury.workflow.js), the `JUROR_SHAPE` omission-rate claim (`required:
['summary']` only), and the #3051 park-gate claim.

**Correction applied by this review** (risk name: **interface**) — the "Interfaces and protocol" sketch took
the jury roster as an opaque `roster` parameter and never showed how the script obtains it; the resolve-roster
shim exports nothing to import, so a live in-process resolve was never actually available, and a subprocess
shell-out would have made the shim an undeclared runtime consumer. Corrected: the roster is now embedded as a
literal `ROSTER` constant (captured once via the resolve-roster shim while authoring the script), the same
treatment already given the fixed subject and for the same reason — held fixed across both arms and every
repeat. "Reproducing the #3057 roster," "Interfaces and protocol," and Task 1 were updated to match.

**Minor fix, same pass:** the illustrative stripped-mandate quote implied single-spaced prose; the actual
string-splice leaves a doubled space where the removed sentence sat (both sides of the join carry a space).
The code sketch now collapses that (`.replace(/[ \t]{2,}/g, ' ')`) so a juror in the `without-sentence` arm
reads clean prose rather than a whitespace artifact — cosmetic, but worth not shipping.

**Residual risks:** none rated above low. **population** (N=5/arm is explicitly self-limited and the card
already caveats ambiguous results honestly); no **blast-radius** or **consumer** collision found (no other open
item's scope overlaps we:skills-src/jury/panel-fanout.mjs or we:scripts/lib/judge-panel.mjs — #3094 is open but
scoped to we:scripts/operations/review-pr.mjs / we:scripts/lib/review-core.mjs, a different file set).
