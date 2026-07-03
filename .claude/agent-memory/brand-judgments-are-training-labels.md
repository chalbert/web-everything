---
name: brand-judgments-are-training-labels
description: Every user brand/design judgment gets logged as a labeled example in WE #2192's Learning log — it's the training corpus for the design-AI reviewer
metadata:
  type: feedback
---

User directive (2026-07-03): "all the learning should be added to our training plan for AI." Whenever the user renders a brand/design verdict in-session (a favorite, a rejection, a critique like "not very kinetic" or "could be a logo of anything"), append it to the **Learning log** section of `backlog/2192-train-the-design-ai-reviewer-*.md` as a (label → principle) pair, and fix any rubric gap it exposes in the brand rubric (#2191 Fork 6).

**Why:** these judgments are the ground-truth labels the design-AI reviewer (#2192) trains and regression-tests against; unlogged, they evaporate.

**How to apply:** log label + encoded principle + date; keep exploration-round artifacts in `plateau:branding-proposals/` so the fixture grows; known baseline so far: concept-bearing > idea-less letterforms, ownable-at-16px is mandatory (test: "could this be another brand's logo?"), a candidate must serve the FULL owning attribute set ([[plateau-mesa-mark-is-brand-bar]]).
