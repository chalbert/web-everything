# Creator-owed proof, not reviewer re-derivation — burden of proof in code review

**Date**: 2026-08-27
**Point**: Prep research for the decision "A reviewer may answer 'unverifiable as submitted' — a creator-proof gap, not a verdict." Six bodies of prior art surveyed; four give solid, citable support, two come back weaker than hoped and are flagged as such rather than oversold.
**Plan file**: none — spawned directly from the operator's brief, not a `plans/` file.
**Research page**: `/research/creator-owed-proof-not-reviewer-rederivation/`

---

## Question

The operator's complaint: reviewers do a lot of verification work that should have been the creator's to discharge — sometimes going "very far" to check a claim the creator could have proven cheaply at write time. Should a reviewer be able to answer **"unverifiable as submitted"** — distinct from accept/changes, a refusal to do the creator's proof work rather than a verdict on correctness — and should that refusal be captured as a structured, attributable creator-side gap that harvests forward into dispatch briefs, prep checklists, and gates?

## Recommendation

Yes, with a bounded line so it cannot become "the reviewer refuses everything": the refusal is gated on a conjunctive test (a load-bearing claim, cheaper for the creator to have proven than for the reviewer to re-derive, and the reviewer must state what it actually tried). Full ruling in the decision item.

## Key findings

**1 — Design by Contract (Meyer).** DbC's caller/callee division of labor is the sharpest structural precedent: the client (caller) is obligated to satisfy preconditions before calling; the supplier (callee) is obligated to satisfy postconditions *given the precondition holds*, and is explicitly not obligated to re-check it — "either the condition is part of the precondition and must be guaranteed by the client, or it is not stated in the precondition and must be handled by the supplier ... never in both," an "absolute rule" opposed to defensive double-checking. **Caveat**: I could not pull a clean, page-cited verbatim quote from Meyer's own PDFs (both scanned sources at se.inf.ethz.ch resisted extraction); the paraphrase above is corroborated across independent secondary sources and matches OOSC2's "Design by Contract" chapter as widely and consistently cited, but should not be presented as word-for-word without a text copy in hand. The analogy is about *runtime* obligation (who checks at execution time), not review-time evidence — borrow the shape of the argument, not a literal review-process precedent.

**2 — TDD / red-green (Beck).** *Test-Driven Development: By Example* states two rules, widely and consistently quoted: "write new code only if an automated test has failed" and "eliminate duplication." This makes the failing-then-passing test the creator's proof artifact, produced before/alongside the claim, machine-checkable by a third party without hand-verification. I did not find Beck stating a "code is not done until…" framing in exactly that language — that is a reasonable restatement, not a confirmed quote. This is the strongest fit for the *machine-checkable evidence* requirement specifically.

**3 — Falsifiability (Popper) and Dijkstra.** Dijkstra's line is confirmed with primary-source citation: **EWD249** ("Notes on Structured Programming," 1970), section "On The Reliability of Mechanisms" — *"Program testing can be used to show the presence of bugs, but never to show their absence!"* — with a related, slightly different phrasing in "The Humble Programmer" (1972 Turing lecture, *CACM* 15(10)). Popper's falsifiability, connected to testing via Kaner/Bach/Pettichord's *Lessons Learned in Software Testing* (2001), is corroborated across secondary sources but not pinned to a verbatim page. **I did not find literature that explicitly frames code *review* (as opposed to testing) in Popperian terms** — "a reviewer's job is to falsify, not verify exhaustively" is this session's synthesis, not a documented claim. Flagged as such rather than oversold.

**4 — Author-supplied-test-as-gate policies.** Google's public eng-practices docs (`google.github.io/eng-practices`) state plainly: *"we expect developers to test CLs well-enough that they work correctly by the time they get to code review,"* putting initial proof burden on the author. I did not find explicit language that a CL *may be rejected solely* for missing tests, nor a documented reviewer right to decline re-derivation — the docs assume shared responsibility, not the specific "unverifiable as submitted" verdict this item proposes. Bacchelli & Bird's ICSE 2013 paper on modern code review at Microsoft was confirmed to exist and scope, but its full findings text was not retrievable in this pass — do not cite it as directly supporting the burden-shift thesis without pulling the PDF.

**5 — Google Tricorder (Sadowski et al.).** Confirmed: "effective false positive rate" is user-centric ("any report [the user] did not want to see"), Tricorder held under 5% against a 10% target, and the predecessor FindBugs effort saw 84% of filed bugs go unfixed. **The lesson runs in the opposite direction from a naive reading of this item**: Tricorder's fix was to put the burden of making a finding *actionable* on the tool/process side, not to push more unverified claims onto a human. This is a real, citable precedent for "an unactionable assertion may legitimately be rejected/deprioritized" — but it is about *tool-generated* claims a developer must triage, not *human-generated* claims a reviewer must adjudicate. Cite it for the actionability principle, not as direct support for the burden-shift direction.

**6 — Self-certification effectiveness.** No software-specific, code-review-focused study was found demonstrating that forced self-certification gets gamed or rubber-stamped. The strongest documented analogy is NYC's Department of Buildings Self-Certification program, criticized and investigated for abuse — a real case, but a building-code domain, not software. Industry claims about PR rubber-stamping rates circulate widely but trace to blog posts, not peer-reviewed studies. **This is recorded as an open gap, not a settled citation** — the item's requirement that "prove it" mean machine-checkable evidence (never a bare checkbox) rests on general principle (Popper/Dijkstra: an untested claim is unfalsified, not verified) and on the adjacent-domain NYC case, not on a dedicated study.

## What this means for the item

Four of six areas (1, 2, 3's Dijkstra half, 4) give solid, quotable, honestly-scoped support. Two (5, and the Popper-to-review connection in 3) are real but do not say exactly what a naive citation would want — recorded at the strength the evidence actually supports, per this program's own standing rule against overclaiming (we:backlog/3362/, ratified). Item 6 is an open gap, named rather than papered over.

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-08-27-creator-owed-proof-burden-shift.md` | created (this file) |
| `we:src/_data/researchTopics/creator-owed-proof-not-reviewer-rederivation.json` | created |
| `we:src/_includes/research-descriptions/creator-owed-proof-not-reviewer-rederivation.njk` | created |
| `we:backlog/xsuqas6-a-reviewer-may-answer-unverifiable-as-submitted-a-creator-pr.md` | authored (decision item) |
