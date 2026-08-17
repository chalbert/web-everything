---
bornAs: xo9tlnu
kind: decision
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-17"
relatedTo: ["2576", "2649", "2575", "3114", "2577", "1034"]
relatedReport: reports/2026-08-17-judge-grading-instruments.md
tags: []
---

# Reconcile #2576 per-option 1-5 ratings text against jury-core verdict model

**The conflict dissolves on inspection; prep's job was to prove that, not to manufacture a choice.** #2576's
*per-option 1–5 rating* and jury-core's *categorical verdict* grade **different objects** — one subject
judged by a lens, versus candidate A against candidate B. The engine has no candidate axis at all, so the
gap is **dimensional, not lexical**. Everything else the card frames as a call is **already ruled** — by
shipped code, by `#blast-radius-advisory-care-not-a-gate`, and by
[#1034](/backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w/), which already ratified a 1–5 scale here as *advisory,
never a gate*. Those settled answers are tabled below with citations. **One narrow either/or survives:** what
WE's method doc does with moves 3–4. Grounded in
[/research/judge-grading-instruments/](/research/judge-grading-instruments/).

## Recommended path at a glance

| fork | recommended default | main alternative (rejected) | confidence |
| --- | --- | --- | --- |
| Fork 1 | **Keep moves 3–4 in WE's method doc — move 3 re-pointed at the instrument WE already ships, move 4 kept as a timeless rule with no build-status prose, its WE realization filed as its own item carrying the graduation trigger** | delete moves 3–4; option-selection is plateau-app practice, and WE's method doc covers only what WE runs | Med — two skeptic rounds took opposite sides |

## Settled on inspection — no ruling needed

Each of these was filed by prep as a candidate fork and **refuted**; the citation that settles it is named.
Recording them is the point of the item, since the card's own framing rests on the first one being open.

| the card's premise | why it is settled |
| --- | --- |
| "verdict vs 1–5 — pick one" | They grade different objects. Not rival branches, so no ruling. The engine's subject is one thing judged by N lenses; the method's move 3 is N candidates judged against each other |
| "jury-core is missing the rating instrument" | The *shape* the prior art prescribes — closed labelled grades reduced by a bar — **already ships**, though on the **finding** axis, not the option axis: `IMPACT_LEVELS` (`we:scripts/lib/jury-core.mjs:190-195`) is a closed four-step ordinal grade, each step carrying a written descriptor in `IMPACT_GLOSS` (`:203-208`), tested against a configurable bar `PREVENTION_IMPACT_BAR` (`:257`) by `blocksAcceptance` (`:530-534`). So WE is not missing the *instrument design*; it is missing an *option axis* to apply it to — which is Fork 1's subject, and its level words would be the option axis's own, not these |
| "how should juror grades combine?" | **Already codified.** `AGGREGATION` (`we:scripts/lib/jury-core.mjs:694`) is a frozen single-member enum returned on every rigor dial (`:728`), docblocked "*Aggregation is ALWAYS diversity-selection, never a vote*" (`:701`), derived from `#blast-radius-advisory-care-not-a-gate` **clause 3**. Nothing to rule, and a mean was never on the table in the engine |
| "does WE forbid numeric grading?" | No — and it must not, because [#1034](/backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w/) is `status: resolved` with `codifiedIn: we:docs/agent/vision-tiers.md#design-critique-rubric-ratified-1034`, ratifying "a fixed **closed** set of scored axes (1–5) **plus** an open-text list of localized findings" (`we:docs/agent/vision-tiers.md:127-132`). It composes because those scores are **advisory + training signal, never a reducer** — `we:skills-src/review-design/SKILL.md:44`: "Output is advisory, not a gate. A low score is a finding to discuss, never a build failure" |
| "where would an option-comparison module live?" | Not a fork. `we:scripts/lib/jury-core.mjs:1359-1384` does **not** forbid a set-shaped subject — `subject` is a subject *kind*, `extractTouchSet(input)` takes any shape, and the design-pixels adapter already accepts a plural `surfaces` array (`we:scripts/lib/design-pixels-adapter.mjs:145-170`). Placement is a normal build call when a consumer lands |
| "which shape does #2575's field follow?" | The verdict enum, as it already does (`we:backlog/2575-decision-record-schema-persist-rationale-so-decisions-are-ex.md:114-134`). The `jurorRatings` → `jurorVerdicts` rename is a mechanical entailment inside #2575's own build, not a ratification |
| "the method doc contradicts itself" | Only in one illustrative sentence. `we:docs/agent/jury-refinement-method.md:51` reasons in averages ("a 4.5-vs-4.4 is a coin-flip") while `:42-45` and `:102-105` forbid collapsing a split. A two-word doc correction, carried by Fork 1's edit — not a statute |

## Fork 1 — What WE's method doc does with moves 3–4

*Why this is a fork:* **genuine either/or** — one text, one instruction; WE's method doc cannot both carry an
option-selection protocol and not carry it, so the composability probe fails. The branches are demonstrably
both coherent: prep ran **two independent skeptic rounds and they took opposite sides** — round 1 refuted
"keep" and recommended retiring the moves; round 2 refuted "retire" and recommended keeping them with
amendments. Two adversarial passes landing on opposite branches is what a real either/or looks like.

**Crux — and it is behavioural, not editorial.** Move 4 is an *instruction that changes which ruling an
agent lands on*: "top option below threshold → flag it weak, search for new candidates, **keep the old**"
forbids settling on the least-bad option anyone happened to enumerate. Delete it and no WE-side ruling agent
is ever told that. The reach is **two surfaces that restate moves 3–4 verbatim**: `we:AGENTS.md:61` (the
Tier-0 router) sends any high-leverage fork-ruling to this doc and names "per-option 1–5 ratings →
weak-flag + search" in the router row itself, and `we:docs/agent/build-ui.md:133-134` and `:260` restate
them as phase-4 procedure. (`we:skills-src/design-committee/SKILL.md:8-9` is **not** a third — it defers to
one *named* section, *When to run the full jury* (`we:docs/agent/jury-refinement-method.md:15-29`), which
this call does not touch. Prep's earlier draft miscounted it; the independent review caught that.) So two
live surfaces hand a downstream agent a different instruction depending on this call.

`we:docs/agent/jury-refinement-method.md:47-58` states moves 3–4 (rate 1–5 · weak-flag ·
candidate-search) as mandatory method and `:99` repeats "rate, don't just pick" as a guardrail. Against
that, **nothing in WE implements either move**, and prep confirmed the two apparent WE-side *implementation*
consumers are not ones:
[#3114](/backlog/3114-extend-6e-mint-uc-a16-the-escalated-scope-breach-amber-resol/) `:60` cites
`plateau-app:docs/backlog-console-design.md` §6e, **not** the WE doc, and
`we:skills-src/design-committee/SKILL.md:44-48` already names its own cross-candidate route (the
`we:docs/agent/build-ui.md` step-4 explainer channel). So WE's neutral method home documents a protocol whose
only practitioner is one product.

- **(a) Keep, re-shaped and status-free.** Move 3 stays **on the option axis** — it still grades candidates
  against each other, which is the whole point of the axis — but its *instrument* is restated as **a closed
  labelled ordinal grade with a written descriptor per level, tested against a bar, never averaged**, in
  place of a bare 1–5 scale. `IMPACT_LEVELS` / `IMPACT_GLOSS` / `PREVENTION_IMPACT_BAR` are cited **only as
  WE's existing worked instance of that shape** (on the finding axis) — a *form* to copy, **not** a
  vocabulary to reuse: grading a design candidate `cosmetic`→`unrecoverable` would be nonsense, and the
  option axis needs its own level words. The `:51` average illustration is struck. Move 4 (below-bar →
  search for new candidates, **keep the old**) stays as a **timeless method rule with no build-status
  prose**; its WE realization is filed as its own backlog item carrying the graduation trigger, and the doc
  links that item by id and says nothing else about what is built. ← **recommended**
- (b) Delete moves 3–4 from WE's method doc. Option-selection is plateau-app product practice; WE's method
  doc covers what WE runs, and `we:docs/agent/build-ui.md:133-134` / `:260` are corrected to match.
  *Rejected* — but this is a close call, and round 1's skeptic recommended it.

**Why (a).** The behaviour move 4 instructs is the single best-corroborated idea in #2576, reinvented
independently across a century of practice: **Pugh Controlled Convergence** (whose documented main payoff is
ideation *between* matrix runs — the matrix exists to send you back to generate better concepts, not to
crown a winner), the **Nobel** reserve clause (withheld 49 times since 1901), **AIA**'s 2018 no-winner,
**EFQM**, **IDSA IDEA**, **Myerson**'s optimal reserve price (independent of the number of bidders), and
**Simon**'s satisficing threshold. Deleting it costs a real, evidence-backed instruction and buys only a
shorter doc.

*Not* a reason for (a), though prep's earlier draft offered it: "a neutral method home should record correct
method it does not run" is not a contested principle here — `we:docs/agent/design-first.md` and
`we:docs/agent/build-ui.md`'s mock-before-build phase already document method WE runs no code for, so that
precedent is settled and cuts no ice either way. The fork turns on the instruction, not on the principle.

**The honest case for (b), and the amendment that answers it.** A doc section with no WE implementation, no
WE consumer, and no delivery date is documentation debt, and a reader who follows move 3 today finds nothing
to run. Prep's first draft answered this by writing "not implemented in WE" plus an un-gate trigger *into the
doc* — and round 2 was right that this is the wrong shape. So **(a) forbids that**: no build-status prose in
the doc at all. The status lives on a filed item, exactly as
[`#statute-anchor-states-rule-not-status`](../docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status)
(#2854, ratified 2026-08-17) prescribes — *cited here as persuasive discipline, not authority*, since that
anchor's own scope is **statute-anchor prose**, not any doc. Its stated rationale (ADR, IETF RFC+errata,
MDN Baseline all separate rule from status; in-place status prose went stale twice in two weeks) applies
just as well to a method doc, so the discipline is adopted voluntarily.

**Graduation trigger for the filed realization item:** a **second** practitioner outside plateau-app needing
programmatic candidate-ranking — `/design-committee` routing candidate forks through code rather than the
explainer channel is the named candidate. One practitioner → the method stays documented practice; two →
build it. This mirrors the *pattern* of
[`#thin-container-graduation-trigger`](../docs/agent/platform-decisions.md#thin-container-graduation-trigger)
("one consumer → preset; two → block"), **cited as precedent, not authority** — that anchor's own scope is
APG composite-widget containers and does not reach a method-doc question.

`Skeptic:` SURVIVES-WITH-AMENDMENT, after two rounds that reached opposite verdicts. Round 1 REFUTED "keep":
it proved both claimed WE-side consumers evaporate (#3114 cites plateau-app's doc; design-committee already
has its own route), emptying the original rejection reason for (b). Round 2 REFUTED the repaired version for
a different reason — the "mark it unimplemented in the doc" marker narrates build status in durable prose.
Both amendments are folded in: (b) is now stated as a live contender on its real strength (documentation
debt), and (a) carries **no status prose**, filing the realization as an item instead. Round 2's two
A third pass — an **independent review of the prep PR** — then corrected three
things prep had asserted: the #1034 backlog slug was invented rather than read off disk (six dead links),
`we:skills-src/design-committee/SKILL.md:8-9` was miscounted as a third affected surface when it defers to a
section this call does not touch, and option (a)'s "re-point at `IMPACT_LEVELS`" equivocated between copying
that instrument's *shape* and reusing its *finding-axis vocabulary*. All three are fixed above; (a) now says
explicitly that move 3 stays on the option axis with its own level words. Round 2's two
"decisive" anchors were themselves run through the citation-scope check and both proved **scope-limited** —
`#statute-anchor-states-rule-not-status` governs statute-anchor prose, `#thin-container-graduation-trigger`
governs APG containers — so each is cited above as discipline/precedent rather than authority, and the
default rests on its own merits. Round 2 also correctly caught prep asserting that
`plateau-app:docs/backlog-console-design.md` §6e "used a mean": §6e names **no aggregator**, so that claim
and the consequential edit built on it were struck.
`Screen:` clear, with the crux swapped on the screener's instruction. Q1 clear — `we:AGENTS.md:61` routes
fork-ruling here and `we:docs/agent/build-ui.md:133-134` restates moves 3–4 as procedure, so what the doc
instructs is a consumer-visible contract, and (a) re-shapes only this repo's own agent-facing method text,
never a Frontier UI implementation. Q2 clear **but the stated merit axis was rejected as a rationalization**:
the screener showed `we:docs/agent/` routinely documents method WE runs no code for, so
"precedent-consistency" was uncontested. It supplied the stronger axis instead — **move 4 changes agent
behaviour, not just reading matter** — and the crux above was rewritten to that. Residue scan over the whole
body: none.

---

## Context

### Known occurrences — where the grading pattern already runs

| system | the instrument | the aggregator |
| --- | --- | --- |
| **Gerrit** (`Code-Review −2…+2`) | ordinal ballot with numeric names + written label text | `MaxWithBlock` — one `−2` vetoes; never summed |
| **GitHub PR reviews** | three states (approved / changes-requested / commented) | any changes-requested blocks |
| **W3C Process** | consensus / dissent / Formal Objection | no counting; a Formal Objection escalates to Council |
| **NIH study section** | 1–9 criterion scores | impact score explicitly **not** an average of them |
| **This repo, #1034** | closed 1–5 scored axes + open findings (`we:docs/agent/vision-tiers.md:127-132`) | **advisory only — never a gate** |
| **This repo, §6e** | 1–5 across four lenses, `< 3.5` flags weak (`plateau-app:docs/backlog-console-design.md`) | **unspecified in the text** — prep's earlier "mean" reading was an inference and is withdrawn |
| **This repo, jury-core** | `IMPACT_LEVELS` closed ordinal + `IMPACT_GLOSS` descriptors | bar + diversity-selection (`AGGREGATION`) |

The through-line the survey found: every system that ships at scale reduces by **max-with-block or a
veto**, never by an average — and where numbers appear (Gerrit, NIH, #1034) they are sort keys, permission
tiers, or advisory signal, never a quantity that gets combined.

### Framing correction — what "amend #2576" can and cannot mean

The card's option (a) reads "amend #2576's text." That is a category error twice over. #2576 is
`status: resolved`; per [`we:docs/agent/backlog-workflow.md`](../docs/agent/backlog-workflow.md), *"once
ratified, the call is immutable — never reshape a ratified decision… route the late finding to a new
follow-up item"* — **#3128 is that item.** And #2576's body was never the method's home: the home is
`we:docs/agent/jury-refinement-method.md:1-8`, which says so in its own header. So the reconciliation edits
the doc and records the ruling here; it never retro-edits #2576.

### Consequential edits this ruling authorizes

Spun as `blockedBy` build items at graduation — not pre-filed, since they turn on the ruling:

1. `we:docs/agent/jury-refinement-method.md` — moves 3–4 per Fork 1; strike the `:51` average illustration
   (owed under **either** branch).
2. `we:docs/agent/build-ui.md:133-134`, `:260` and `we:AGENTS.md:61` — the matching correction to the
   phase-4 pointers and to the Tier-0 router row, which names the 1–5 ratings verbatim.
3. Under Fork 1 (a) only: file the move-4 WE-realization item carrying the second-practitioner graduation
   trigger, and link it from the doc by id.
4. [#2575](/backlog/2575-decision-record-schema-persist-rationale-so-decisions-are-ex/) — the
   `jurorRatings` → `jurorVerdicts` rename, inside its own build.

*Deliberately not authorized:* any edit to `plateau-app:docs/backlog-console-design.md` §6e. Prep's earlier
draft proposed rewriting its threshold on the inference that it averages; §6e names no aggregator, so there
is nothing established to correct.

### Incidental defect found during prep (file separately, does not block this decision)

`we:scripts/lib/jury-ledger.mjs:338` types `FoldedJuror.verdict` as
`'accept'|'changes'|'needs-human'|null` — **missing `prevention-outstanding`**, so the typedef is non-total
over `VERDICTS`. The `@verdicts-total` gate (`we:scripts/lib/verdict-totality.mjs`) discovers marked
structures, not JSDoc unions, so it does not catch this. Worth a follow-up item for both the fix and the
gate widening.

### Predicted touch-set (#2619)

`we:docs/agent/` · `we:backlog/2575-decision-record-schema-persist-rationale-so-decisions-are-ex.md`. Each
carved child takes only **its own slice** — the method/build-ui doc reconciliation gets `we:docs/agent/`, the
schema rename gets the single backlog file — so the children stay disjoint and parallelizable.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (this decision touches statute-adjacent method text and gate-adjacent machinery). This
jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

### Lineage

Surfaced while preparing [#2575](/backlog/2575-decision-record-schema-persist-rationale-so-decisions-are-ex/)
(decision-record schema), whose field needed to know which shape is authoritative. Reconciles
[#2576](/backlog/2576-jury-refinement-method-reusable-template-for-high-leverage-u/) (resolved — the
ratified method) against epic
[#2649](/backlog/2649-jury-core-subject-agnostic-jury-engine-thin-skill-ratified-f/) (resolved — the shipped
engine), and composes with [#1034](/backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w/) (resolved — the ratified
1–5 design-critique rubric). Parent method epic: #2577.
