---
kind: decision
size: 3
parent: "2505"
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
tags: [plateau-loop, console, console-board, visual-grammar, design-forks]
---

# Console card visual-grammar forks

The residual visual-language rulings for the launch-review console board, left open after the
31-round mock convergence (v68). The big grammar is already **ratified** in the design doc
(color: green=delivered / teal=leverage / purple=waits-on / amber=needs-a-human · icon: one-glyph-one-meaning
+ SVG sprite · attention cards: one signal + one primary + calm secondaries · say-it-once · disclosure levels).
These forks refine *within* that grammar — none reopens a ratified rule. Prepared via the design-explainer
artifacts; ready to ratify in one pass. Serves G4 (attention-first, legible at a glance). Blocked-soft on
[#2556] (grammar lives only in the uncommitted design doc — graduate it first).

## Forks to ratify
1. **Verb vocabulary** — merge the Prepare / Re-prepare / Revive family (three near-synonyms for "make it
   runnable again"), and resolve Re-prepare-vs-its-3-causes (confidence-low / decision-pending / unprepared
   each imply a different action).
2. **Verb affordance** — icon+label vs label-only verbs. Ratified icon grammar says icon+label; the mock went
   label-only after the icon sweep. Reconcile to one rule.
3. **Attention emphasis** — the running-card purple full outline vs the you-act amber left edge: do they compete
   at scan distance? Keep one, or scope each (run-state vs needs-you).
4. **Header glyph chip** ("lanes 2⟳·1‖·1⚠") — keep or drop; it restates the readable stat-chip row in a cryptic
   glyph form a few hundred px away.
5. **AGENT / NOBODY badges on board cards** — render them, or let the amber edge + inert (dashed/grayed) form
   carry who-acts (the mock dropped the badges).
6. **fan-out vs forked encoding** — one status with a state chip ("may split ×3" → "split ×3"), or two distinct
   states.
7. **Icon differentiation polish** (group) — filled-vs-stroke coherence in the amber "act here" family · a
   you-act icon corner-slot · unify "gated"'s three encodings · scales-glyph detail at 14px · run/drain
   silhouette similarity · dark-theme idle-circle contrast.
8. **Two-operator presence model** — the optimistic verb-lock + "claimed by ‹name›" chip (the collaborative-claim
   question parked at [#2533]). Decide the presence/lock semantics before the concurrency slice builds.

## Acceptance
Each fork ruled (or explicitly deferred with a reason); the resolved rules fold into the taxonomy conformance
spec ([#2548]) so the real board build ([#2550]) cites them, and the mock is not re-litigated.
