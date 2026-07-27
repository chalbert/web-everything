---
kind: story
size: 8
parent: "2612"
status: open
dateOpened: "2026-07-27"
scope: ["we:scripts/conveyor", "we:scripts/lib", "we:scripts/readiness"]
tags: [conveyor, decision, jury, red-team, design-committee, disposition, auto-dispose, shadow]
relatedTo: ["2647", "2652", "2675", "2649", "2657", "2639", "2676", "2677"]
---

# Code decision-routing into the conveyor: red-team convergence / design committee by criticality, auto-dispose clear rulings (shadow-first), escalate only genuine contention

Teach the conveyor to DRIVE a cleared decision through the right multi-agent process for its stakes —
red-team convergence for bounded calls, a full design committee for complex/critical ones — auto-dispose a
clearly-converged ruling (shadow-first, mirroring the PR-review auto-land seam), and escalate to a human ONLY
on genuine non-convergence. Today the conveyor runs decisions as a single prepare-agent that always presents
to a human; this codes the operator's 2026-07-26 ruling into the flow so clear rulings stop needing a human in
the loop. Reuses the jury engine, the disposition judge, the auto-land seam, and the design-committee loop
rather than rebuilding any of them.

## The gap (verified 2026-07-26)

The conveyor drives decisions today (#2647, #2613) only as: a cleared `kind:decision` card hands to a SINGLE
prepare-decision agent (research + `/prepare`'s single-agent red-team-the-default) which then **always presents
to a human to ratify**. It does NOT:

1. run a MULTI-AGENT red-team *convergence* (N adversaries → converge on a ruling), only the single-agent
   red-team-the-default of `/prepare`;
2. offer a FULL design-committee path (multi-proposer → multi-lens jury → synthesize) for complex/critical
   decisions;
3. ROUTE between those two paths by complexity/criticality; or
4. AUTO-DISPOSE a clearly-converged ruling — the disposition judge (#2652) plus the shadow auto-land seam
   (#2675) today cover PR review ONLY, not decision cards.

## Operator ruling (2026-07-26)

"Decisions should run through red-team convergence or a full design committee depending on
complexity/criticality — escalate to the human only if needed (genuine non-convergence)."

This must be CODED into the conveyor's decision flow, not hand-run. It was hand-run ad-hoc via Workflow for the
feature-tracker design and decision #xyr248a (the conveyor-orchestration-boundary decision) — which PROVES the
machinery works but also proves it is not yet WIRED into the conveyor.

## Proposed behaviour

On a cleared decision, the conveyor:

- **(a) Classifies criticality/complexity.** Reuse the existing care-level / blast-radius signals rather than
  inventing a new score — the same signals the jury's care→rigor dial and the producer escalation rubric
  already read.
- **(b) Routes by stakes.** Bounded / lower-criticality → **red-team convergence** (N adversaries converge to a
  ruling). Complex / critical → a **design committee** (multi-proposer → multi-lens jury → synthesize).
- **(c) Auto-disposes a converged ruling — SHADOW-first.** If the chosen process converges to a clear ruling,
  auto-dispose it, mirroring #2675: in `shadow` mode LOG the would-ratify (a ledger entry / card comment) while
  a human still confirms, for a confidence-building period; flip to `enforce` later as a separate one-line
  ruling. It does NOT ratify on its own until the flip.
- **(d) Escalates to the human ONLY on genuine unresolved contention** — the process ran and did not converge.
  A clean convergence is not escalated (that is the whole efficiency point).

## Reuse, don't rebuild (reference by number — WHY each is reused)

- **#2649** — the subject-agnostic jury engine (`we:scripts/lib/jury-core.mjs`). The design-committee path's
  multi-lens jury IS this engine; do not build a second jury.
- **#2657** — the `DECISION_PROSE_ADAPTER` (`we:scripts/lib/decision-prose-adapter.mjs`). It already lets the
  jury judge a decision approach in prose — the exact subject a decision card carries. Reuse it as the
  committee's jury adapter.
- **#2652** + **#2675** — the disposition judge and the shadow auto-land seam. EXTEND them from PR-review to
  decision cards: the judge decides "converged / contested", the auto-land seam does the shadow-first
  auto-dispose. This is an extension of an existing seam, not a new disposition engine.
- **#2676** — the design-committee / design-studio loop (multi-proposer → multi-lens jury → synthesize). Reuse
  its committee shape for the critical/complex path. (The 2026-07-26 brief cited "#762" here, but #762 is a
  resolved site-navs story; the design-committee/design-studio epic is #2676 — see also *Siblings*.)
- **`/prepare`'s red-team-the-default** — the single-agent red-team already in `prepare-decision-item` is the
  seed of the red-team-convergence path; generalize it from one agent to N-converging, don't rewrite it.
- **#2647** — the conveyor-drives-decisions slice this builds on (it is the flow being upgraded).
- **#2639** — the review-convergence loop (`editorRound` / `reReview` bounded by the round-trip cap). The
  red-team-convergence path reuses the SAME bounded-convergence loop rather than an unbounded one.

## Siblings / relation

- **#2676** — the plateau design-studio product (request a screen/change → AI design committee → ratify with
  visual diff → build). Sibling: shares the design-committee machinery; this card wires it into the conveyor's
  decision flow rather than a product surface.
- **#2677** — conveyor orchestration (mechanize the core + delegate to per-lane orchestrators). Sibling: this
  is a decision-flow lever within that orchestration.

It is an efficiency / autonomy lever: it removes the human-in-the-loop for clear decisions, keeping the human
for genuine contention only.

## Acceptance

- A cleared decision card is classified by criticality/complexity from the existing care-level / blast-radius
  signals (no new score invented).
- A bounded decision routes to red-team convergence; a complex/critical one routes to the design committee.
- On convergence, the ruling is auto-disposed in SHADOW mode (logged, human still confirms) by default; the
  `shadow → enforce` flip is a separate later ruling.
- Genuine non-convergence escalates to the human; a clean convergence does not.
- The jury engine (#2649), the prose adapter (#2657), the disposition judge (#2652), and the auto-land seam
  (#2675) are REUSED/extended — no second jury, judge, or auto-land engine is built.

locus: we
