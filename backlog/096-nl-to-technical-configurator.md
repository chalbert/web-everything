---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, ai-agnostic, technical-configurator, natural-language, provider-registry, decision-support, plateau, self-run-tool]
relatedProject: webregistries
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# NL → Technical Configurator — describe the behavior, AI wires the strategy

An **AI front-end to the Technical Configurator**: the developer describes desired
behavior in plain language ("undo/redo with an audit trail", "locale-aware sorting
that's stable"), and the AI **selects and wires the right providers/strategies
from the registries** — then emits the configured code. White space vs. generic AI
codegen ([#089](/backlog/089-monetization-product-ideas/)): incumbents have no
registry of *swappable strategies* to target, so they guess; here the AI navigates
a **formal decision space the standard already encodes**.

## Why it's uniquely possible here

- The **Technical Configurator** (plateau-app) already encodes the decision space:
  domains (change-tracking, file-upload, sorting; extensible to state/validation/
  reliability), axes, strategies, and a pure **compat engine** that scores
  strategy-vs-requirement (fits / compromise / won't-work).
- So the AI's job is *constrained selection*, not open generation: NL → requirement
  axes → the compat engine ranks strategies → wire the chosen provider. The
  configurator is the guardrail; the AI is the natural-language navigator over it.
- Output is deterministic and standards-bound (a registry selection + adapter
  form), not a plausible guess.

## Why it fits the solo-founder lens

- **Tier-1 self-run tool**, BYO-AI key — no model-hosting cost or uptime on us.
- **Leverages existing plateau-app work** — the configurator, compat engine, and
  domain seeds already exist; this is an NL layer on top, not new architecture.
- It's a *product on* the configurator, not "building the app" — the AI tool is the
  saleable artifact.

## Open follow-ons

- NL → requirement-axes extraction is the hard, model-facing step; keep it behind
  a swappable provider so it improves as a config change.
- Decide the surface: CLI, an editor command, or a panel in the configurator UI.
- Reuse the configurator's domain seeds directly so a new domain (validation,
  reliability) becomes NL-addressable with no extra work.
