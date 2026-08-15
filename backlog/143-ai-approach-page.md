---
kind: story
size: 2
status: open
blockedBy: ["1104"]
dateOpened: "2026-06-07"
tags: [content, page, ai, methodology, pre-release, deferred, plateau]
---

# A page presenting our general approach to working with AI

A public-facing page that lays out **how we work with AI** — the philosophy and practices behind building the standard and its products with AI agents, not just the tools. Likely lives in **Plateau** (platform-level story) rather than the standard site, but placement is open. **Deferred by intent: don't build this early — author it just before release**, when the actual practice has settled and we can describe what we really do rather than what we aspire to.

## Why wait until just before release

The approach is still evolving (agent workflows, backlog-as-tracker, design-first materialization, conformance-driven demos). Writing the page now would freeze a moving target and risk over-promising. Just before release we can describe the *mature* practice honestly, with real examples from the repo's own history.

## What it might cover (sketch — refine at authoring time)

- **AI-native development** — agents as first-class contributors; the human owns direction, review, and merge.
- **Standard-as-substrate for AI** — why a vendor-neutral, introspectable standard makes apps legible to AI (ties into the dev-browser conformance-gate story, [#141](/backlog/141-dev-browser-vision/) — the [monetization](docs/agent/platform-decisions.md#monetization) rule).
- **Working practices** — backlog-as-source-of-truth, design-first/materialization, demo-driven conformance, plain-language + verify-claims discipline.
- **Guardrails & control** — where AI acts autonomously vs. where a human ratifies; the review/PR loop.
- **Honest framing** — what AI does well here and where it doesn't; no hype.

## Open / decide at authoring time

- **Placement** — Plateau (platform narrative) vs. the standard site vs. a dedicated marketing surface. Lean Plateau, but confirm against how the constellation is presented at release.
- **Audience & altitude** — developers evaluating the standard, or a broader "how this was built" story for prospective users/buyers? Affects tone and depth.
- **Relationship to monetization narrative** — does this fold into the product/positioning story ([#089](/backlog/089-monetization-product-ideas/)) or stand alone?

## Preparation check — 2026-08-15

Attempted to bring this card to build-ready per `we:agent-memory-src/story-preparation-checklist.md`.
**Found genuinely not viable right now** — for the reason the card already states: this page is deferred
by intent until *"just before release,"* and that condition is not met yet. Verified against live repo
state rather than assumed:

- `blockedBy: ["1104"]` is accurate and still `open`. #1104's own phased rollout is only at **phase 1**:
  [#1137](/backlog/1137-public-deploy-we-site-live-behind-a-splash-shared-entry-code/) (public deploy behind
  a splash + shared code) is still `status: open` — the site has no public deployment yet. Phase 2
  (analytics, [#1138](/backlog/1138-instrument-the-live-we-site-with-the-chosen-analytics/)) and the later
  per-person/email/login phases are further out still. Release is not close.
- The three "decide at authoring time" forks in this card (placement, audience/altitude, relationship to
  the monetization narrative) genuinely can't be decided now without contradicting the card's own
  rationale: they depend on facts that don't exist yet — how the constellation is actually presented at
  release, and whether [#089](/backlog/089-monetization-product-ideas/) (still `status: open`) has
  settled into a real positioning story. Picking one now would be exactly the "freeze a moving target /
  over-promise" risk the card was written to avoid, and checklist item 4 (a decided design, not a menu)
  can't honestly be satisfied while that's true.

No new blocker item filed: the existing `blockedBy: ["1104"]` already correctly encodes the real gating
relationship, and the backlog DAG already excludes this card from the ready-to-work pool because of it.
**Re-check when #1104 has moved past phase 1** (site actually publicly reachable) and the AI-workflow
practice described in "What it might cover" above has enough real history to describe honestly — not
before.
