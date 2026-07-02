---
kind: decision
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
preparedDate: "2026-07-02"
relatedTo: ["1961", "2091", "1648", "1931"]
tags: [statute, validation-gate, not-a-prioritization, backlog-workflow, decision]
---

# Validation-gate not-yet verdicts vs the not-a-prioritization rule: is a merit-conceded gate still a decision?

## Digest

**Recommended: DISSOLVE — a *merit-conceded* gate is not a ratifiable decision; it converts to accepted-on-merit + `blockedBy`/trigger ordering. Confidence: Medium-High.** The 2026-07-01 two-confusion screen exposed a statute tension: the validation-gate archetype ([we:backlog-workflow.md:378](../docs/agent/backlog-workflow.md)) sanctions go/no/**not-yet** verdicts as legitimate decisions and blesses not-yet gated on *readiness* ("is now the moment"), while the *not-a-prioritization* rule ([#1961](/backlog/1961-merit-not-prioritization/), the [#2091](/backlog/2091-two-confusion-screen/) screen) says timing/effort/ordering is not a ratifiable call. Ten prepared #142-family gates (#1633–#1650, #1931) concede the candidate's merit **in their own body** and split go-vs-not-yet purely on timing, substrate readiness, or demand. The reconciling line: the archetype protects the *merit/warrant* nod, never the *timing* nod — so strip ordering and ask whether a merit unknown remains. If yes → it stays a gate; if no (merit flatly conceded) → it dissolves.

## What you're deciding

When a `kind: decision` validation gate has **already conceded the candidate's merit in prose** and the only live go-vs-not-yet discriminator is **timing / named-substrate-readiness / demand**, does it:

- **(A) Dissolve** off the decision queue to *accepted-on-merit* + `blockedBy`/trigger ordering (no human ratify turn), or
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

**Disposition of the ten.** Re-read each with the test: unconditionally-conceded-merit cards → `resolve` to accepted-on-merit, set `blockedBy`/trigger, drop from the decision queue; conditional-merit cards → keep as a gate but re-shape the body to foreground the *merit unknown*, not the timing.

  **Skeptic (to be attacked before ratifying):** "The archetype explicitly lists not-yet as one of three legitimate verdicts and #1648 already prevailed on exactly that — dissolving is overturning a live, counter-verified ruling." *Answer:* the archetype's own text scopes the verdict to "merit + readiness … **never a cost/effort ranking** — the not-a-prioritization rule still binds," and #1648 prevailed because its merit is *conditional* (facets may not exist), which the test keeps as a gate. So the test **preserves** the counter-verification asymmetry (defense holds, flat-merit siblings flagged) rather than overturning it. The residual the skeptic is right about: the line must be applied per-card, not as a blanket dissolve — a card whose "merit" is genuinely contingent on an unproven substrate stays a decision.

## Dependencies & lineage

- Governs the *not-a-prioritization* rule [#1961](/backlog/1961-merit-not-prioritization/) and the two-confusion screen [#2091](/backlog/2091-two-confusion-screen/); precedent #1463 (region-select — demand-gated NOT-YET overturned on merit).
- Directly disposes of the ten prepared #142-family validation gates #1633–#1650 and #1931.
- On ratify: codify the reconciling test into the validation-gate archetype and the #2091 screen in [we:backlog-workflow.md](../docs/agent/backlog-workflow.md), then apply the disposition to the ten.
