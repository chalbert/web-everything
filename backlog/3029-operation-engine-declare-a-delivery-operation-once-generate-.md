---
bornAs: xgm2t3f
kind: epic
parent: "2606"
status: open
dateOpened: "2026-08-08"
relatedReport: reports/2026-08-08-operation-engine-one-declaration-every-caller.md
tags: [plateau-loop, delivery, operations, engine, epic]
---

# Operation engine — declare a delivery operation once, generate every caller

The engine the [#3031] ruling needs: a registry of declared operations, a run engine over four step kinds
(`compute`, `judge`, `confirm`, `effect`), a durable run record, and **generated** command-line / HTTP / typed-tool
adapters. Then it converts the delivery-loop operations onto it — smallest-and-strangest first, so the vocabulary
is falsified early if it is wrong.

Statute: [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated).

## Why

`we:scripts` already single-sources the *logic* — the review operation is the mature case, with
`we:scripts/review-detail.mjs` and `we:scripts/review-set-label.mjs` shelled by both the skill and the console,
and the gate-self invariant living in the pure core where no shell can route around it. What is **not**
single-sourced is the *wiring*: `plateau:tools/dev-panel/vite-plugin.ts` (the review routes, mounted from
`plateau:vite.config.mts`) and `plateau:tools/drain-daemon/cli.mjs` each hand-roll argv building and route glue
over those same scripts, and every new operation pays that cost again.

The consequences show up as three concrete defects, all of which this epic removes structurally rather than by
discipline:

- **Capability drift between callers.** The agent path can *judge* a PR; the console path can only display and
  accept. Not a plumbing gap — the console has no model attached.
- **The human stop is prose.** `we:skills-src/review/SKILL.md` says *"This is a stop point … Do not auto-proceed."*
  A rule the model must hold rather than one the machinery enforces.
- **Retry is an instruction.** *"A non-zero exit means re-run the same command"*, plus the #2964 hand-ordered
  comment-before-label sequencing, exist because the two writes are not atomic and nothing replays them.

## Scope

- Registry + run engine + the four step kinds, with the run record as a local file behind a store module
  (the store-seam discipline #2626 proposes — it migrates when that decision's product trigger fires, not before;
  #2626 is still **open**, so the seam is what this epic adopts, not the migration).
- The judge helper: one tool-free juror spawn, measured, shared by every judge step.
- Adapter generation for the command-line and HTTP callers.
- `review-pr`, `claim`, `ratify`, `dispatch` declared onto the engine, in that order.

## Not in scope

- Rewriting the existing scripts. They stay as the implementations behind `compute` and `effect` steps — this epic
  re-declares, it does not re-implement.
- Anything metered. Tier one is subscription-funded end to end; the hosted backend is a later substitution behind
  the same seam, and no slice here builds it.
- The typed-tool adapter. Named in the statute as derivable, but not built until something wants it.

## Acceptance

An operation is added by writing one declaration, and both the agent and the console can run it without either
gaining a hand-written route or argv parser. `review-pr` runs end to end on the engine from both, `claim` and
`ratify` are declared, and `dispatch` has either been declared or has produced a written reason why the four-kind
vocabulary does not fit it.

## Slices

Ordered to **falsify early**, since every operation converts eventually and the ordering is therefore free:

1. [#3032] — registry + run engine (foundation; blocks the rest)
2. [#3028] — judge helper, the tool-free juror spawn
3. [#3030] — **spike**: does the background-agent lifecycle already cover a dispatch effect?
4. [#3035] — declare `review-pr` + generate its command-line adapter
5. [#3036] — generate the HTTP adapter, wire the console review route (**cross-locus**)
6. [#3034] — declare `claim` — the is-the-engine-too-heavy test
7. [#3033] — declare `ratify` — the do-effects-generalise test
8. [#3037] — declare `dispatch` — the effect that starts rather than completes

**Run the spike first in practice**, whatever its slice number: two points, and it is the only item that can
invalidate the vocabulary the other seven are built on.

9. #xnc8wyd — the **judge panel**: fan #3028's single spawn out to N distinct jurors, awaited, under one
   aggregate budget and a fail-closed depth cap. Not ordered with the eight above and **blocked on nothing** —
   it is the fan-out layer a `judge` step calls, not an operation declared onto the engine.

The risk being managed: engines over-abstract, and the failure is silent — each operation fits badly in a slightly
different way and four kinds quietly becomes seven. If slice 6 or slice 8 fights the model, that is the signal to
change the model, not to add a kind.

## Rationale — the operator's framing, 2026-08-09

Recorded as an in-session note. The operator's own words:

> *"The idea is to mechanise in similar way absolutely all operations, as it's the only way the UI will be able
> to use it, in addition to other advantages of mechanisation. So let's finish the review, but the jury is
> certainly another candidate, as well as all other current and future operations we will need."*

This **strengthens** the statute
[#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
without amending it. Clause 1 already lists the HTTP caller — the console — among the callers that fall out of a
declaration, and frames a hand-written route as *"a defect, not a style choice"*. The operator's framing raises
that from an efficiency argument to a **precondition**: a generated caller is not a convenience, it is the only
way a UI surface can invoke an operation at all. **An operation that is not declared simply cannot appear in the
console.** Nothing here edits the statute text — a statute edit is a separate act with its own review, and
#1122's rule about not encoding transient state applies.

Three consequences for this epic, none of them a re-ruling:

- **The named sequence is: the review operation first (#3035), then the jury, then the remaining operations.**
  Not a re-ordering of the falsify-early list above — #3035 is already slice 4 and the spike still runs first in
  practice. It is the operator's statement of what comes after `review-pr` proves the engine end to end.
- **The jury is the named next candidate.** Its fan-out primitive is #xnc8wyd, filed under this epic.
- **"All other current and future operations we will need"** is the standing scope. Every operation converts
  eventually, which is exactly why the slice ordering above is free.

**Cross-reference — #3049, the conveyor as a shippable product.** "The only way the UI can use it" is the
mechanical link between this epic and that thesis. #3049 argues the conveyor is a sellable product because it is
a UI surface managing standards-conformant automated development, with provable conformity as the differentiator.
This epic is what makes that surface *possible*: every operation the console needs to expose has to be declared
here first, so the operation registry is the conveyor product's supply of features, and an undeclared operation
is a feature the product cannot ship.
