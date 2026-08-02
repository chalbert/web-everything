---
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
- **`x2vqz2v`** — verbatim duplication between a new anchor and the anchors it links must become a link.

None of them fires on instance 5 (the owed-work pointers) — that needs the back-link clause tracked as `xl5yhja` —
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
   `precedent` → `resolved`; `owed` / `build-pending` → not `resolved`, per `xl5yhja`).

## Why it matters

The statute layer is cite-able authority — a false claim inside it is not a typo, it is case law. All five instances
above were caught only because a human ran three review rounds with fresh-context lenses that re-read the sources. At
mechanized volume that will not happen: the conveyor's whole premise (#2851) is that convergent review runs without a
person, so the check has to be in the mandate and the gate, not in the reviewer's diligence.

## Provenance

Filed at the operator's direction after the human `/review` accept on **PR #982** (the decision landed as **#2851**).
The individual preventions were filed as #2842–#2850 and `x2vqz2v`; this item names the **class** they are surfaces
of, which the round-3 review noted was tracked nowhere. Related: #2842, #2850, `x2vqz2v`, `xl5yhja`, #2823
(the prevention-introspection discipline this generalizes).
