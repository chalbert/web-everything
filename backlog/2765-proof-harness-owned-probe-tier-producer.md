---
bornAs: xtwnqdr
kind: story
size: 5
parent: "2562"
status: open
blockedBy: ["2759"]
dateOpened: "2026-07-28"
tags: []
scope:
  - we:scripts/lib/proof-probe.mjs
  - we:scripts/lib/__tests__/proof-probe.test.mjs
---

# Proof harness-owned probe tier producer

The harness-owned probe tier producer — the highest trust rung, where the harness owns and runs its own probe for a criterion, independent of any agent-authored check. A criterion earns this tier only when a harness-owned probe verifies it directly. Attaches the probe run/trace as the requirement's evidence artifact via the proof bundle (foundation slice), and is the tier a strict launch/merge gate can require. Blocked on the tier-model + review-surface foundation.

_Scope build-gated on #2759 (per `blockedBy`)_: the harness-owned probe producer module (`we:scripts/lib/proof-probe.mjs`) + its unit harness — a distinct backlog file, so scope-able now while the build rides the foundation spine. Disjoint from the replayed-tier producer (#2760) so the two fan out in parallel.
