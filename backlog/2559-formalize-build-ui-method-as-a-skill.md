---
bornAs: xpirk11
kind: story
size: 3
parent: "2505"
status: resolved
tags: [plateau-loop, method, skill, agent-meta]
dateOpened: "2026-07-18"
dateStarted: "2026-07-20"
dateResolved: "2026-07-20"
---

# Formalize the build-UI method as a reusable skill

The console was designed with a repeatable method that proved itself over this program and should become a
reusable skill for "we have a new UI to build" (captured live in `we:skill-learnings.md`). Serves G5 (the
method + the decision record are durable, not lost with the session).

## The method to skill-ify
model-the-domain (axes → matrix → the one live-action rule) → **mock before build** (self-contained HTML
artifact, real data shapes) → **review the pixels, not the source** (screenshot matrix × both themes, review
subagents get the PNGs) → **decision-explainer artifacts** (side-by-side option panes, honest counter-argument,
one recommendation — the ruling channel) → **graduate to webcases** (durable, cite-able, machine-checkable) →
**converge** (alternating-lens fresh reviewers until two consecutive clean rounds; every fixture edit
assert-verified). Plus the repo hooks (lane→PR, complete-the-branch-before-labeling, the write-seam).

## Acceptance
`we:skill-learnings.md` is formalized into an invokable skill; a future "new UI" task can follow it end-to-end.
