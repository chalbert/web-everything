---
bornAs: xe9hwyi
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should claim-accuracy be a mandatory lens

#2310 ratified the mandatory/advisory split, with mandatory meaning a genuine invariant with no other backstop. claim-accuracy arguably meets that better than standards-conformance, which check:standards backstops, and the deterministic attempt at the class caught only 5 of 39 confirmed labels (12.8%), of which 3 survived hand-inspection — re-run it with `node we:scripts/review-corpus/replay-gates.mjs`. It landed advisory pending this call. Nothing needs it promoted until the panel is wired.

> **Retracted.** This card used to say *"the deterministic attempt at the class caught 3 of 13."* The replay reports 5 of 39; there is no population of 13 in its output.

## Fork 1 — is `claim-accuracy` a mandatory lens?

**Why this is a fork.** Mandatory and advisory cannot coexist for one lens: `we:scripts/lib/jury-core.mjs:675` and `:679` are disjoint sets, and membership decides whether the lens can block a land (`:656` — mandatory lenses "must unanimously accept to land"). Exactly one is correct, so this is a real either/or rather than a knob with two legitimate settings.

**The criterion is #2310's own, and it is a merit test:** mandatory means *"a genuine invariant with no other backstop"*. `standards-conformance` is advisory precisely **because** `check:standards` backstops it (#2310 body, citing #2199).

### (a) Mandatory

- Meets #2310's stated criterion on its face: the deterministic backstop for this class was built and measured at **3 of 13** addressable findings (`we:scripts/review-corpus/replay-gates.mjs`), so there effectively is none.
- It is already what blocks in practice: of 30 verdicts recording `changes`, roughly 24 were an operator raising this class by hand.

### (b) Advisory — **the default**

- **Mandatory means unanimity is required to land.** A lens whose findings are mostly prose accuracy would then block merges on prose, which directly contradicts the reviewer bar this constellation is converging on: block on wrong code, a test that does not test what it claims, an unachievable criterion, or a claim that would send a builder the wrong way — *not* on stale figures no criterion depends on.
- **The empirical case against it is this programme's own.** Two rounds of this lens on PR #1569 found **nine wrong figures** and **missed both defects that actually bounced it** — a test that could not fail under any mutation, and the main new feature having no test at all. It is good at cheap findings and missed the expensive ones. Promoting a lens with that profile to blocking buys bounces, not safety.
- Its own evidence cuts against blocking: a class whose deterministic adjudication scores 3 of 13 is a class where a *blocking* verdict carries high false-positive risk.

### (c) Advisory, with a scoped blocking sub-class — **the recommended default**

Neither (a) nor (b) as stated. The lens stays out of `MANDATORY_LENSES`, **and** a narrow category of its findings blocks: a claim a builder would act on — an acceptance criterion, a `file:line` a card directs work to, a "this already handles X" that would stop someone building X. A wrong figure in prose that no criterion depends on advises and never blocks.

This is the same partition the recalibrated reviewer bar draws, applied inside one lens instead of across lenses. It also matches what the measured evidence supports: the class is real and unbacked, *and* most of its instances are not worth a round.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacked as "(c) is (b) wearing a hat — an advisory lens whose findings sometimes block is just a mandatory lens with extra steps." That survives only if the sub-class is definable without judgement; if it is not, (c) collapses into (a) and inherits its false-positive risk. **Amendment folded in:** (c) is conditional on the sub-class being expressible as a typed field on a finding, not as reviewer discretion — otherwise take (b).

**Screen:** clear. Not an implementation detail — lens weighting is observable across the WE↔FUI boundary in whether a PR can land. Not prioritisation — with both branches free to build and instantly maintained, a merit difference remains: (a) blocks on prose, (b) leaves a measured, unbacked class with no blocking check.

## Not in scope

Wiring the panel. Today `review-pr` runs one caller-chosen lens (`we:scripts/operations/review-pr.mjs`), so the mandatory/advisory split does not bind at all until `judgePanel` is wired — which is blocked on #3158's tool-free seats. **Nothing needs this ruling until then**, which is why the lens shipped advisory rather than waiting for it.

