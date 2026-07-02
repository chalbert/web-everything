---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
codifiedIn: "docs/agent/backlog-workflow.md#principle-conformance-pre-flight--readiness-is-conformance-not-just-mechanics-608"
preparedDate: "2026-07-02"
relatedTo: ["1961", "2091", "1648", "1931"]
tags: [statute, validation-gate, not-a-prioritization, backlog-workflow, decision]
---

# Validation-gate not-yet verdicts vs the not-a-prioritization rule: is a merit-conceded gate still a decision?

## Digest

**Recommended: DISSOLVE — a *merit-conceded* gate is not a ratifiable decision; it converts to accepted-on-merit + `blockedBy`/trigger ordering. Confidence: Medium-High.** The 2026-07-01 two-confusion screen exposed a statute tension: the validation-gate archetype ([we:backlog-workflow.md:378](../docs/agent/backlog-workflow.md)) sanctions go/no/**not-yet** verdicts as legitimate decisions and blesses not-yet gated on *readiness* ("is now the moment"), while the *not-a-prioritization* rule ([#1961](/backlog/1961-merit-not-prioritization/), the [#2091](/backlog/2091-two-confusion-screen/) screen) says timing/effort/ordering is not a ratifiable call. Ten prepared #142-family gates (#1633–#1650, #1931) concede the candidate's merit **in their own body** and split go-vs-not-yet purely on timing, substrate readiness, or demand. The reconciling line: the archetype protects the *merit/warrant* nod, never the *timing* nod — so strip ordering and ask whether a merit unknown remains. If yes → it stays a gate; if no (merit flatly conceded) → it dissolves.

## What you're deciding

When a `kind: decision` validation gate has **already conceded the candidate's merit in prose** and the only live go-vs-not-yet discriminator is **timing / named-substrate-readiness / demand**, does it:

- **(A) Dissolve** off the decision queue to *accepted-on-merit* + `blockedBy`/trigger ordering — the human turn **compressed to a one-glance batch-confirm** of the concession, not removed, or
- **(B) Stay** a human ratify turn because the validation-gate archetype is a deliberate third category exempt from the fork/merit test?

The ruling disposes of the ten flagged prepared items either way.

## Fork 1 — merit-conceded gate: dissolve to ordering, or keep as a ratify turn?

**Option A — Dissolve (recommended).** A gate whose body concedes merit and whose residue is pure ordering is *prioritization wearing the gate's clothes*. It converts to a build item accepted on merit, with the ordering encoded mechanically:
  - **named substrate** (dep X must ship) → `blockedBy: [X]` — a DAG edge that auto-un-gates (e.g. #1931 already carries `blockedBy: [1930]`);
  - **demand / 2nd consumer** → a trigger note (graduation-trigger territory — automatic on evidence, not a human call);
  - **pure timing** → a normal backlog priority; no gate at all.

  *Pro:* kills ten false decision-queue entries; aligns with #1961, the #1463 region-select precedent (NOT-YET demand-gating a merit question was overturned), and the #2091 screen, which already asks "imagine both branches free to build and instantly maintained — does a merit difference remain?"; the blocker DAG already carries the ordering, so nothing is lost. *Con:* removes the human "does this AI-proposed candidate earn a roadmap slot at all" checkpoint — the #142 pool's reason for existing — for these cards.

**Option B — Keep (archetype wins).** The validation-gate archetype is an intentional third category; the human roadmap nod is real value even when an AI author conceded abstract merit in prose (AI-conceded merit ≠ human-validated slot). Keep all ten as ratify turns.

  *Pro:* preserves a human gate on the AI-generated #142 firehose. *Con:* floods the queue with near-identical low-cost ratifications whose only open variable is timing — exactly what #1961 forbids; makes the archetype a standing loophole around not-a-prioritization.

**The reconciling test (the recommended ruling — a refinement of A).** The two rules don't conflict; they **partition by what survives stripping the ordering**. Strip timing/substrate/demand from the card and ask: *is there a genuine merit / warrant unknown a human must still answer* — "is the delta even real," "does this earn a slot," "is the candidate on-moat / does its advantage evaporate without a substrate that may never carry it"?

  - **YES → stays a validation-gate decision.** Merit is *conditional or open*; not-yet is a legitimate verdict. This is the archetype's real domain. (Plausibly #1648: its on-moat delta is *conditional* on the declared state model carrying visibility/persistence/egress facets that "may itself be unspecified today" — a real unknown, not mere waiting. That is why its defense held; the archetype-sanction citation was the right result for a better-stated reason.)
  - **NO → dissolves** to accepted-on-merit + `blockedBy`/trigger. Merit was flatly conceded ("the delta is real, so don't drop it — but wait for substrate X"); the residue is a DAG edge, never a ratifiable call.

  The archetype's not-yet sanction is therefore **narrower than it reads**: it covers *"is the candidate real AND is now the moment"* only while the *real* half is genuinely open. Once merit is unconditionally conceded, the only residue is ordering, which #1961 governs. #2092 doesn't overturn the archetype — it draws the line the archetype's own "never a cost/effort ranking" clause already implies, and extends the #2091 screen's merit-vs-prioritization question explicitly to the go-vs-not-yet **verdict** (today the screen only runs it on `## Fork N` sections).

**Disposition of the ten.** Re-read each with the test: unconditionally-conceded-merit cards → dissolve to *accepted-on-merit pending a human batch-confirm* (not an auto-`resolve`), set `blockedBy`/trigger, drop from the *ratify-turn* queue; conditional-merit cards → keep as a gate but re-shape the body to foreground the *merit unknown*, not the timing. **The conditional-vs-conceded call is the fresh-context #2091 screen's job, not the prep author's** — the author can frame either way, so a same-session self-classification is exactly the blind spot the screen exists to catch (see the ruling amendment below).

## Ruling (ratified 2026-07-02)

**DISSOLVE — as amended. Verdict: the skeptic SURVIVES-WITH-AMENDMENT; two clauses of the naive default were overreach and are corrected here.**

The dissolve doctrine holds: a validation gate whose only live discriminator is timing/named-substrate/demand is prioritization the *not-a-prioritization* rule (#1961) governs, and the archetype's own text already scopes the not-yet verdict to "merit + readiness … **never a cost/effort ranking**." The #1463 precedent (a demand-gated NOT-YET *reversed* because demand-gating a merit question is barred) is on-point and strengthens, not weakens, the ruling. **Two amendments** the red-team forced:

1. **Dissolve compresses the human turn — it does not delete it.** An AI prep author's prose merit-concession is *not* the human roadmap-validation the #142 pool exists to provide; equating the two and auto-`resolve`ing would confer `accepted-on-merit` on one AI author's say-so. So a dissolved gate lands on **accepted-on-merit pending a lightweight human batch-confirm** (a one-glance batch accept over the dissolved set), with `blockedBy`/trigger carrying the ordering. The saving vs Option B is real — one batch nod over N cards instead of N separate ratify turns — without throwing away the validation event.
2. **The conditional-vs-conceded line is drawn by the fresh-context #2091 screen, not the authoring session.** Every #142 moat is "derived from the declared model," so any card's merit can be *framed* as conditional ("real only if the model carries facet X"). That makes the test dial-able by prose in the authoring seat — precisely the framing blind spot #2091 built a fresh-context agent to catch. The screen (extended to the go/no/not-yet **verdict**, not just `## Fork N`) makes the call.

**Disposition:** the ten flagged gates (#1633–#1650, #1931) are handled by a follow-up that runs the fresh-context screen per card — flat-merit → dissolve-pending-batch-confirm + `blockedBy`/trigger; conditional-merit (e.g. #1648, whose delta hinges on facets that may not exist) → stays a gate, body reshaped to lead with the merit unknown.

## Dependencies & lineage

- Governs the *not-a-prioritization* rule [#1961](/backlog/1961-merit-not-prioritization/) and the two-confusion screen [#2091](/backlog/2091-two-confusion-screen/); precedent #1463 (region-select — demand-gated NOT-YET overturned on merit).
- Directly disposes of the ten prepared #142-family validation gates #1633–#1650 and #1931 (via the follow-up screen pass).
- On ratify: codify the reconciling test + the two amendments into the validation-gate archetype and the #2091 screen in [we:backlog-workflow.md](../docs/agent/backlog-workflow.md), then run the disposition follow-up.
