---
bornAs: x2vqz2v
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, anchor-overlap]
---

# Statute-lint: flag verbatim duplication between a new anchor and the anchors it links

A new statute anchor that copies rule text out of an anchor it cites creates a second, unmaintained copy: amend the
original and the copy silently disagrees, while its `composes with — does not alter` label asserts a fidelity it
cannot keep. Flag long verbatim runs shared between a new `{#anchor}` and any anchor it links, so copied rule text
must become a link. This is the counterpart to #2850 — together they must be one mechanism, or "prove you restated
it faithfully" becomes the reason a restatement exists.

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` checks that anchors resolve, are unique, are non-orphan, and have
substance. Nothing measures overlap BETWEEN anchors, so a new anchor may restate a linked anchor's rule in full and
pass green.

## Why it matters

Worked instance — PR #982 (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`).
Round 2 of the human `/review` found the diff had copied #2771's three-trigger set and its
leash-vs-derivation-code file roster into two new anchors, each under a relation line claiming no alteration; one copy
had silently substituted a trigger. Round 3 deleted those two copies but GREW a third: #2398's four anti-test-gaming
clauses and its validator definition are now restated verbatim inside `#deterministic-oracle-clears-slice` and
`#fix-review-convergence-independent-root-cause`. #2398 is live under epic #2410, so those copies will drift.

The file-roster case is worse than prose drift: `we:scripts/lib/review-escalation.mjs`,
`we:scripts/lib/review-core.mjs`, `we:scripts/lib/review-policy.mjs`, `we:scripts/lib/review-policy.contract.json`,
`we:scripts/lib/gate-config.mjs` and the invariant/conformance suites have a machine-readable home in
`we:scripts/lib/gate-config.mjs`. A prose copy in statute goes stale the moment the roster changes, and nothing
compares them.

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`:

1. When a NEW `{#anchor}` body links an existing anchor, **warn** on any shared verbatim run of ≥12 words between
   the two bodies — copied rule text must become a link.
2. **Error** when a backticked path token inside a `we:docs/agent/platform-decisions.md` anchor body does not resolve
   against the tier roster in `we:scripts/lib/gate-config.mjs` — a prose file list that disagrees with the roster
   fails the build.
3. Reconcile with #2850 in ONE rule: satisfy relation-fidelity by requiring a LINK plus a short relation label,
   never by requiring a quotation. If #2850 lands first as a quote-the-source check, this item supersedes that half.

## Provenance

Outstanding prevention **M10** from round 2 of the human `/review` on **PR #982** — the one prevention from that
round that was never filed alongside #2842–#2850. Re-surfaced as a round-3 finding by the simplicity and
standards-conformance lenses. Captured per the prevention-introspection discipline (#2823). Related: #2850
(relation-line presence), #2842 (precedent cites resolve).

## Design

**The seam and its shape.** `we:scripts/lib/validate-rules-anchors.cjs` is a CommonJS module of pure rules plus
one fs gather, exported through `module.exports` and driven by `runStatuteCheck()`. It already carries the four
neighbours this rule sits beside — `validateRulesAnchors` (resolution), `findDuplicateAnchors` (a duplicate
`{#id}` definition), `findOrphanAnchors` (nobody cites it), `validateAnchorSubstance` (a body under
`minChars`) — and `anchorSubstance(src, id)` already extracts an anchor's body text (definition line → next
heading or EOF). That extractor is the input the overlap rule needs; do not write a second one.

Two consumers already call `runStatuteCheck()`: `we:scripts/check-statute.mjs` (`npm run check:statute`) and
`we:scripts/check-standards.mjs`. Adding to `runStatuteCheck` therefore reaches both with no new wiring, and
`we:scripts/__tests__/rules-anchors.test.mjs` is the existing fixture-driven test home.

**Rule 1 — the shared verbatim run (WARN). MEASURE THE THRESHOLD; 12 words is a guess, and the item's own
worked instance does not clear it.** For each anchor body, take the set of anchors it references and report the
longest verbatim word-run shared with each referenced body. Normalize before comparing (collapse whitespace,
strip markdown emphasis and link syntax) or the rule will miss a copy that differs only in a `**bold**`. Warn,
not error: a shared run can be legitimate (a quoted term of art), and this is a "make it a link" nudge.

Two calibration facts to establish first, both measured against the live
`we:docs/agent/platform-decisions.md`:

- The "Why it matters" instance below **does not fire at ≥12 words**. The longest verbatim run shared between
  `#deterministic-oracle-clears-slice` and #2398's anti-test-gaming clauses measures **7 words**, and the
  validator definition ~**10**. So either the threshold is wrong for this corpus or the instance is a
  paraphrase rather than a copy — resolve that before picking a number, the same "measure the real corpus
  before choosing the discriminator" treatment rule 2 gets below.
- **`collectAnchorReferences` is not a link matcher.** It tests `(?<!\{)#<id>(?![\w-])` — *any* bare `#id`
  mention outside a `{#id}` definition. Reusing it as-is makes "the anchors this body links" mean "every
  anchor id this body mentions", which is a wider population: e.g. `#statute-anchor-states-rule-not-status`'s
  prose names `#fix-review-convergence-independent-root-cause` in a sentence about word counts, with no
  composes-with relation asserted. Either narrow the extraction to `[text](#id)` link syntax, or accept the
  wider population deliberately and say so.

**Rule 2 — a prose file roster must match `gate-config` (ERROR).** `we:scripts/lib/gate-config.mjs` exports the
machine-readable roster — `TRUST_CHAIN`, `TRUST_CHAIN_BASENAMES`, `POLICY_CORE_BASENAMES`,
`POLICY_SPEC_BASENAMES`, `POLICY_DERIVATION_BASENAMES`, plus the predicates `isTrustChainPath` /
`isPolicyCorePath` / `isPolicySpecPath` / `isPolicyDerivationPath`. A backticked `we:scripts/…` token inside a
`we:docs/agent/platform-decisions.md` anchor body that names a *gate* file must resolve against that roster.
**Note the module boundary:** `we:scripts/lib/gate-config.mjs` is ESM and `we:scripts/lib/validate-rules-anchors.cjs` is CJS, so the check
needs a dynamic `import()` (or the roster lifted into a shared JSON the way
`we:scripts/lib/invariant-catalogue.json` is) — a bare `require()` will not work. Decide that before building.

**Scoping this so it does not fire on every anchor.** Not every backticked path in statute is a gate-tier
roster claim (anchors routinely cite mechanism files under a `Mechanisms:` lead-in). Rule 2 must key on the
*roster* role — a list of gate/policy files presented as the tier's membership — not on any path token, or it
errors on correct prose. Measure the real corpus before choosing the discriminator.

**Rule 3 — reconcile with #2850 (`status: open`).** Ship as ONE mechanism: relation fidelity is satisfied by a
**link plus a short relation label**, never by a quotation. If #2850 lands first as a quote-the-source check,
this item supersedes that half. Both rules live in the same file, so "one mechanism" is a design constraint,
not a coordination problem.

**The file-roster worked instance is stale — re-derive it or drop it.** The "Why it matters" paragraph cites
`#fix-review-convergence-independent-root-cause` as carrying a prose copy of #2771's leash-vs-derivation-code
file roster. That anchor's live text now says the opposite: it explicitly states it "does **not** re-list those
triggers (see that rule for their exact wording)". The copy was edited out. Rule 2's *design* is unaffected —
a prose roster that disagrees with `we:scripts/lib/gate-config.mjs` is still the right thing to error on — but
its motivating instance no longer exists on disk, so find a live one or state plainly that the rule is
preventive rather than remedial.

**Statute context that has moved since filing.** `#statute-anchor-states-rule-not-status` was ratified
2026-08-17 (#2854) and cites `#fix-review-convergence-independent-root-cause` growing 427 → 655 → 714 words as
the worked instance — the same anchor this item names. The two rules are complements: #2854 bars point-in-time
*status* prose from an anchor; this bars *duplicated rule text*. Cross-link them rather than restating either.

## Done when

- `npm run check:statute` fails before and passes after on a fixture: `npx vitest run rules-anchors` covers a
  new anchor whose body shares a verbatim run **at or above the chosen threshold** with an anchor it
  references (**warn**), the same pair after the copy is replaced by a link (**clean**), a shared run one word
  below the threshold (**clean**), and a shared run between two anchors that reference each other in neither
  direction (**clean** — the rule is scoped to referencing pairs).
- The threshold is **stated with the measurement behind it**: the item records the distribution of longest
  shared verbatim runs across the live anchor pairs and names where the chosen bar sits in it. "12 words"
  survives only if the data supports it; a number picked to make one anecdote fire is the failure mode here.
- A second fixture set covers rule 2: an anchor body naming a gate file absent from the `we:scripts/lib/gate-config.mjs`
  roster **errors**; the same body with the roster-matching set is **clean**; and a non-roster mechanism cite is
  **clean** (the false-positive case the scoping paragraph names).
- `npm run check:statute` on the current, unmodified `we:docs/agent/platform-decisions.md` produces **0 new
  errors** — rule 2 lands green on the real corpus, or the corpus is fixed in the same change. Rule 1's
  warnings on the live anchors are enumerated in the item close-out (the count may legitimately be **zero** —
  see the calibration note above — in which case say so rather than tuning the bar until something fires).
- The #2850 reconciliation is a fact on disk, not an intention: exactly one relation-fidelity rule exists in
  `we:scripts/lib/validate-rules-anchors.cjs`, and it requires a link + relation label, never a quotation.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: mutation/reversion check ahead of the build) — The card's 'Why it matters' worked instance (round-3 restating #2398's anti-test-gaming clauses and validator definition, verbatim, inside we:docs/agent/platform-decisions.md's #deterministic-oracle-clears-slice / #fix-review-convergence-independent-root-cause) was never checked against the ≥12-word threshold the card itself proposes. Measured against the live doc, the longest shared verbatim word-run is 7 words (anti-test-gaming clauses) and ~10 words (validator definition) — both under the bar. Rule 2's discriminator gets an explicit 'measure the real corpus before choosing' treatment; rule 1's threshold does not get the same treatment despite being justified by an anecdote that doesn't clear it.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Rule 1 is WARN-only (softening the cost of over-firing) and explicitly names the quoted-term-of-art false positive; rule 2's 'Done when' requires 0 new errors on the real, unmodified we:docs/agent/platform-decisions.md, or the corpus fixed in the same change.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified against the live repo: `runStatuteCheck` in we:scripts/lib/validate-rules-anchors.cjs has exactly the two callers the card names (we:scripts/check-statute.mjs, we:scripts/check-standards.mjs) plus its own test file — no other ES-import or subprocess/hook caller exists. we:scripts/lib/memory-freshness.cjs imports a different export (`buildAnchorIndex`) and is unaffected by this change.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card correctly flags the CJS (we:scripts/lib/validate-rules-anchors.cjs) ↔ ESM (we:scripts/lib/gate-config.mjs) module boundary as a must-decide-before-building question and offers two concrete resolutions, one grounded in an existing repo pattern (we:scripts/lib/invariant-catalogue.json as a shared JSON source).
- **population** (NOT addressed; strategy: name the population each threshold guards) — Rule 1's population ('the set of anchors it links') is characterized as what `collectAnchorReferences` in we:scripts/lib/validate-rules-anchors.cjs 'already knows how to spot' as `[text](#id)` targets, but that function actually matches any bare `#id` occurrence outside a `{#id}` definition, not specifically markdown-link syntax — a narrower population than what reusing it as described would actually produce. Rule 2's population ('a roster claim, not any path token') is well-scoped and explicitly grounded against a real corpus example (the 'Mechanisms:' lead-in pattern).
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — 'Done when' requires fixture tests for both rules (warn/error case, fixed-and-clean case, under-threshold clean case, non-linked-pair clean case for rule 1; error/clean/false-positive-clean case for rule 2) in we:scripts/__tests__/rules-anchors.test.mjs — a named test must redden on the defect and green after the fix, not just presence-of-a-check.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — Same gap as premise: the card asserts its rule would have caught the PR #982 round-3 defect but that claim is not measured against the current corpus, and measured evidence shows it would not clear the stated threshold today.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Verified in we:scripts/check-standards.mjs: WARN-only rules already route through a shared `warn()` reporting path (used identically for the pre-existing memory-freshness WARN rule) rather than being silently swallowed.

**Corrections applied by this review:**

- The claim that #2398's anti-test-gaming clauses are 'restated verbatim' inside #deterministic-oracle-clears-slice does not hold at the card's own proposed ≥12-word bar — the longest verbatim shared word-run against the live we:docs/agent/platform-decisions.md text is 7 words; the passage is a paraphrase, not a literal copy.
- The claimed file-roster verbatim duplication inside #fix-review-convergence-independent-root-cause no longer exists in the live doc: that anchor's current text explicitly states 'it does not re-list #2771's leash-vs-derivation-code file roster (see #2771 for the exact paths)' — the specific worked instance the card cites for the 'file-roster case' has since been edited out.
- `collectAnchorReferences` in we:scripts/lib/validate-rules-anchors.cjs matches any bare `#id` occurrence outside a `{#id}` definition, not specifically `[text](#id)` markdown-link syntax as the Design section's parenthetical characterizes it.

A well-grounded mechanical design (correct citations of existing helpers, consumers, and the CJS/ESM module-boundary risk, with good false-positive scoping for rule 2), but its own motivating "worked instance" for rule 1's ≥12-word threshold does not survive verification against the live doc — a carve-out gap, not a blocker.

**Findings applied after this review** (all three corrections accepted, verified against the live `we:docs/agent/platform-decisions.md`): the ≥12-word threshold is no longer asserted — the item's own worked instance measures 7 and ~10 words and would not fire, so the number is now a measurement step; the file-roster instance was edited out of `#fix-review-convergence-independent-root-cause` and is flagged stale; and `collectAnchorReferences` is correctly described as a bare-`#id` matcher, not a `[text](#id)` link matcher, which widens rule 1's population.

_Recorded through the declared `review-prep` operation._
