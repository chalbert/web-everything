---
bornAs: xvabt1e
kind: story
size: 2
status: open
dateOpened: "2026-07-12"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/readiness/
  - we:scripts/__tests__/
---

# decideDrainLeaseGate is repo-scope-blind — a scoped drain holder falsely no-ops differently-scoped sweeps

The #2449 whole-process lease gate in we:scripts/merge-ai-prs.mjs takes no repo-scope input: any non---only sweep no-ops exit 0 on a live lease claiming "the holder's next pass covers this work", but the holder may be a differently-scoped drain (--this-repo / --repos=...) that never sweeps the no-op'd run's repos — those PRs silently stay queued until the holder exits. Fix shape: record the holder's repo scope in the lease (owner metadata) and have decideDrainLeaseGate compare scopes — disjoint scope either proceeds safely or no-ops with an HONEST message; at minimum stop claiming coverage that is false. Surfaced by the PR #444 human review (findings applied to #441's landed code).
