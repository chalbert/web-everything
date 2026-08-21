---
bornAs: xi4syme
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, review, prevention, citation, mandate, statute-lint]
---

# A cited claim must be verified against the cited text before it lands — close the cite-from-title class

The same defect recurred in all four rounds of the human `/review` on PR #982: an author made a confident factual
claim about another rule or item, written from memory of its **title** rather than its **text**, and the claim was
false. Every instance was fixed; the habit was not. Three lints now catch three surfaces of it, but nothing states
the class or covers claims outside statute anchors. Name the rule and give it a home.

## The four instances

| round | the claim | the text |
| --- | --- | --- |
| 1 | `#deterministic-oracle-clears-slice` cited #2834 as a **cleared precedent** — "cleared on that green fidelity oracle, not on a human sign-off" | #2834 and its oracle #2811 were both `status: active`; #2811 was tagged `human-verify` with "do NOT auto-resolve on tests-green alone" |
| 2 | invariant 1 set the independence bar at "a **separate session or service**" and called it "the same non-author invariant #2398 sets" | #2398 ratified **option B** — an in-process editor↔reviewer loop; independence "rests entirely on a distinct fresh validator". The anchor **narrowed** #2398 under a `composes with — does not alter` label |
| 2 | `#human-required-is-judgment-only` claimed "the same three triggers #2771 enumerates" | #2771's third trigger is "an **un-ratified decision**", not "a novel design fork" — a substitution that narrowed the human gate |
| 2 | the anti-self-clearing paragraph listed "a non-author signal required on the oracle diff" as an existing #2398 guard | #2398's guards are: read-only/diff-gated test files, land fails on dropped or skipped coverage, a logic fix carries a pre-change-failing test, validator inspects for tampering. No non-author signal — and the same PR listed it as **owed** |
| 3 | four anchors said enforcement is "owed on the OPEN conveyor-mechanization line (#2840 / #2785)" | the nine guards are `parent: 2822`; #2785 and #2840 have **zero** reviewer-id or session/service scope. Real owners: #2843 / #2844 / #2848 |

## Gap

Three lints are filed and each catches one surface, all of them scoped to `we:docs/agent/platform-decisions.md`
anchor bodies:

- **#2842** — a `#NNNN` cited in *precedent framing* must resolve to a `status: resolved` item (catches instance 1).
- **#2850** (as widened) — a `composes with — does not alter` claim must be *true*, not just labelled (catches
  instances 2 and 3).
- **#2852** — verbatim duplication between a new anchor and the anchors it links must become a link.

None of them fires on instance 5 (the owed-work pointers) — that needs the back-link clause tracked as `2856` —
and none fires at all on a claim about a backlog item, a code path, or a contract field made **outside** a statute
anchor. The class is wider than its three filed surfaces.

## Mechanical fix

Two halves, cheapest first:

1. **Mandate half (immediate, no code).** Add a verification clause to the reviewer/editor mandate in
   `we:scripts/lib/review-core.mjs` (`buildSubjectMandate`, the single skeleton `buildMandate` /
   `buildPanelMandate` frame into, so all four surfaces inherit it): *any factual claim the diff makes about another
   rule, item, contract field, or code path must be checked against that source's text in this round; a claim the
   reviewer cannot trace to the cited body is a finding.* This is the only half that covers claims outside statute.
2. **Gate half.** Generalize the three anchor-scoped lints into one citation-verification pass in
   `we:scripts/lib/validate-rules-anchors.cjs` that runs over ALL `we:docs/agent/*.md` rendered docs and over
   `kind: decision` backlog bodies, not just `we:docs/agent/platform-decisions.md` anchors: every `#NNNN` cited with
   a factual predicate must resolve, and its `status` must be consistent with the predicate (`cleared` /
   `precedent` → `resolved`; `owed` / `build-pending` → not `resolved`, per `2856`).

## Why it matters

The statute layer is cite-able authority — a false claim inside it is not a typo, it is case law. All five instances
above were caught only because a human ran three review rounds with fresh-context lenses that re-read the sources. At
mechanized volume that will not happen: the conveyor's whole premise (#2851) is that convergent review runs without a
person, so the check has to be in the mandate and the gate, not in the reviewer's diligence.

## Provenance

Filed at the operator's direction after the human `/review` accept on **PR #982** (the decision landed as **#2851**).
The individual preventions were filed as #2842–#2850 and #2852; this item names the **class** they are surfaces
of, which the round-3 review noted was tracked nowhere. Related: #2842, #2850, #2852, `2856`, #2823
(the prevention-introspection discipline this generalizes).

## Design

Two corrections to the *Mechanical fix* above, both from reading the tree on 2026-08-21 — make them before
building, or the item lands in the wrong file and rebuilds something that exists.

**Correction 1 — `buildSubjectMandate` does not live in `we:scripts/lib/review-core.mjs`.** It is exported
from `we:scripts/lib/jury-core.mjs:1445` and *imported* by `we:scripts/lib/review-core.mjs:125`, which is why
`buildMandate` (`we:scripts/lib/review-core.mjs:271`) and `buildPanelMandate` (`:1051`) both frame into it.
The single-skeleton reasoning in the mandate half is right; the file is wrong. The clause goes in
`we:scripts/lib/jury-core.mjs`, in the same `[...].join(' ')` list that already single-sources the #2950
disposition block and the #2823 prevention-introspection block — those two are the shape to copy, including
their "required, for EVERY finding" framing and the explicit statement of what happens when the field is
omitted (silence must cost, not save, a round).

**Correction 2 — the gate half is partly built, and wider than this card assumes.** #2842 landed as
`validateCitedItemStatusClaims` (`we:scripts/lib/validate-rules-anchors.cjs:444`), and `runStatuteCheck`
(`:520`) already feeds it `srcByDoc` built over **every** entry in `RULE_DOCS`
(`we:scripts/lib/rules-loader.cjs:29`) — `platform-decisions`, `block-standard`, `backlog-workflow`,
`vision-tiers` — not just the statute doc. So "generalize the anchor-scoped lints to run over all
`we:docs/agent/*.md`" is **already true for the four registered rule docs**. What genuinely remains:

- **`kind: decision` backlog bodies are not scanned at all.** `runStatuteCheck` reads `backlog/` only for
  `codifiedIn` cites (`collectCodifiedCites`, `:32`) and item statuses (`collectItemStatuses`, `:310`), never
  for cited-claim text. That is the real extension, and `collectItemStatuses` is the status oracle it needs
  — already built, already passed in as `statusOf`.
- **Predicate consistency beyond status.** The landed rule keys on explicit status words
  (`CLAIM_STATUS_WORDS`, `:385`) and the `OPEN` token (`:404`). The `cleared`/`precedent` → resolved and
  `owed`/`build-pending` → not-resolved predicates this card names are additional claim families in the same
  scanner, not a new scanner.
- Unregistered docs under `we:docs/agent/` (anything outside `RULE_DOCS`) are still unscanned — widening the
  corpus is a one-line change to how `srcByDoc` is built, and it is worth deciding deliberately whether the
  claim rules should apply to all of them or only the four rule docs.

**Sequencing.** The mandate half is a text edit with a unit test and no dependencies — do it first and alone;
it is the only half that covers claims made outside a statute anchor, which is the class this card names.

## Done when

1. **tier 1 — the clause is in the skeleton, so every surface inherits it.**
   `we:scripts/lib/__tests__/jury-core.test.mjs` asserts `buildSubjectMandate` output contains the
   verification clause, and `we:scripts/lib/__tests__/review-core.test.mjs` asserts it is present in the
   strings returned by **both** `buildMandate` and `buildPanelMandate` — proving inheritance rather than
   three copies. Fails before — no such clause exists in `we:scripts/lib/jury-core.mjs`.
2. **tier 1 — a cited claim in a `kind: decision` body is checked.**
   `we:scripts/__tests__/rules-anchors.test.mjs` pins `validateCitedItemStatusClaims` over a decision-body
   fixture: a body claiming a cited `#NNNN` is a *cleared precedent* while `statusOf` reports it non-resolved
   yields an error; the same body with a resolved cite yields none. Fails before — backlog bodies are not
   fed to the scanner.
3. **tier 1 — the `owed` predicate.** The same file pins the inverse family: a body describing a cited
   `#NNNN` as *owed* / *build-pending* while `statusOf` reports it `resolved` yields an error.
4. **tier 2 — no new gate errors on the live corpus.** `npm run check:statute` and `npm run check:standards`
   both exit 0 against the current tree after the widening, or every new error is fixed in the same pass.
   The widened corpus firing on real historical text is expected; leaving it red is not.
5. **tier 3 — the class is named where an author will meet it.** `we:docs/agent/backlog-workflow.md` (or the
   statute anchor this item codifies into) states the rule in one sentence and lists which surfaces enforce
   it, so #2842 / #2850 / #2852 / `2856` read as instances of a named class rather than four unrelated lints.

The commands that decide 1-4:

```
npx vitest run scripts/lib/__tests__/jury-core.test.mjs scripts/lib/__tests__/review-core.test.mjs scripts/__tests__/rules-anchors.test.mjs
npm run check:statute
npm run check:standards
```

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — Card explicitly re-verified its own mechanical-fix design against the live repo on 2026-08-21 (Correction 1/2) and both corrections check out exactly: buildSubjectMandate is at we:scripts/lib/jury-core.mjs:1445 (not we:scripts/lib/review-core.mjs as the original mechanical-fix draft assumed), and runStatuteCheck (we:scripts/lib/validate-rules-anchors.cjs:520) already builds srcByDoc over all four RULE_DOCS (we:scripts/lib/rules-loader.cjs:29-34), so the anchor-scoped-lint generalization is already partly built — exactly the kind of premise check the taxonomy calls for.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Widening validateCitedItemStatusClaims to scan kind:decision backlog bodies is a real, non-trivial blast radius: 498 kind:decision items exist in we:backlog/, and a rough proxy for the existing CLAIM_A/B/C regexes hits ~138 candidate lines across them. The card does not pre-measure this, but Done-when tier 2 requires npm run check:statute and npm run check:standards to exit 0 on the live corpus after widening ('every new error is fixed in the same pass'), which forces the same discipline reactively rather than proactively — real work, but not silently skipped.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified via ES-import grep that buildSubjectMandate (we:scripts/lib/jury-core.mjs) is called directly by at least three adapters beyond we:scripts/lib/review-core.mjs — we:scripts/lib/decision-prose-adapter.mjs and we:scripts/lib/design-pixels-adapter.mjs — confirming the card's claim that placing the clause in the skeleton (not in we:scripts/lib/review-core.mjs) is required for all surfaces to inherit it, and that check:statute/check:standards (we:scripts/check-statute.mjs, we:scripts/check-standards.mjs) are the subprocess callers of runStatuteCheck the card names.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when tier 1 items are stated as red-before-green ('Fails before — no such clause exists' / 'Fails before — backlog bodies are not fed to the scanner'), and the fixture-injectable test scaffolding for validateCitedItemStatusClaims already exists in we:scripts/__tests__/rules-anchors.test.mjs with doc()/statuses() helpers, so extending it with decision-body fixtures is a proven, non-speculative pattern rather than a guard that could pass vacuously.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The existing push() error format in we:scripts/lib/validate-rules-anchors.cjs:449-455 names the doc:line twice and states the fix, and the mandate clause routes into the existing 'Judge only: report concrete findings' framing — both surface failures as explicit findings/errors, not silence.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._
