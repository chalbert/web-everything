---
bornAs: x8lmsau
kind: decision
parent: "2676"
status: open
blocks: ["2696"]
dateOpened: "2026-08-15"
tags: [design-studio, product-loop, slicing]
---

# Design-studio tool (#2676): which product-surface slice ships first

Filed while preparing [#2696](/backlog/2696-integration-phase-compose-parts-into-one-operable-page-integ.md) to
build-ready (2026-08-15): epic [#2676](/backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-comm.md)
has **zero product-surface code in either repo** — verified by grepping `plateau-app` and `webeverything` for
`design-studio`/`design_studio` and by `git log --all --grep="2676"` in both, which turns up only backlog `.md`
filings and two `docs/agent/*.md` skill-fold commits (#2708, #2706), never application code. The epic itself says
its four NEW pieces — (1) request-intake surface, (2) live committee-run + trace view, (3) proposed-vs-current
review surface, (4) ratify → build trigger — are "kept unsliced for now — a future /slice candidate." None of
the four has even been broken into a buildable slice yet, let alone built.

## Why this blocks more than #2696

Six capability-story children were filed together under #2676 from the same feature-tracking-screen session,
each phrased as "a capability the design-studio tool (#2676) should productize": #2693 (case-taxonomy →
webcases), #2694 (full-scale interactive rendering), #2695 (data-grounding lens), #2696 (integration phase),
#2697 (adversarial red-team), #2698 (interaction-model exploration). Every one of them describes a refinement
to a phase of a tool run — committee output, rendered mockups, a review pass — that presumes the tool's base
run loop already exists. It does not. Preparing any of the six to build-ready today means inventing interfaces
for a surface nobody has written, which is exactly what the story-preparation checklist's grounding rule
forbids ("cite `path:line` actually opened, never invent an interface you have not read"). Only #2696 is
`blockedBy` this decision for now (that is the item this decision was filed while preparing); the other five
were left untouched — re-open them individually rather than assuming this note updates them.

## The fork

Which of the four NEW pieces should be built FIRST, so the capability-story children have a real seam to
attach to?

- **Request-intake surface** — the front door (plain-language "I want a screen that…" → design brief). Nothing
  downstream can run without a brief, but this piece alone has no committee/review/diff machinery to exercise —
  it would ship inert until (2) exists too.
- **Committee-run + trace view** — kick off / watch the committee, render the jury ledger live. This is the
  piece #2696 (integration phase), #2697 (red-team), and #2698 (interaction-model exploration) most directly
  extend — they all refine what happens *during* or *right after* a committee run. Building this first gives
  those three a real target.
- **Proposed-vs-current review surface** — the visual-diff + trace review a human ratifies against. Depends on
  (2) already producing a trace to show.
- **Ratify → build trigger** — the auto/human threshold + conveyor hand-off. Last in the causal chain; nothing
  upstream to ratify without (2) and (3).

**Recommendation:** slice (2), the committee-run + trace view, first — plumbed to a CLI-triggered committee run
(the design-committee skill + jury-core already exist per the epic's "mostly already built" list) rendering into
a real Plateau page, even with a stubbed/manual intake and no ratify step yet. That is the smallest slice that
gives #2696/#2697/#2698 an actual page to extend, and it reuses the already-built jury/ledger machinery the
epic names rather than building new machinery.

## Done when

- Epic #2676 has a named first slice (a new `kind: story` child, sized, scoped to real files) instead of
  "kept unsliced for now."
- That slice is either built or itself prepared to build-ready per the story-preparation checklist.
- #2696 (and, on separate re-review, #2693/#2694/#2695/#2697/#2698) can cite real `path:line` interfaces
  against the landed slice instead of inventing them.

