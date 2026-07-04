---
name: project_managed_offering_constellation_layering
description: Managed offerings (Web Docs
metadata: 
  node_type: memory
  type: project
  originSessionId: 1be2f777-3b51-4bd4-910e-4eb72650c748
---

#091 (Web Docs as a Service) ruling, 2026-06-12: a managed Plateau offering is **not a monolith
needing a "home" decision** — it decomposes across the [[reference_repo_constellation]] like every
other concept, which *dissolves* the "Plateau-offering-vs-graduated-project-entry" fork rather than
deferring it:

- **Standard** → WE (`webdocs` already a projects.json entry).
- **Open primitives + adapters** → Frontier UI. The free primitives must be *enough to assemble a
  self-hostable UI* — that's the load-bearing "cancel and self-host always holds" floor, not a nicety.
- **Complete served product** (site + per-customer conformance/coverage report) → **plateau-app**.
- **Monetization: open-core by usage** — FUI primitives free; the plateau-app product is free-tier →
  paid-beyond-a-usage-threshold (NOT free-vs-licensed binary). See [[project_monetization_strategy]].

**Why:** removes the divergence risk the prep flagged (two items settling the same "home" question two
ways). MaaS (#081) obeys the identical layering, so #081 + #091 stay in lockstep *by construction* —
#081's parked home decision answers the same way and need not be re-litigated.

**How to apply:** for any new managed offering, don't open a "where does it live" decision — apply the
layering. Reuse patterns (`/protocols/` + `capabilityMatrix`) rather than rebuilding; the served
surface is always a plateau-app product. Build spun off as #398 (gates #336 dev-guide migration).

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#constellation-placement` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
