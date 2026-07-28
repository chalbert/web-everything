---
bornAs: xh6xpm4
kind: story
size: 5
parent: "2562"
status: open
blockedBy: ["2759"]
dateOpened: "2026-07-28"
tags: []
scope:
  - we:scripts/lib/proof-replay.mjs
  - we:scripts/lib/__tests__/proof-replay.test.mjs
---

# Proof agent-authored, harness-replayed tier producer

The agent-authored, harness-replayed tier producer — the harness independently re-runs the agent's authored checks rather than trusting its assertions. A criterion whose replay fails never renders green; the tier is only granted on a passing replay. Reuses the F3 per-requirement schema (#2561) and the tier spine (foundation slice) to tag replayed criteria and attach the replay run as the requirement's evidence artifact. Blocked on the tier-model + review-surface foundation.

_Scope build-gated on #2759 (per `blockedBy`)_: the replay-engine producer module (`we:scripts/lib/proof-replay.mjs`) the tier spine feeds + its unit harness — a distinct backlog file, so scope-able now while the build rides the foundation spine. Disjoint from the probe-tier producer (#2765) so the two fan out in parallel.
