---
bornAs: x8lmsau
kind: decision
parent: "2676"
status: open
blocks: ["2696"]
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
tags: [design-studio, product-loop, slicing]
---

# Design-studio tool (#2676): which product-surface slice ships first

**Prepared 2026-08-16.** No new external prior-art survey was needed — this decision ratifies which piece of
*already-shipped-but-uncomposed* internal library code (jury engine, visual comparator, disposition judge, jury
ledger) a NEW Plateau product surface should wrap first; per we:docs/agent/backlog-workflow.md ("a decision that
only ratifies existing code still needs the concrete-refs check... but not a web survey"), the grounding below is
a **direct read of the actual library signatures**, not a `/research/` topic. One fork, with a bold recommended
default that survived an adversarial attack (see `Skeptic:` / `Screen:` below). Filed while preparing
[#2696](/backlog/2696-integration-phase-compose-parts-into-one-operable-page-integ.md) to build-ready
(2026-08-15): epic [#2676](/backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-comm.md)
has **zero product-surface code in either repo** — verified by grepping `plateau-app` and `webeverything` for
`design-studio`/`design_studio` and by `git log --all --grep="2676"` in both, which turns up only backlog `.md`
filings and two `docs/agent/*.md` skill-fold commits (#2708, #2706), never application code. The epic itself says
its four NEW pieces — (a) request-intake surface, (b) live committee-run + trace view, (c) proposed-vs-current
review surface, (d) ratify → build trigger — are "kept unsliced for now — a future /slice candidate." None of
the four has even been broken into a buildable slice yet, let alone built.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — which piece ships first | **(b) Committee-run + trace view** | (a) Request-intake surface | High — forced invariant, see justification below |

## Grounding — the actual library signatures a product surface would wrap

Verified live in `webeverything` (this lane) and `plateau-app`, 2026-08-16:

- **The jury ledger (the "trace")** already exists as a durable, foldable event log:
  we:scripts/lib/jury-ledger.mjs exports `readJuryLog`, `foldSubject`, `foldAllSubjects`, `listJurySubjects`
  (we:scripts/lib/jury-ledger.mjs:290). It already has one text consumer, we:scripts/conveyor/jury-tree.mjs,
  whose own header comment names the second, still-unbuilt consumer by number: *"the plateau-app #2642 console
  is the OTHER consumer of the same fold, rendered its own (graphical) way"* (we:scripts/conveyor/jury-tree.mjs:14).
  [#2642](/backlog/2642-juror-management-page-review-and-manage-jurors-from-the-cons.md) is itself `status:
  open`, `scope: ["plateau-app:src/"]`, and zero code exists for it (grepped `plateau-app/src` for
  `jury-ledger`/`juryLedger` — no hits). So a "committee-run + trace view" product slice would be the **first
  real product-facing consumer** of this fold, not a duplicate of work already underway.
- **The committee itself is already invocable with no new logic.** we:skills-src/jury/SKILL.md:62-64 documents
  the existing entry point — `/workflow subject-jury { "subject": ..., "careLevel": ..., "input": ..., "material":
  ... }` — which already runs the full design-pixels jury (we:scripts/lib/design-pixels-adapter.mjs) and produces
  a ledger via the same fold above. **Correction to this item's original text:** this is a `/workflow`
  orchestrator invocation (agent-driven), not a bare shell CLI — "CLI-triggered" in the prior draft overstated
  how mechanical the trigger is; a product surface would still need an agent/workflow runner behind it, not a
  plain subprocess.
- **The other two pieces have a hard data dependency on (b)'s output, not merely a sequencing preference.**
  we:scripts/lib/disposition-judge.mjs's `disposeVerdict({ ledger, config, ... })` (we:scripts/lib/disposition-judge.mjs:392)
  *requires* a `ledger` argument — the auto/human ratify-threshold piece (d) has nothing to operate on until a
  committee run has produced one. we:scripts/lib/visual-comparator.mjs's `compareToBaseline({ shotPath,
  baselinePath, ... })` (we:scripts/lib/visual-comparator.mjs:189) *requires* a `shotPath` — a rendered
  screenshot — which only a committee run (or a hand-faked stand-in) can produce; the proposed-vs-current review
  piece (c) has nothing to diff until then.
- **Updated finding on "why this blocks more than #2696" (2026-08-16).** Of the five sibling capability-story
  children filed under #2676 in the same session, re-checking their current status shows the original framing
  overstated how many are gated on this decision: **#2694** (full-scale interactive rendering) and **#2698**
  (interaction-model exploration) both resolved as doc/method folds into we:docs/agent/build-ui.md +
  we:skills-src/, needing **no** product surface at all. **#2695** (data-grounding lens) and **#2697** (red-team
  honesty lenses) both prepared as narrow `redTeamPrompt()` prompt edits in
  we:skills-src/jury/subject-jury.workflow.js, also independent of the product surface. **#2693**
  (case-taxonomy → webcases) turned out to duplicate already-in-flight work under #2709/#2717. **Only #2696**
  ("integration phase: compose parts into one operable page") is actually `blockedBy: ["3124"]` and genuinely
  waiting on this decision — the "blocks more than #2696" framing was accurate as a *hypothesis* at filing time
  but the other five did not, in the end, need this decision resolved first. This item's own leverage is
  therefore narrower than originally framed: it unblocks one concrete story (#2696), not three.

## Fork 1 — which of the four NEW pieces ships first

**Fork-existence justification (forced invariant, case (a)):** this is not a genuine four-way preference among
equally-buildable options. Per the grounding above, options (c) and (d) each *require* an artifact (a
`shotPath` screenshot, a `ledger`) that only option (b) — or a hand-faked stand-in for it — can produce; picking
either as the literal first slice means shipping code with nothing real to operate on. Option (a) is not
data-blocked the same way, but the item's original framing ("would ship inert until (b) exists") holds: a
request-intake form with no committee to hand its brief to collects input the tool cannot yet act on. Only
option (b) needs no artifact from any of the other three and can be exercised today with a stubbed/manual input
(the existing `/workflow subject-jury` call already accepts free-form `input`/`material`, so no bespoke intake
schema has to be invented first). That makes three of the four branches *excluded* (would ship broken/inert as
a first slice), not merely less attractive — a forced invariant, not a weighed preference.

- **(a) Request-intake surface** — the front door (plain-language "I want a screen that…" → design brief).
  *Rejected as first:* nothing downstream exists yet to consume a submitted brief; the surface would collect
  input the tool cannot act on.
- **(b) Committee-run + trace view** — kick off / watch the committee, render the jury ledger fold live.
  **Recommended default.** Needs no output from (a)/(c)/(d); reuses `/workflow subject-jury` (already-built)
  and the jury-ledger fold (already-built, already has one text consumer to pattern-match). Unblocks #2696, the
  one sibling actually gated on this decision.
- **(c) Proposed-vs-current review surface** — the visual diff + trace review a human ratifies against.
  *Rejected as first:* `compareToBaseline` requires a `shotPath` that only a committee run produces.
- **(d) Ratify → build trigger** — the auto/human threshold + conveyor hand-off. *Rejected as first:*
  `disposeVerdict` requires a `ledger` that only a committee run produces.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attacked on four axes. *Merit:* considered whether (a) should go first to
avoid designing (b)'s input shape blind — refuted, because `/workflow subject-jury`'s existing generic
`input`/`material` shape already gives (b) something real to consume without inventing a bespoke intake schema,
so there's no blind-design risk to trade off. *Classification:* the strongest attack — is this fork actually
prioritization/sequencing in disguise (this repo's own standing rule: "cost/effort/sequencing is never a fork
branch... if both branches agree on the end-state and differ only on when, there is no design decision, only a
backlog ordering")? This reclassified the fork from "a genuine four-way preference" (which it is *not*) to a
**forced invariant** (case (a) of the standing test): (c) and (d) are technically inoperable as a first slice,
not merely less-preferred-for-now, so the fork survives as a real decision — but the original recommendation
text ("that is the *smallest slice*...") smuggled in cost/effort language that the not-a-prioritization rule
forbids; struck and replaced with the data-dependency justification above (see `Screen:`). *Statute-overlap:*
N/A — this decision sets no `codifiedIn` and does not touch a standards-layer (intent/protocol/block) contract;
it is an internal product/build-sequencing call, so there is no we:docs/agent/platform-decisions.md anchor to
check against. *Citation-scope:* the #2642 / jury-ledger citation above proves only that the ledger fold has a
designed-for second, graphical consumer (feasibility grounding) — it does **not** by itself justify going
first; the actual justification is the data-dependency forced-invariant argument above, and the item is written
so that citation reads as supporting context, not authority.

**Screen:** flagged(prio) → fixed. The original recommendation read "that is the *smallest slice* that gives
#2696/#2697/#2698 an actual page to extend" — "smallest slice" is cost/effort language the not-a-prioritization
rule forbids inside a fork's tradeoffs. Reworded above to the data-dependency justification only (three
branches are technically excluded, not merely costlier). Standard-vs-implementation axis: clear — this fork
governs internal Plateau/WE build sequencing, not a standards-layer (WE↔FUI boundary) concern, so it is
correctly a `kind: decision` gating a build, not a mis-layered impl detail.

**Note on why this isn't ruled here:** this fork classifies as a forced invariant (exactly one branch is
technically viable as a first slice), which would normally be ratified directly during prep. Per this session's
explicit governance instruction, no item is self-ruled or self-ratified regardless of how forced it looks —
`status` stays `open`, no `## Ruling`, no `ratifiedBy`. A human ratifies (or overrides) this default via
`/next decision`.

## Done when

- Epic #2676 has a named first slice (a new `kind: story` child, sized, scoped to real files) instead of
  "kept unsliced for now."
- That slice is either built or itself prepared to build-ready per the story-preparation checklist.
- #2696 (and, on separate re-review, #2693/#2694/#2695/#2697/#2698) can cite real `path:line` interfaces
  against the landed slice instead of inventing them.

