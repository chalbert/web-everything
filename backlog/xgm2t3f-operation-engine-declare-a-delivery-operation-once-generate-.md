---
kind: epic
parent: "2606"
status: open
dateOpened: "2026-08-08"
relatedReport: reports/2026-08-08-operation-engine-one-declaration-every-caller.md
tags: [plateau-loop, delivery, operations, engine, epic]
---

# Operation engine — declare a delivery operation once, generate every caller

The engine the [#xu5gfu4] ruling needs: a registry of declared operations, a run engine over four step kinds
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

1. [#xzbzc7n] — registry + run engine (foundation; blocks the rest)
2. [#xdh8sim] — judge helper, the tool-free juror spawn
3. [#xm881ll] — **spike**: does the background-agent lifecycle already cover a dispatch effect?
4. [#xqpw23c] — declare `review-pr` + generate its command-line adapter
5. [#xtfu40d] — generate the HTTP adapter, wire the console review route (**cross-locus**)
6. [#x65hozr] — declare `claim` — the is-the-engine-too-heavy test
7. [#x1y4g3j] — declare `ratify` — the do-effects-generalise test
8. [#xynt0jj] — declare `dispatch` — the effect that starts rather than completes

**Run the spike first in practice**, whatever its slice number: two points, and it is the only item that can
invalidate the vocabulary the other seven are built on.

The risk being managed: engines over-abstract, and the failure is silent — each operation fits badly in a slightly
different way and four kinds quietly becomes seven. If slice 6 or slice 8 fights the model, that is the signal to
change the model, not to add a kind.
