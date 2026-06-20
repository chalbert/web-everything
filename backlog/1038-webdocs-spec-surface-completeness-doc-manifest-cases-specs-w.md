---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-19"
tags: []
---

# webdocs spec-surface completeness: Doc + Manifest + Cases specs (WE layer)

Umbrella for the WE-layer completeness of the three declared webdocs specs, surfaced by the #991 audit (§8) — the served product is built (#424/#425/#427) but its specs had no WE-layer owning item. Sliced per spec into three child stories (one per project) plus the one buried fork carved as a decision. Distinct from the parked hosted-product items #184/#428. See we:reports/2026-06-19-backlog-split-analysis.md.

## Slices

- **Manifest Spec** (`webmanifests`) — CEM-derivation hardening + forward-compat for richer fields. Grounded in we:blocks/renderers/module-service/generation/generate.ts. Ready now.
- **Cases Spec** (`webcases`) — case→test bridge conformance + validator coverage on the existing we:webcases/* surface; blocked by the observable-registry decision below.
- **Doc Spec** (`webdocs`) — generation layout + options contract. No WE code surface yet (generator is FUI, #424); needs a design-first pass before its build slices are groundable (Tier-C).
- **Decision** — observable-state registry semantics for `then.observe` grounding (the fork the case validator defers).
