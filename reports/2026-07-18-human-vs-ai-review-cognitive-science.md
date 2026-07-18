# The human's role in AI-driven review — cognitive science + human factors (deep research)

*Session report, 2026-07-18. Grounds #2563 Fork 2 (the high-blast review backstop). Deep-research harness:
6 angles → adversarially verified (107 agents, 22 confirmed / 2 refuted). Corrects an earlier design lean.*

## Verdict

The evidence favors a **division of labor, not a human-vs-AI contest** — and it **corrects the lean that a
diverse AI panel can carry the decorrelated backstop.** Humans are demonstrably worse at inspecting large
changes; but a diverse AI panel does **not** give the independent error distribution its scale suggests,
because LLMs share failure modes. So the human's value is not out-inspecting the AI — it is intent authority,
a genuinely decorrelated check, and accountability.

## Confirmed findings

1. **Humans review large changes WORSE — "humans review big PRs better" is false for defect-finding.**
   Cisco/SmartBear (~2,500 reviews, 3.2M LOC): defect density peaks under 200 LOC, rarely exceeds 37/kLOC past
   250; effectiveness collapses past ~400 LOC, faster than 450 LOC/hr, or after 60 min. This is precisely
   where an LLM holding the whole diff at constant attention has a structural edge. *(high)*
2. **The vigilance decrement is robust and worsens under working-memory load** — humans degrade over time and
   under cognitive load; a machine reviewer doesn't share this the same way. *(high; sensitivity-half is
   task-conditional)*
3. **A diverse AI panel does NOT decorrelate — the correction.** LLMs make substantially correlated errors:
   model pairs agree ~60% when both wrong (vs 33% chance), and **error correlation RISES with capability, even
   across vendors/architectures**. 3–5-model ensembles realize only ~0.43 of the reliability gain independence
   would allow; majority voting moves 0.88→0.91 with five models. This is the LLM analogue of Knight & Leveson
   (1986): independently-developed versions had correlated failures far above independence. **An AI panel is a
   weak backstop against blind spots it shares.** *(high)*
4. **LLM-as-judge inherits the correlation via self-preference / family bias** — inflates weaker same-family
   models by marking shared-wrong answers correct. A naive AI jury can *manufacture false confidence*. *(high)*
5. **Complementarity is real but only with the right aggregation.** The oracle ceiling can be +83% over the
   best single model, but **naive majority voting hits a "popularity trap"** that amplifies common-but-wrong
   outputs; a **diversity-based *selection* strategy** captures up to 95% of the ceiling, even with 2 models.
   So panels help *if aggregated by diversity-selection, not voting.* *(high)*
6. **Automation bias: a passive human monitor over a good-but-imperfect AI catches FEWER defects than an
   unaided human.** Measured, affects experts, not trainable away, worse under multi-task load. **A
   rubber-stamp human-over-the-loop subtracts value.** *(high)*

## The human's irreducible role (not competence)

Not out-inspecting the AI on correctness. It is: **(a) validation vs verification** — "is this what we
intended," the spec/intent authority the AI can't self-supply; **(b) a genuinely decorrelated check** on the
error class LLMs *share* (the one axis proven independent of the AI panel); **(c) accountability /
answerability**, distinct from review competence.

## Recommendation for Fork 2

Back the high-blast path with **BOTH** a diversity-aware AI panel (for scale + partial complementarity,
aggregated by **diversity-selection, not majority vote**) **AND** a human — but **scope the human to intent
authority + an *active* independent judgment + accountability, never line-by-line re-review**, and design the
human task to avoid passive monitoring (forced independent spec/intent call, blind/adversarial framing). The
human sample is **not** thin accountability theater: because the panel can't catch its own shared blind spots,
the human is the *only proven decorrelated axis* — so keep the sample active and non-trivial, graduate the
rate on track record, never to zero.

## Refuted (excluded)

- "A multi-model panel never beats the single strongest model" (1-2 — panels sometimes do help).
- "Problem difficulty alone drives shared blind spots" (1-2).

## Open questions (residual risk — design to be robust to them)

1. **Does an LLM have its own large-context decrement** ("lost-in-the-middle") on big diffs? Asserted by
   analogy, not measured — so "AI beats humans on large diffs" is plausible, not established.
2. **How decorrelated are HUMAN vs LLM reviewers specifically?** The key unknown: the human's decorrelated
   value rests on humans catching a *different* error class than LLMs — plausible but not directly measured.
3. **Minimal active human-task design** to escape the complacency trap while still scaling.
4. **Does accountability require review capability or only answerability** — and how to avoid the "moral
   crumple zone" (a human blamed for an AI decision they couldn't realistically override)?

*Caveats: the human-factors findings (SmartBear, Knight-Leveson, Parasuraman-Manzey, Skitka) are foundational
and replicated; the LLM-correlation numbers lean on 2025-26 arXiv work (some single preprints) and come from
code *generation*, not review specifically — the analogy is reasonable, not directly measured. Notably,
correlation RISES with capability, so the panel-decorrelation problem may **worsen** over time.*
