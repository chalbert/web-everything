---
kind: decision
status: resolved
dateOpened: "2026-08-02"
dateResolved: "2026-08-02"
preparedDate: "2026-08-02"
ratifiedBy: "Nicolas Gilbert (operator)"
codifiedIn: docs/agent/platform-decisions.md#orchestrator-stops-line-never-absorbs
tags: [conveyor, governance, stop-the-line, review, convergence, mechanization]
---

# Stop-the-line conveyor governance — the orchestrator never absorbs a non-mechanical case

The conveyor orchestrator (the main session) is a **mechanical conveyor**, not smart glue. When a case
exceeds the mechanic, it must NOT quietly do the case itself to keep delivery moving — that hides the gap
and perpetuates manual work. It **stops the line**, files the gap, and the class is mechanized (or routed
to a human) before flow resumes. This decision codifies one "mechanical-conveyor governance" cluster:
what a stop-the-line is, when a human is genuinely required (judgment, not convergent review), how the
fix↔review loop clears review, and when a deterministic oracle clears a slice.

## Ruling (2026-08-02) — RATIFIED by the operator (Nicolas Gilbert)

The operator (Nicolas Gilbert) ratified this governance cluster in-session on **2026-08-02**. Routing to
`review:human` rests **not** on the rejected raw "touches `we:platform-decisions.md`" test but on the
script-decidable distinguisher `#review-human-declarative-leash-only` (#2771) draws: this PR adds **four
NEW raw statute anchors** (an author writing new rules) with no accompanying resolve+`codifiedIn`-of-a-
single-anchor shape, so it is **not** the codify-shape committee exemption — a NEW-rule statute diff stays
`review:human`, the genuine ratification that gate exists for.

The ruling codifies four cross-linked statute anchors (each carries a `**Ratified 2026-08-02 by the operator
(Nicolas Gilbert)**` provenance line pointing back at this decision):

1. `#orchestrator-stops-line-never-absorbs` — **Stop-the-line (Andon).** The orchestrator never absorbs a
   non-mechanical case as "smart glue"; it HALTS the delivery, FILES the gap, and the class is mechanized or
   routed to a human before it flows again.
2. `#human-required-is-judgment-only` — **Human-required means judgment, not convergent review.** A human gate
   is reserved for genuine judgment (ratifying new policy/statute; novel design forks). Convergent fix/review
   is mechanical and runs as the fix↔review convergence loop.
3. `#fix-review-convergence-independent-root-cause` — **Fix↔review convergence loop.** The mechanical clearer
   for `review:pending` and for the derivation-code gate-self branch that #2771 (`#review-human-declarative-leash-only`)
   routes to the committee **script-decidably** (the declarative leash stays `review:human`): an architecturally
   independent reviewer (enforcement build-pending), every round diagnosing and addressing root cause (the #2823
   discipline, still `status: active`), escalating to a human only on non-convergence or a genuine-judgment finding.
4. `#deterministic-oracle-clears-slice` — **A deterministic oracle clears its slice, not a human.** A green
   acceptance oracle mechanically clears the slice; `human-verify` applies only until that oracle exists — and the
   slice that authors or relaxes the oracle is never cleared by that oracle's own green (the #2398 anti-test-gaming
   guard).

**Provenance:** the anchor bodies carry the rationale, prior art, and cross-links. Lineage below.

**Lineage:** composes `we:docs/agent/platform-decisions.md#agent-convergence-independent-validation`
(#2398, resolved — a builder never clears its own diff, incl. the anti-test-gaming guards), the
conflict-of-interest / non-author rule (#2439, resolved — same-orchestrator subagents are not
independent), the declarative-leash / derivation-code split (#2771, resolved — the script-decidable
`review:human` boundary this cluster composes with), and the prevention-introspection review discipline
(#2823, still `status: active` — cited as the discipline this loop adopts, not as settled precedent). The
deterministic-oracle rule looks toward the in-flight console-board render-slice case — #2811 (the
real-route conformance oracle) and #2834 (the remediation slice), both `status: active` / `human-verify`
on `main`. Neither is cleared yet, so they are named as the **intended endpoint**, not as a precedent
already settled on the oracle.

## Fork-existence collapse — why this prepared decision carries no `## Fork` sections

This cluster codifies a single principle the operator stated directly: a conveyor orchestrator is a
mechanical conveyor, not smart glue, so it stops the line rather than absorbing a non-mechanical case. The
four anchors are **facets of that one principle** (what a stop-the-line is; when a human is genuinely
required; the mechanical fix↔review loop; the deterministic-oracle clearer), not competing options in
contention. There was no live design fork to carve: the alternative — let the orchestrator quietly absorb
cases to keep flow — is the anti-pattern the principle names, not a rejected-but-reasonable branch.
Deliberation lives in the anchor bodies' rationale and prior art (#2398, #2439, #2771, #2823). This is
recorded as an explicit fork-existence collapse so the prepared-decision health check (G4/G5) reads a
justification rather than an invisible forkless pass.

## Outstanding preventions — to file as backlog items before this decision is accepted

Per the prevention-introspection discipline (#2823) and the human `/review` on PR #982, each review
finding routes to a prevention that generalizes it to the class. These are captured here and owed as filed
backlog items at the reviewer's accept-convergence — the review core's `prevention-outstanding` gate holds
accept until they are filed. This re-park is `review:human` (genuine ratification review), not an accept:

- **B1 →** extend the statute gate (`we:scripts/lib/validate-rules-anchors.cjs`) so a `#NNN` cited in
  precedent framing (`**Concrete precedent:**`, "cleared", "proven by") must resolve to a `status: resolved` item.
- **B2 →** a `check:standards` rule pinning statute clearance claims to `we:scripts/lib/review-policy.contract.json`
  — an anchor naming a rubric reason may not assert a clearance weaker than that reason's `clearance` field.
- **M1 →** a statute-overlap rule: a NEW `{#anchor}` whose body cites an existing anchor must carry an explicit
  relation line ("composes with — does not alter", "extends", "supersedes", "narrows").
- **M2 →** register acceptance-oracle test files as spec-tier paths in `we:scripts/lib/gate-config.mjs` (weakening
  one becomes gate-visible), plus a required non-author signal on the oracle diff.
- **M3 →** the clearing actor writes its session/service id into the verdict, and the land seam refuses a clear
  whose reviewer id equals the author's; plus a rule that an operational-invariant anchor must link an enforcing
  code path or an open item.
- **M4 →** a `check:standards` error: a `kind: decision` carrying `preparedDate` with zero `## Fork` headings must
  record an explicit fork-existence collapse (above) or a research cite.
- **Minor →** let `codifiedIn` accept an array, so all four new anchors (not just the lead) get resolution +
  substance coverage under `check:statute`.
- **Minor →** a front-matter key allowlist in `we:scripts/check-standards.mjs` (catches novel unread keys such as
  the removed `dateRatified`).
- **Minor →** give `human-verify` an observable code reader so its retirement is enforced in both directions.

(The digest word-cap nit is already gate-captured — it lints on `check:standards` / `check:item`.)
