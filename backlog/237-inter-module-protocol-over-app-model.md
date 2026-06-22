---
kind: epic
size: 13
parent: "150"
status: open
blockedBy: ["140", "150"]
childlessReason: blocked
dateOpened: "2026-06-09"
tags: [protocol, architecture, component-scoping, app-model, introspection, inter-module, webcontexts, registries, blocked]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
relatedProject: webblocks
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Dev-surface feature matrix (#140)" }
---

# Inter-module communication contracts as Protocols over the introspectable app model

Spun out of [#150](/backlog/150-dev-authoring-preferences-architecture-intents/) (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule). The genuine white-space
the research found: architecture & component-**scoping** rules expressed as declarative intent **over the
running app model** (composition / context / intent graph), not reverse-engineered from the import graph
the way dependency-cruiser / Sheriff / Nx do.

The #150 ruling reframed this away from "dev preferences": inter-module communication needs a **strong,
enforced contract** — so it is a **Protocol** (the existing first-class entity, see Render Strategy /
Validation Generation), *not* a new dev-preferences standard. This is the **only deliberate lock**, and
even it is escapable: protocol ≠ implementation (swap freely), and a non-compliant module still *works* —
it just forfeits the injection/configuration that compliant modules receive (graceful degradation).

## Why this is gated (not agent-ready)

Reasoning over the *running app model* (e.g. "this widget may only live inside that container," "this state
is private to this scope," "this intent is owned here") requires the introspectable runtime model to exist
first — webcontexts/registries maturity, i.e. **[#140](/backlog/140-dev-surface-product-feature-matrix/)-class
work** (#150 Q7). Park behind that; the contract *authoring* may be tractable earlier than the
*enforcement-over-live-model*.

## Open (resolve when unblocked)

- Which rule classes are protocols (interop-breaking) vs delegated to the boundary-checker adapters from
  #236 (#150 Q2). Test: breaks interop → Protocol; offends convention → preference/adapter.
- Dependency-direction / layering: protocol or adapter-lowered preference? (borderline — incumbents
  already own import-graph layering).
- Component containment: protocol when it encodes a real context dependency; preference when purely
  organizational.
