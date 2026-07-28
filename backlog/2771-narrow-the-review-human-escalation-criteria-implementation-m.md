---
bornAs: xopxdeu
kind: decision
parent: "2405"
status: resolved
scaffoldedBy: "file-prep-decision"
dateScaffolded: "2026-07-28"
dateOpened: "2026-07-28"
dateResolved: "2026-07-28"
codifiedIn: "docs/agent/platform-decisions.md#review-human-declarative-leash-only"
preparedDate: "2026-07-28"
relatedTo: ["2501", "2625", "2307", "2636", "2563", "2445", "2573", "2566"]
tags: [review, escalation, review-human, trust-chain, gate-self, statute, codification, governance]
---

# Narrow the review:human escalation criteria — implementation must not bounce to the human

## Ruling — ratified 2026-07-28 (operator): adopt **b + c**

Both recommended defaults adopted. **Fork A → (b):** policy-tier *derivation CODE* routes to the sized independent committee (review-to-convergence, no self-approval), NOT always-`review:human`; `review:human` is reserved for the **declarative leash** — the contract (`we:review-policy.contract.json`), the roster (`we:gate-config.mjs`), the invariant/conformance suites — a raw NEW statute rule, or an un-ratified decision. **Fork B → (c):** a PR that *resolves a `kind:decision` + sets `codifiedIn`* (codifying an already-ruled decision, wording approved live) is NOT re-bounced to `review:human`; detected script-decidably from the resolve+`codifiedIn` diff shape, not a raw "touches `we:platform-decisions.md`" test.

Retained invariant (the only one #2501 Fork C keeps): the final landed diff is signed off by an agent that did NOT author it (#2439); diversity-selection aggregation; non-convergence hard-escalates to a human.

**Codified in** [`#review-human-declarative-leash-only`](../docs/agent/platform-decisions.md#review-human-declarative-leash-only). **Implementation follow-on:** `xfpxbji` "Implement the narrowed review:human rubric" (`blockedBy` this decision) — scaffolded, not built here.

## Grounding digest

**Operator principle (standing): "I do not want to review implementation."** The human reviews genuine
DECISIONS / judgment, not implementation. In practice too many PRs still bounce to `review:human`: gate-self
code fixes (e.g. #875) and statute/codification edits (the ratify PRs #882/#885). This decision **generalizes
the already-ratified #2501 Fork C ruling** — daemon-source (ENGINE-tier) changes go through the sized
independent agent-committee, NOT always-human, with independence / no-self-approval as the only retained
invariant — from that one tier to the **whole escalation rubric's two remaining `review:human` triggers.**

The rubric today has exactly two conditions that force a HUMAN, both in one line —
`scoreEscalation`'s `humanRequired = gateSelfFiles.length > 0 || statuteFiles.length > 0`
(we:scripts/lib/review-escalation.mjs:273):

1. **`gateSelfFiles`** — the diff touches the **POLICY tier** of the trust chain (`isGateSelfPath` =
   `isPolicyCorePath`, we:scripts/lib/review-escalation.mjs:151 → we:scripts/lib/gate-config.mjs:207-209).
   That tier is the **CODE** that derives the gate — `we:review-escalation.mjs`, `we:review-core.mjs`,
   `we:review-policy.mjs` — PLUS the declarative leash: `we:review-policy.contract.json`, `we:gate-config.mjs`
   (the roster), and the invariant suites (`POLICY_CORE_BASENAMES`, we:scripts/lib/gate-config.mjs:182).
2. **`statuteFiles`** — the diff edits the STATUTE layer, `we:docs/agent/platform-decisions.md` or any statute
   doc (`isStatutePath` / `STATUTE_PATHS`, we:scripts/lib/review-escalation.mjs:53-62). **Any** touch of
   `we:platform-decisions.md` forces `review:human` — which is exactly why a **codification** PR that merely
   records an ALREADY-ratified decision (`resolve --codified-to=<doc#anchor>`, the #911 gate,
   we:docs/agent/backlog-workflow.md L203) re-bounces to the human who already made that call.

Everything else already routes correctly: the **ENGINE tier** (the lander `we:merge-ai-prs.mjs`, the resident
daemon) escalates but is **agent-reviewable** (#2445 two-tier flip + #2501 Fork C, we:scripts/lib/gate-config.mjs:116-156),
and the **scored** signals (blast-radius / size / dismissed / cross-repo) are advisory **care-level**, not a
human gate (#2563, codified [`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md)).
So the two forks below are the last two "implementation bounces to a human" holes — one per trigger.

**The reframe (generalizing #2563 + #2501 Fork C):** `review:human` should mean *"genuine human judgment is
essential — an irreversible / novel policy change, or an un-ratified decision"*, NOT *"an agent might be
policing its own leash."* An **independent** fresh-context committee (took no part in authoring the final
diff, #2439 non-author rule) is sufficient independence for the CODE that implements the leash, PROVIDED the
**declarative leash itself** — the machine-diffable contract (#2566), the roster, the invariant suites — stays
human-gated and stays green. That is the split the two forks draw.

### Recommended path at a glance

Ratify both rows, or override the one you'd change.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A — gate-self / policy-tier CODE** | **(b)** policy-tier *derivation CODE* → the sized independent committee (review-to-convergence, no self-approval); human reserved for a change to the declarative leash (contract / roster / invariants) or a non-convergence deadlock | (a) status quo — any policy-tier file → `review:human` | Med-High |
| **B — codification of an already-ruled decision** | **(c)** a PR whose diff *resolves a `type:decision` + sets `codifiedIn`* and only adds that anchor → committee (`review:pending`), NOT `review:human` | (a) status quo — any `we:platform-decisions.md` touch → `review:human` | Med-High |

Recommended combination: **b + c** — reserve `review:human` for genuine human judgment (a novel/irreversible
policy edit to the declarative leash, a raw new statute rule, or an un-ratified decision), and route
*implementation* — including gate-self derivation code under independent committee review, and codification of
an already-made decision — to the committee.

---

## Fork A — gate-self / policy-tier CODE: independent committee, not always-human

**Fork-existence (real either/or):** the two branches genuinely cannot coexist. One says a change to the
policy-tier CODE is a **conflict of interest an agent structurally cannot review** — "an auto-reviewer would be
policing an edit to its own leash" (the current #2445 rationale, we:scripts/lib/gate-config.mjs:6-9) → a human
is *essential*. The other says an **independent fresh-context committee** that took no part in authoring the
diff (#2439) IS sufficient independence for the *code*, as long as the **declarative leash** it implements (the
contract, the roster, the invariants) stays human-gated and the conformance suite (#2566) stays green. Exactly
one can be the rule; they contradict on whether policy-CODE independence requires a human or a committee
suffices.

**The forced invariant (names the excluded-if-dropped branch):** the *declarative* leash MUST stay human. If a
committee could rewrite `we:review-policy.contract.json` (the thresholds / reason-clearance families /
disposition decision table), the `we:gate-config.mjs` roster (who is in the trust chain and at what tier), or
weaken a `we:gate-invariants.test.mjs` assertion AND clear its own change, it could redefine what "escalate"
and "human-required" even mean and self-approve it — the leash-rewriting-itself hole. So that subset is *not*
in this fork; it stays `review:human` by construction. This fork is **only** about the CODE that *derives* the
gate.

- **(a) Status quo.** Every file in `POLICY_CORE_BASENAMES` (we:scripts/lib/gate-config.mjs:182) →
  `review:human`: the derivation code (`we:review-escalation.mjs`, `we:review-core.mjs`, `we:review-policy.mjs`,
  the two land seams) AND the declarative leash, all human-only. Simple, maximally safe, one rule. Cost: it
  re-strands the queue on the operator for routine derivation-code work — a new lint, a refactor, a threshold
  *mechanic* — that the conformance suite already proves behaviour-preserving. This is the #875 bounce.

- **(b — recommended) Policy-tier *derivation CODE* → the sized independent committee.** Split the current
  policy tier in two:
  - **Declarative leash → stays `review:human`:** `we:review-policy.contract.json`, `we:gate-config.mjs`
    (roster), `we:gate-invariants.test.mjs`, `we:review-policy.conformance.test.mjs`. A diff here is a genuine
    policy change (the #2563 Fork-1 spec-based gate: *"did the spec change?"* is deterministic) —
    human-essential.
  - **Derivation CODE → committee (`review:pending`, agent-clearable):** `we:review-escalation.mjs`,
    `we:review-core.mjs`, `we:review-policy.mjs`, `we:disposition-land-seam.mjs`, `we:auto-land-seam.mjs`. A
    behaviour-preserving change here that keeps the conformance suite (#2566) green may be cleared by a
    **converged, diversity-selected, no-self-approval** committee (the #2636 jury / #2285 negotiated review),
    with human reached ONLY on non-convergence — the exact #2563 pattern, generalized one tier up from ENGINE
    (#2501 Fork C) to policy-CODE. The conformance suite is the deterministic backstop: any change that alters
    the gate's *behaviour* necessarily reddens conformance, forcing a **contract** diff → which is the
    human-gated declarative branch above. Green ⇒ implementation ⇒ committee.

  This is the **decision that authorizes and extends #2573** (open — "narrow the review-policy trust-chain gate
  from whole-file to spec-diff" for `we:review-core.mjs` + `we:review-escalation.mjs`): #2573 is the build arm
  for two of these files; ratifying (b) sets the *principle* for the whole derivation-CODE subset (incl. the
  two seams + the loader) and states the retained invariant. Builds directly on #2566 (the machine-diffable
  contract + conformance suite that make "did behaviour change?" deterministic).

**Script-decidable rubric change (concrete):** narrow the `gateSelfFiles` filter from "any `isPolicyCorePath`"
to "any `POLICY_SPEC` basename" — a new frozen subset in gate-config holding only the contract + roster + the
two invariant/conformance suites. Derivation-CODE basenames drop out of `humanRequired` but STAY on
`isTrustChainPath`, so they still ESCALATE (`review:pending`, full committee) — they just no longer force a
human. Sketch:

```js
// gate-config.mjs — split the policy tier: the DECLARATIVE leash forces a human; the derivation CODE escalates to committee.
export const POLICY_SPEC_BASENAMES = Object.freeze(new Set([
  'review-policy.contract.json',   // the machine-diffable spec (thresholds / clearance / disposition table)
  'gate-config.mjs',               // the roster (who is in the chain, at what tier) — the closure
  'gate-invariants.test.mjs',      // the safety tripwires
  'review-policy.conformance.test.mjs', // the impl↔contract bridge
]));
export function isPolicySpecPath(path) { return POLICY_SPEC_BASENAMES.has(basenameOf(path)); }
// review-escalation.mjs — humanRequired now fires on the DECLARATIVE leash (or statute), not any policy-CODE touch.
const humanBasisSpec = gateBasis.filter(isPolicySpecPath);
const humanRequired = humanBasisSpec.length > 0 || statuteFiles.length > 0;  // was: gateSelfFiles.length > 0 || …
```

**Retained invariant (the only one #2501 Fork C keeps, carried here):** the final landed diff is signed off by
an agent that did NOT author that final diff (#2439 non-author rule); aggregation stays diversity-selection
(strictest juror wins, never majority vote); non-convergence hard-escalates to `review:human`. No self-approval.

**Skeptic:** *Attack — "policy-CODE and the contract are not cleanly separable; a `we:review-core.mjs` change
can alter behaviour the contract does not fully pin, so a committee clears a real policy shift with no human."*
Partially bites → folds into the invariant, does not sink the fork: the guarantee is only as strong as the
conformance suite's coverage, so (b) is **gated on the #2566 suite proving the disposition over the full input
powerset** (it already does — "the ENTIRE powerset of reasons", #2566). Where a behaviour is *not*
contract-pinned, the honest rule is: it is a spec gap, and the fix is to pin it in the contract (a human-gated
diff), never to widen the committee's reach. Second attack — *"the same conflict-of-interest #2445 named still
exists: the committee is still made of the same kind of agent whose leash this is."* Refuted by the #2563
finding already ratified: a **fresh-context** adversary that took no part in the negotiation and never saw the
peers' self-assessment is independent of the change; the residual decorrelation risk (LLMs share failure
modes) is carried by the same non-zero human axis #2563 codified (operator oversight + optional post-land audit
sample), NOT by a mandatory human on every derivation-code patch. **Statute-overlap:** composes with
[`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md) (this narrows the *human*
trigger; that narrowed the *scored* triggers — same reframe, different rows) and with the #2445 two-tier flip
(this splits the POLICY tier the flip left whole). No collision — it refines both by a consistent test. Verdict:
**SURVIVES**, gated on conformance coverage.

---

## Fork B — codification of an already-ruled decision: committee, not human re-review

**Fork-existence (real either/or):** `isStatutePath` fires on ANY `we:platform-decisions.md` touch
(we:scripts/lib/review-escalation.mjs:53-62), so a **codification** PR — one that merely *records* a decision
the human already ruled — is treated identically to a **fresh** statute edit that authors a *new* rule. The
branches contradict: either the human re-reviews every statute touch (status quo), or
codification-of-an-already-ruled decision is exempted from the *human* gate. Exactly one can hold.

**Why the status-quo branch is the operator's exact complaint:** a codify PR runs `resolve
--codified-to=<doc#anchor>` (the #911 gate, we:docs/agent/backlog-workflow.md L203), which stamps `codifiedIn`
on a `type:decision` the human ALREADY ratified, and adds the corresponding anchor to
`we:platform-decisions.md`. The human already made that call at ratification; forcing `review:human` again asks
them to re-approve their own ruling — the #882 / #885 bounce. That is reviewing implementation (a mechanical
transcription), not judgment.

- **(a) Status quo.** Any `we:platform-decisions.md` touch → `review:human`. Simple, safe, one rule; but
  re-strands the operator on the mechanical recording of decisions they already made.

- **(c — recommended) Exempt the codify shape from the HUMAN gate (→ committee `review:pending`).** Detect the
  codification shape **script-decidably** from the PR diff, NOT by raw "touches `we:platform-decisions.md`":
  the same PR **(i)** flips a `kind:decision` backlog item from a non-resolved status to `status: resolved`
  with `codifiedIn:` set to a `we:docs/agent/platform-decisions.md#anchor` (or topical-doc anchor), AND **(ii)**
  the only `we:platform-decisions.md` edit is the ADDITION / extension of exactly that anchor. When both hold,
  the statute edit is the mechanical codification of an already-ruled decision → `review:pending` (committee),
  not `review:human`. A `we:platform-decisions.md` diff that does NOT carry an accompanying decision-resolve +
  `codifiedIn` (an author writing a NEW rule) stays `review:human` — that is a genuine new policy call.

  **The committee still reviews it** — it is still blast-radius / escalate, so it parks `review:pending` and an
  independent panel checks that the anchor **faithfully records the resolved decision's ruling** (diffing the
  anchor text against the decision item's ratified body) and flags drift. (c) downgrades codification from
  human-only to committee, it does NOT auto-merge it.

**Script-decidable rubric change (concrete):**

```js
// review-escalation.mjs — a statute edit that is the codification of an already-ruled decision is committee-clearable, not human.
// isCodificationOnly(diff): the PR resolves a kind:decision (status→resolved + codifiedIn=<pd#anchor>) AND the ONLY
// platform-decisions.md change is that anchor's addition. Then the statute touch does NOT force a human.
const statuteForcesHuman = statuteFiles.length > 0 && !isCodificationOnly(diff);
const humanRequired = humanBasisSpec.length > 0 || statuteForcesHuman;
```

**Skeptic:** *Attack — "the codified wording could drift from what the ratifier approved; a mechanical
`codifiedIn` set does not prove the anchor text matches the ruling."* Real residual, and it is why (c) routes
to the **committee, not auto-merge**: the independent panel's mandate on a codify PR is precisely "does this
anchor faithfully record the resolved decision's ruling?", diffing against the decision item's ratified body —
so wording drift is caught by an independent reviewer, without a mandatory human. Second attack — *"a
malicious PR could fake the codify shape: resolve a throwaway decision + smuggle a broad rule into the
anchor."* Refuted by the detection's conjunction: (ii) requires the ONLY `we:platform-decisions.md` change to
be the anchor named by that decision's `codifiedIn` — a smuggled broad rule is either a second anchor edit
(fails (ii) → stays human) or lives inside the one anchor (caught by the committee's faithful-recording check,
same as drift). And the resolved decision itself carries `preparedDate` + a ratification trail; a throwaway
decision with no ratified body gives the committee nothing to match, so it flags. **Statute-overlap:** sets no
new `codifiedIn` of its own (this decision, once ruled, codifies *the narrowed rubric* — a review-escalation
rule — not a `we:platform-decisions.md` statute rewrite); records how the codify-exemption composes with the
#911 codification gate. No collision. Verdict: **SURVIVES** — the residual is a review-content question the
committee already owns, not a reason to keep the human gate.

---

## Skeptic pass — what GENUINELY needs a human vs what does not

Concrete, script-decidable where possible (a rubric change, not a per-PR judgment call):

**GENUINELY needs a human (`review:human`):**
- A diff to the **declarative leash** — `we:review-policy.contract.json` (thresholds / reason-clearance /
  disposition table), the `we:gate-config.mjs` roster (trust-chain membership + tiers), or a weakened
  `we:gate-invariants.test.mjs` / conformance assertion. This is what "green" and "human-required" *mean*;
  moving it is a novel/irreversible policy call. (#2625 is the live sibling question: should
  `we:check-standards.mjs` — the standards gate — join this human tier? Same axis; ratify that separately.)
- A **raw new statute rule** — a `we:platform-decisions.md` edit that is NOT the codification of an
  already-ruled decision (no accompanying resolve + `codifiedIn`).
- An **un-ratified decision itself** — a `type:decision` being *ruled* (the decision-console / #2704 flow),
  not a PR concern.
- Any **non-convergence deadlock** — a committee that cannot converge hard-escalates to `review:human`
  (retained invariant).

**Does NOT need a human (→ independent committee, `review:pending`):**
- Implementation — any leaf code (already the default).
- **Gate-self / policy-tier derivation CODE** under independent committee review that keeps the conformance
  suite green (Fork A / #2573).
- The **ENGINE tier** — the lander + resident daemon (already agent-reviewable, #2445 / #2501 Fork C).
- **Codification** of an already-ruled decision (Fork B).

The one retained invariant across all of it (the only thing #2501 Fork C kept): **the final landed diff is
signed off by an agent that did not author it** (#2439), aggregation is diversity-selection (strictest wins,
never majority), and non-convergence hard-escalates to a human. No self-approval, ever.

## What this decision does NOT change / out of scope

- The **scored** signals (blast-radius / size / dismissed / cross-repo) — already advisory care-level, not a
  human gate (#2563). Untouched.
- The **ENGINE tier** routing — already agent-reviewable (#2445 / #2501 Fork C). Untouched.
- The sticky-veto semantics (`review:human` on a PR is a hard merge veto, #2309 / #2365) and the
  no-agent-clears-a-human-label enforcement (#2416). Untouched — those keep holding for whatever remains
  human-gated after this narrowing.
- The **committee mechanism** (jury size, round-trip cap, roster timing) — owned by #2636 / #2285. This
  decision routes work *to* the committee; it does not redesign it.
