---
bornAs: xkttnfr
kind: story
size: 5
status: open
parent: "3029"
relatedTo: ["3150", "3037"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, backlog-workflow, naming]
---

# Genericize 'prepare' into a kind-polymorphic operation, absorbing scaffold/slice's readiness role

The `we:skills-src/prepare-decision-item/SKILL.md` skill only handles decisions, but this repo's own vocabulary
already treats `/prepare` as a general shape-time verb — `we:docs/agent/platform-decisions.md`'s
"state lives where its nature dictates" statute lists `/prepare`, `/scaffold`, `/split` together as the three
shape-time verbs a card gets readied through. The tooling hasn't caught up to the vocabulary.

## What's actually shared vs. kind-specific (2026-08-17 discussion)

- **Genuinely kind-agnostic:** prior-art/precedent research, gathering context, checking an item's own claims
  against ground truth before it reaches a human or a builder. Currently duplicated in spirit every time
  anything gets prepped, with no shared implementation.
- **Genuinely decision-specific:** fork framing (branches + bold default), the skeptic pass (attack the
  default), the two-confusion screen (standard-vs-impl, merit-vs-prioritization) — these are about *forks*,
  which only decisions have.
- **Already exists separately for stories, under a different name:** `scope:`/`size:` prediction at
  scaffold/slice time. Not currently sharing a research step or a name with decision-prep.

## Shape

`prepare` becomes the one public operation (composable the same way `dispatch-lane` composes on `tick-core`,
and #3150's `explore` composes on `dispatch-lane`'s effect machinery) — the research/context-gathering half is
shared, kind-specific readiness work is layered underneath: fork/skeptic/screen for decisions, scope/size/
touch-set validation for stories (absorbing what scaffold/slice already do, not duplicating it). The
prior-art-survey mode of #3150's `explore` operation is a natural building block for the shared research half,
not something this item needs to reinvent.

## Done when

1. **Executable** — a `prepare` operation registered in `we:scripts/operations/run.mjs`, dispatching to
   kind-specific logic by the target item's `kind:` frontmatter; a test preparing a decision item asserts
   `preparedDate` is set only after fork/skeptic/screen pass, and a test preparing a story asserts `scope:`/
   `size:` are validated or predicted without requiring a fork.
