---
bornAs: xmmj74x
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, review-policy]
---

# Statute-lint: an anchor's clearance claim may not be weaker than its cited rubric reason

An anchor that names a review-rubric reason can assert a clearance weaker than that reason's own `clearance` field, silently under-claiming the bar the contract sets. Add a `check:standards` rule pinning statute clearance claims to `we:scripts/lib/review-policy.contract.json`: an anchor naming a rubric reason may not assert a clearance weaker than that reason's `clearance` field.

## Gap

The review-policy contract (`we:scripts/lib/review-policy.contract.json`) is the single source of truth for each rubric reason's required clearance. A statute anchor can cite one of those reasons in prose and describe a *weaker* clearance than the contract mandates, and no gate cross-checks the two — so the statute drifts below its own contract.

## Why it matters

Statute is the cite-able layer the rest of the constellation reasons from. If an anchor can restate a rubric reason at a lower bar than the contract, readers cite the weaker version and the guarantee erodes. Pinning the claim to the contract keeps statute and contract in lockstep by construction.

## Mechanical fix

Add a `check:standards` rule that, for each anchor naming a rubric reason, looks up that reason in `we:scripts/lib/review-policy.contract.json` and **errors** if the anchor asserts a clearance strictly weaker than the reason's `clearance` field. Stronger or equal is fine; weaker fails.

## Provenance

Outstanding prevention **B2** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). This item does not reopen the resolved decision.

*(Corrected 2026-08-21: the original wording called #2840 / #2785 "the open conveyor-mechanization line". Both
are `status: resolved`, and the statute's own anchors already say so — the enforcement gap this item fills is
what those decisions left unbuilt, not an open decision line.)*

## Design

**The seam is the statute check that already exists.**
[we:scripts/lib/validate-rules-anchors.cjs](scripts/lib/validate-rules-anchors.cjs) holds the four statute
rules (`validateRulesAnchors`, `findDuplicateAnchors`, `findOrphanAnchors`, `validateAnchorSubstance`) plus
`validateInvariantEnforcers` (#2844) and `validateCitedItemStatusClaims` (#2842); `runStatuteCheck()` composes
them and returns `{ errors, warnings }`; `we:scripts/check-standards.mjs` calls it at its section *9a-rules*,
and `npm run check:statute` runs it standalone. This is one more pure rule in that file plus one line in
`runStatuteCheck()` — **no new script, no new gate wiring.**

**Reuse #2842's attribution SHAPE — but not its regexes.** `validateCitedItemStatusClaims` solves the
structurally identical problem: find a backticked `` `status: X` `` token, attribute it BACKWARDS to the
nearest preceding cite on the same line inside a bounded window (`CLAIM_B_WINDOW`), and refuse the attribution
when a sentence boundary (`CLAIM_B_SENTENCE_END_RE`) or a missing copula (`CLAIM_B_COPULA_RE`) shows the cite
is not the subject. Borrow that skeleton — the window, the sentence-boundary refusal, the backwards walk.

**Do NOT reuse `CLAIM_B_COPULA_RE` unmodified — it does not match the real grammar, checked against the one
line that matters.** `we:docs/agent/platform-decisions.md`'s `#human-required-is-judgment-only` anchor carries
both live claims in forms that regex rejects outright:

- `` `gate-derivation` → `clearance: agent` `` — the connector is an **arrow**, not a word, so
  `/\b(?:is|are|stays|remains|still)\b…/` cannot match.
- ``where `gate-self` and `statute` keep `clearance: human` `` — the verb is **`keep`**, which is not in that
  set, *and* one clearance token is attributed to **two** and-joined subjects, which a nearest-subject-only
  walk would under-attribute to `statute` alone.

So the rule needs its own connector vocabulary and a multi-subject run:

```js
// we:scripts/lib/validate-rules-anchors.cjs
/** Connectors that make a preceding reason token the SUBJECT of a clearance claim. Widened from #2842's
 *  copula set against the real statute text: an arrow, and the keep/carry/stay verbs, both occur live. */
const CLEARANCE_CONNECTOR_RE = /(?:→|->|\b(?:is|are|stays?|remains?|keeps?|carr(?:y|ies)|still)\b)\s*$/;

/** The and/comma-joined reason-token run immediately before a connector — so ``\`a\` and \`b\` keep …``
 *  attributes the claim to BOTH. Mirrors `citeRunAfterOpen`'s run handling, in the other direction. */
function reasonRunBefore(windowText) { /* → string[] of reason tokens */ }
```

**Prove the grammar before building the rule.** Run the candidate regex over the real
`we:docs/agent/platform-decisions.md` first and confirm it *recognizes* both live claims (it must find them and
then pass them, since both agree with the contract). A rule that silently recognizes nothing is a decorative
guard that reports 0 errors forever — indistinguishable from a working one.

**The vocabulary comes from the contract, never from a literal list** — that is the whole point of pinning:

```js
// we:scripts/lib/validate-rules-anchors.cjs
const CLEARANCE_RANK = { agent: 0, human: 1 };   // strictly ordered; "weaker" = a lower rank

/** Reason token → its contract clearance. Read from we:scripts/lib/review-policy.contract.json's
 *  `reasons[]`, so adding a reason needs no edit here. */
function contractClearances(contract) { /* → Map<token, 'agent'|'human'> */ }

/** ERROR when an anchor names a rubric reason and asserts a STRICTLY weaker clearance than the contract's.
 *  Stronger or equal passes. Pure — `srcByDoc` is the same map validateAnchorSubstance already builds. */
function validateStatuteClearanceClaims(srcByDoc, { clearanceOf } = {}) { /* → errors[] */ }
```

Today's nine tokens and their contract clearances: `gate-self`/`statute`/`non-convergence`/`mandate-conflict`
= `human`; `gate-derivation`/`blast-radius`/`size`/`dismissed-findings`/`cross-repo` = `agent`. Only
`human → agent` is a violation; `agent → human` (an anchor claiming a stronger bar) passes, per the item's own
"stronger or equal is fine".

**A live true-negative to test against:** `we:docs/agent/platform-decisions.md`'s
`#human-required-is-judgment-only` anchor already carries the exact target shape —
`` `gate-derivation` → `clearance: agent` `` and "`gate-self` and `statute` keep `clearance: human`" — and
all three agree with the contract, so the rule must leave that line clean. A fixture flipping `gate-self` to
`` `clearance: agent` `` on the same line must error.

**Error-message shape** follows the sibling rules: name the doc and line number twice (prefix and fix clause),
per the blast-radius note in that file. Rendered against we:docs/agent/platform-decisions.md line 3440 it
reads: *"…:3440: the anchor claims reason `gate-self` is `clearance: agent`, but the contract sets `human`.
Edit …:3440 — restate the reason at its contract clearance, or stop naming it."*

**A `todo`-marked reason carries no clearance obligation** — the contract's `todoMarker` block declares such
entries inert and excluded from every derived constant, so skip them rather than pinning prose to an
unimplemented cell.

## Done when

1. **Executable** — `npx vitest run rules-anchors` is green with a **grammar-recognition** case first: fed
   the two real claim strings from `we:docs/agent/platform-decisions.md`'s `#human-required-is-judgment-only`
   anchor (the `→` form and the `and`-joined `keep` form), the rule must ATTRIBUTE all three reason tokens to
   their clearances — asserted on the attribution output, not on the error count, since both claims are
   correct and produce zero errors. A rule that recognizes neither would otherwise pass every other criterion
   here while doing nothing.
2. **Executable** — `npx vitest run rules-anchors` is green with new cases over
   [we:scripts/__tests__/rules-anchors.test.mjs](scripts/__tests__/rules-anchors.test.mjs) that call
   `validateStatuteClearanceClaims` directly: a synthetic doc line naming `` `gate-self` `` and asserting
   `` `clearance: agent` `` yields exactly one error naming the doc, the line number, the token and both
   clearances; the same line asserting `` `clearance: human` `` yields none; and a line naming
   `` `gate-derivation` `` with `` `clearance: human` `` (a STRONGER claim) yields none.
3. **Executable** — a case proves the vocabulary is read from
   [we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json), not hard-coded: an
   injected contract fixture that flips one reason's `clearance` flips the rule's verdict on an unchanged doc
   line. A `todo`-marked reason produces no error.
4. **Executable** — `npm run check:statute` and `npm run check:standards` both report 0 errors on
   `main` as it stands, i.e. the rule is clean against the real
   [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) (including the
   `#human-required-is-judgment-only` anchor's three live, correct claims) — so it lands without a doc edit,
   or the doc edit it forces is part of this change.
5. **Executable** — a temporary edit weakening one real anchor's clearance claim makes
   `npm run check:statute` exit non-zero with the new message; reverting it returns to 0 errors. (The
   fails-before/passes-after pair: no such claim is wrong today, so the bite is shown by mutation.)

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: check by mutation or reversion ahead of the build) — The corpus/contract premise ('no such claim is wrong today') is verified true — I reconfirmed we:docs/agent/platform-decisions.md:3440's three claims (gate-derivation→agent, gate-self→human, statute→human) all match we:scripts/lib/review-policy.contract.json. But the design's core technical premise — that reusing validateCitedItemStatusClaims's CLAIM_B_COPULA_RE unmodified will let the new rule even RECOGNIZE that line's claims — was never verified against the real text and is false; see decorative-guard below.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Independently reverified: grepping `clearance:` across all four docs/agent/*.md governance docs and every backlog/*.md file returns exactly one line, we:docs/agent/platform-decisions.md:3440, carrying two clearance claims. The card's stated blast radius is accurate and tiny.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — No new wiring needed — we:scripts/lib/validate-rules-anchors.cjs's runStatuteCheck() is already the single seam consumed both by we:scripts/check-standards.mjs (section '9a-rules', confirmed at line 1649) and by the standalone we:scripts/check-statute.mjs (`npm run check:statute`, confirmed). Adding one more pure rule plus one call in runStatuteCheck() reaches both consumers for free.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #2 requires an injected-contract-fixture round-trip (flip one reason's clearance in a fixture contract, verify the rule's verdict flips on an unchanged doc line) — the same pattern already exercised for the sibling rules in we:scripts/__tests__/rules-anchors.test.mjs, so the contract↔rule interface is concretely tested, not just asserted.
- **population** (addressed; strategy: name the population each threshold guards) — Population is precisely 'a backticked rubric-reason token followed (within a bounded backward window) by a backticked `clearance: X` claim on the same line' — narrow by construction, and matches the corpus reality of exactly one real line today.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — MUTATION PROBE: I extracted the two real `clearance:` claims from we:docs/agent/platform-decisions.md:3440 ('`gate-derivation` → `clearance: agent`' and '`gate-self` and `statute` keep `clearance: human`') and ran them through the actual CLAIM_B_COPULA_RE (/\b(?:is|are|stays|remains|still)\b.../ ) and CLAIM_B_WINDOW logic the Design section names for reuse. NEITHER claim's preceding text matches the copula regex ('→' is not a word at all; 'keep' is not in {is,are,stays,remains,still}), so the reused-unmodified algorithm the card literally specifies ("the same algorithm with two substitutions") would silently fail to attribute either claim to its subject and never flag it — on the target line the card itself names as the load-bearing true-negative AND the source of the mutation fixture for Done-when #4. No test currently exists (the function is unbuilt), but the simulated mutation shows the specified approach would not redden under Done-when #4's own fails-before/passes-after requirement as literally described. This is very likely self-correcting: Done-when #3 (clean against the real doc) and #4 (mutation reddens) are executable acceptance criteria that would force an implementer to notice and adapt the copula/subject grammar (e.g. add 'keep', handle the arrow, or drop the copula requirement) before the card can be called done — so I judge this NOT worse-than-base (the acceptance tests act as a backstop) even though the Design section's specific technical claim is wrong as written. introduced=true, worseThanBase=false, parallelizable=true (the fix is a self-contained grammar adjustment made during this card's own implementation); impactIfUnfixed=degraded (an implementer following the Design prose literally hits friction at Done-when #4 and must adapt the regex, but recovers unaided via the card's own executable criteria — nothing ships silently broken). rootCause: the author generalized #2842's pattern-B algorithm from 'the identical shape' without actually running the reused regex against the one real corpus line the design cites as its own fixture source, trusting structural similarity (backticked-token → backward-window → copula-gated attribution) to imply the same copula vocabulary would transfer. prevention: before a design section states 'reuse X unmodified' against a specific quoted real-corpus line, run X against that exact line (a one-line spike) and paste the match/no-match result into the card — this is a review-lens/authoring-discipline gate, not a `check:standards` rule (the artifact being checked is prose, not yet code); preventionCaptured=false, would need filing as a future backlog item (e.g. a card-prep checklist step).
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Same evidence as blast-radius: the constraint (how many real anchors carry clearance claims) was measured before sizing the rule, and independently reconfirmed as exactly one line.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Error-message shape (doc+line named twice, prefix and fix clause) explicitly follows the sibling rules' convention, matching the pattern actually used by validateCitedItemStatusClaims's `push()` helper in we:scripts/lib/validate-rules-anchors.cjs.

**Corrections applied by this review:**

- The Design section states the clearance rule reuses #2842's CLAIM_B_COPULA_RE unmodified, but simulating that regex against the real target line (we:docs/agent/platform-decisions.md:3440, which uses '→' and 'keep' rather than is/are/stays/remains/still) shows it would not match either live claim.
- The Provenance section calls #2840/#2785 'the open conveyor-mechanization line,' but both backlog/2840-*.md and backlog/2785-*.md carry `status: resolved` in the live repo (and we:docs/agent/platform-decisions.md's own anchors at :3442/:3446/:3460/:3466 already say 'both since resolved'), contradicting the same sentence's next clause ('the resolved decision').

The design correctly locates the seam, reuses the right file/tests/scripts (all verified live), and scopes tightly to a genuinely tiny blast radius — but its central technical claim, that #2842's CLAIM_B_COPULA_RE can be reused unmodified for the clearance grammar, is empirically false against the one real anchor the card itself cites as ground truth.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** Both corrections are correct and are now fixed in the body. (1) The
`CLAIM_B_COPULA_RE`-unmodified claim was empirically false: the two live claims on
we:docs/agent/platform-decisions.md's `#human-required-is-judgment-only` anchor use an arrow and the verb
`keep`, neither of which that regex matches — and the second attributes ONE clearance to TWO and-joined
subjects, which a nearest-subject walk under-attributes. The Design now specifies its own
`CLEARANCE_CONNECTOR_RE` plus a `reasonRunBefore` multi-subject run, and `## Done when` gained a
grammar-RECOGNITION criterion asserted on attribution output rather than on an error count — precisely so a
rule that silently matches nothing cannot pass as working. (2) The Provenance line calling #2840/#2785 "the
open conveyor-mechanization line" is corrected: both are `status: resolved`. No finding was judged wrong.

