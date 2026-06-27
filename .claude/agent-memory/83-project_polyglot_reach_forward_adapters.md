---
name: project-polyglot-reach-forward-adapters
description: "Project-goal refinement (RATIFIED #463) — WE standards are runtime-agnostic contracts meant to reach the enterprise (.NET/Java/Go) server tier via forward/generation adapters, not a JS lock-in"
metadata: 
  node_type: memory
  type: project
  originSessionId: f90e882b-56b2-4b0a-9a14-d1f505b60550
---

The project goal widened (2026-06-13, author-endorsed): Web Everything's standards are **contracts**,
not a JS lock-in. The browser/JS runtime is the *first* realization, not the only one — the ambition
is to make contracts realizable in **any server runtime (.NET, Java, Go…)** so the standard reaches the
**enterprise** tier where those stacks live.

**The lever is a forward (generation) adapter:** one internal source of truth projected *outward* into
ecosystem-native code (e.g. generate a .NET/Java MaaS origin). This is the **inverse direction** of the
bottom-up ingest adapter in [[feedback_adapter_normalization_hub]] (incumbent → lossy internal pivot).
Same adapter-registry mental model, opposite flow; single-SoT leverage is the value.

**Why:** an origin that can only be a JS process forces every .NET/Java shop into a JS sidecar — friction
that caps adoption exactly where the standard is most valuable. "Here is a native library that speaks the
protocol" is a materially better adoption story than "run our JS server too."

**How to apply:** **SETTLED doctrine now — #463 ratified 2026-06-13** (no longer under-exploration);
codified in AGENTS.md "Mental model → Reach ambition". The mechanism ruling:
- **Deterministic generation-adapter is THE mechanism** — same neutral source → byte-identical generated
  code, NO AI in the generation path. Derives an idiomatic native origin per language into its own repo.
  **AI sits one level up, at adapter-development time only** — improves the *deterministic adapter*
  (rules/templates, regression corpus) until output is perfect-idiomatic; every adapter change
  human-reviewed (full-AI cycle = railguarded future, out of scope). *Sidecar-only rejected*
  (declines the widening); *hand-reimplementation rejected* (forfeits single-SoT leverage);
  *Wasm-component demoted to exotic-only* (the adapter delivers palatable pure-native without
  embedded-engine compliance/AOT friction; AI-derivation removes Wasm's maintenance justification).
- **SoT = a language-neutral contract** (`protocols.json#maas-versioning` + serve-path IR → OpenAPI) is
  the authority; when contract and the JS reference impl disagree, **the contract wins**.
- **Fidelity gated by a deterministic cross-language conformance suite** (golden #088 hash vectors +
  reference impl + runner) — AI judges idiomaticity, the suite judges byte-identity. Never AI in the gate.

Blocker **#461** (canonical JS Fetch `(Request)=>Response` origin, #087/#088) is **resolved** — shipped
as `createMaaSFetchHandler` (blocks/renderers/module-service/fetchHandler.ts), now the reference impl.
Build program carved: **#505** (neutral contract + IR) → **#506** (conformance suite) → **#507**
(deterministic generation-adapter + first .NET/Java target). Polyglot generation may now be baked into
plans as decided.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#forward-generation-adapters` (the statute is source-of-truth; any `#NNN` above is provenance, not the reference).
