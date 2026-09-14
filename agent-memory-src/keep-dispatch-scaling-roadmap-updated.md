---
name: keep-dispatch-scaling-roadmap-updated
description: Standing instruction — keep the published "Dispatch Scaling Roadmap" artifact (epic #3383) updated with real progress going forward, and keep the current phase visually obvious on the page.
metadata:
  type: feedback
---

Whenever there's a meaningful update to epic #3383's multi-model dispatch scaling progress
(a phase's gate criteria gets met, a new real finding changes a phase's plan, graduation
data counts change materially, a provider promotes/demotes), update the published
"Dispatch Scaling Roadmap" artifact rather than only reporting progress in chat.

Artifact URL: https://claude.ai/code/artifact/27a979d6-fe2a-40fc-9874-ffb97dd48eff

**Why:** the operator asked on 2026-09-14 for a durable instruction to keep this artifact
updated, specifically so the roadmap stays a living reference rather than a one-time
snapshot — they check it instead of re-reading chat history for status.

**How to apply:**
- Read the artifact before editing (Artifact tool, action "read") — build on the live
  version, not a stale local copy.
- Keep exactly one phase card marked as current (a "You are here" badge + highlighted
  border), moving it forward only as phases actually complete per their own stated gate
  criteria — never advance it speculatively ahead of real evidence.
- Keep the status banner line current: current phase, real scorecard-data row count, and
  other concrete status worth surfacing.
- Update a phase's own content when new real evidence changes what's true for it (a new
  live-tested finding, a corrected earlier claim, a changed priority ranking) — grounded in
  verified facts, not assumptions, same rigor as the original content.
- Republish to the same file path/URL so the link stays stable — never create a new
  artifact for a routine update.
- This is a standing behavior, not a one-off — don't wait to be asked again before the next
  real update.
