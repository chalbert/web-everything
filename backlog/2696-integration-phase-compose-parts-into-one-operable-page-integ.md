---
bornAs: xm9e7v3
kind: story
size: 5
parent: "2676"
status: parked
blockedBy: ["x8lmsau"]
dateOpened: "2026-07-27"
tags: []
---

# Integration phase: compose parts into one operable page + integration-only review

The loop designs and validates PARTS via an all-states proof sheet, but parts that each pass review do not add up to a coherent screen. Add an explicit INTEGRATION phase that composes them into one operable screen with a real interaction model and reviews specifically for problems only integration reveals — emitting BOTH a states proof sheet AND an integrated page.

Operator insight that motivated this: "having all states is helpful, but some problems and refinements are only obvious once we integrate." The tool should treat the states sheet as a coverage spec and the integrated page as a separate deliverable, and run an integration-specific review pass.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Preparation finding, 2026-08-15 — NOT VIABLE to build yet; parked, not prepared

Attempted to prepare this to build-ready per the story-preparation checklist (we:agent-memory-src/story-preparation-checklist.md). **Stopped at item 5 (interfaces/protocol): there is no seam to attach to.**

Verified live (both `plateau-app` and `webeverything`, `main`, clean): the "design-studio tool" (#2676) has
**zero product-surface code** — no request-intake UI, no committee-run/trace view, no proposed-vs-current review
surface, no ratify→build trigger. `git log --all --grep="2676"` in both repos turns up only backlog `.md`
filings and two doc skill-fold commits (#2708, #2706), never application code. The epic itself says these four
pieces are "kept unsliced for now — a future /slice candidate," so they haven't even been broken into
buildable increments, let alone built.

This card asks for an "integration phase" *inside* that tool — composing already-generated parts into one
operable page, reviewed as a whole. Without a base committee-run loop producing parts to compose, writing real
interfaces here would mean inventing a contract for a surface nobody has written, which the checklist's
grounding rule forbids ("cite `path:line` actually opened, never invent an interface you have not read").

Note this is a **different** target from the already-resolved sibling #2708, which folded "integration is its
own phase" into the **agent-side build-ui skill/method** (we:docs/agent/build-ui.md §6–7, done) — that is how
a human/agent builds ANY UI by hand. This card is about the **design-studio tool itself doing that
automatically as a product feature**, which is a different, unbuilt thing.

Filed x8lmsau (decision: which of #2676's four NEW pieces ships first) as the blocker. Parked on it rather
than left silently open — per we:docs/agent/backlog-workflow.md's hold model, a single tracked blocker is a
`blockedBy` park, no `parkedReason` needed. **Re-prepare this card once that decision resolves and its chosen
slice lands** — at that point items 1–8 of the checklist (scope, size, acceptance, design, interfaces, tasks,
delivery shape) can be written against real code instead of invented.

The same gap likely affects the five sibling capability-stories filed in the same session — #2693, #2694,
#2695, #2697, #2698 — but they were left untouched here; this note does not speak for them.
