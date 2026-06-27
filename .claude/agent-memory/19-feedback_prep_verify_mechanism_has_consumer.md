---
name: feedback_prep_verify_mechanism_has_consumer
description: "prep a \"which surface/tool\" decision by grepping the mechanism's consumer graph FIRST; zero consumers flips it to build-now-vs-defer; verify the candidate consumer imports the SPECIFIC orphan, not a sibling artifact"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bf349761-c380-4c51-88c7-393d680128bc
---

When preparing a decision about **how to build a surface/tool** (which UI, which home, which shape),
grep the **consumer graph of the underlying mechanism it would feed BEFORE** treating the surface-choice
as the fork. A mechanism with **zero live consumers reshapes the decision** — the real fork is no longer
"which surface" but **build-now vs defer/park behind a real-consumer trigger**; the surface-model question
demotes to a *conditional* sub-fork that only bites if timing flips to build.

**Why:** a surface built over an uncalled mechanism is premature generalization — it invents a consumption
contract for an audience of zero. The verified consumer graph is the load-bearing fact that should drive
the ruling, not the surface aesthetics.

**How to apply:** during /prepare, run the grep (call sites of the function/path the surface produces
input for) as the grounding step; if 0 production callers, lead the prepared item with the timing fork
(default: defer & PARK + un-park trigger = "a real consumer exists") and keep the surface-model fork but
mark it conditional. Worked example #1592: `computeCredibilityWeight`'s `opts` override path had 0 callers
(sole "consumer" hardcoded literals), so a "dedicated editor vs Configurator domain" decision became
"defer/park". Pairs with [[feedback_verify_bulk_llm_classification]] (verify against data before
committing) and [[feedback_skeptic_finding_is_a_hypothesis]] (a skeptic claim is tested, not trusted —
here the skeptic surfaced the zero-consumer fact and it was confirmed by grep).

**Refinement (#1746) — a planned consumer surface may consume a DIFFERENT artifact than the orphan.** When
someone says "but surface X is coming, isn't that the consumer?", don't accept it — verify X imports the
**specific** orphan output, not a *sibling* artifact. #1746 gated on `produceFunctionalBytes` (functional
*runnable* ESM, 0 callers); the workbench shipping in both docs sites felt like the obvious consumer, but it
renders the functional *source* (a distinct emit, already wired) and never imports the runnable bytes. The
true consumer was a separate, unfiled *live-preview*. So: "the surface exists / is coming" ≠ "the orphan has
a consumer" until you've confirmed *which artifact* it actually imports. The grep is on the **exact symbol**,
and a candidate consumer that touches a neighbour (source vs runnable, inspect vs execute) is **not** a
consumer of the orphan. (Resolution here went GO anyway — but as an explicit *product* call to build the
live-preview, not because the workbench was the consumer.)
