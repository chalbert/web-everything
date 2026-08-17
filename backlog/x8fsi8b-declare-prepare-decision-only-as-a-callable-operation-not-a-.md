---
kind: task
status: open
parent: "3029"
relatedTo: ["3152", "3146"]
tier: pinned
dateOpened: "2026-08-17"
tags: [operations, epic-3029, orchestration-load, prepare]
---

# Declare 'prepare' (decision-only) as a callable operation, not a hand-dispatched skill invocation

Every prep dispatch on 2026-08-17 (seven of them — `#3144`, `#2910`, `#1770`, `#2982`, `#3128`, `#3143`,
`#2985`) required the orchestrating session to hand-write a multi-paragraph `Agent()` prompt invoking
`we:skills-src/prepare-decision-item/SKILL.md`, because there is no callable operation for it. Measured
directly: this was the single largest source of repeated hand-written orchestration prompts in one session.

## Relationship to #3152 and #3146

`#3152` (genericize `prepare` into a kind-polymorphic operation) is the *bigger* redesign — one operation
dispatching to fork/skeptic/screen for decisions vs. scope/size prediction for stories. This item is
narrower and faster: make TODAY's decision-only prep (exactly what `prepare-decision-item` already does)
callable as one operation, without waiting on the kind-polymorphic generalization to land first. `#3146`
(declare prepare's skeptic/two-confusion-screen as judge steps) is a plausible sub-piece of this item's
actual implementation, not a competing item — whoever builds this should read `#3146` first rather than
re-designing the judge-step shape from scratch.

## Why pinned

This is the highest-leverage, lowest-risk orchestration-load reducer identified in the 2026-08-17 session's
own retrospective: unlike `#3152`, it requires no new design decision (the skill's actual logic already
exists and works — verified across seven real dispatches tonight, several catching genuine defects via
independent skeptic/screen passes) — it only requires wrapping that already-working logic in a declared
operation the same way `review-pr`/`claim`/`dispatch-lane` already wrap theirs.

## Done when

1. **Executable** — a callable `prepare` operation runs a decision item through research + fork-authoring +
   genuinely independent skeptic/screen passes (via `judgeSpawn`, not the `Agent` tool) and lands a PR,
   without the caller having to write out the skill's steps by hand; a test drives it against a fixture
   decision item and asserts `preparedDate` is set only after both independent passes return.
