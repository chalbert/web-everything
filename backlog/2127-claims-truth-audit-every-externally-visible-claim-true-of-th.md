---
kind: task
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Claims-truth audit: every externally visible claim true of the deployed artifact (site + adopter deck)

Pre-deploy gate node from ratified #2089 Fork 1(b): sweep every externally visible dogfood/maturity claim — the docs site's published claims AND the enterprise-adopter deck (#1214/#1360, which carries the 'we eat our own cooking' claim the 2026-07-01 external review flagged as aspirational) — and for each, scope the claim or ship the surface. The gated deploy (#1137) is blockedBy this node: the ladder's bar is claim-indexed, not inventory-indexed, so the deploy goes live at the earliest truthful moment. Re-run required before the ungated-public stage.

## Audit result (2026-07-02, batch-2026-07-02 serial lane) — passed after two scope fixes

Swept every externally-visible claim surface across the constellation (docs site + all publicly-routed
marketing decks). Two classes of false/aspirational claim found and **scoped** (per the item's "scope the
claim or ship the surface" mandate); every remaining claim verified true of the deployed artifact.

**Surfaces audited & verdicts:**

- **Docs-site census counts** — computed live from `src/_data/{blocks,intents,protocols,…}/` at build; truthful
  by construction (no frozen integers in templates). No action.
- **Docs-site homepage maturity claim** — `we:src/index.njk` described Frontier UI as *"Production-ready
  building blocks."* Not defensibly true of the deployed artifact (per #2089's grounding digest: dogfood is
  real-but-partial, parity keystone shipped with zero targets measured, zero external users). **Scoped** to
  *"Conforming building blocks."*
- **Marketing decks (all in `plateau-app:src/main.ts` PUBLIC_ROUTES: `/deck`, `/deck/developer`,
  `/deck/design-system`)** — the adopter deck (#1214/#1360) **and** its two siblings (strategic, developer)
  froze census integers now materially drifted false (intents 57→98, protocols 33→41, projects 40→45,
  research 138→256, demos 120→108, blocks 80→81). Re-freezing exact counts just re-fails the audit the next
  day, so all three decks were **scoped** to order-of-magnitude language true of the live corpus at any
  moment (`plateau:src/marketing/deck-{adopter,strategic,developer}.ts`).
- **Dogfood claim** (*"this very deck renders on FUI components"*) — **verified true**: the decks import and
  mount `@frontierui/blocks/deck` `DeckBehavior`. Left intact.
- **Polyglot claim** (forward/generation adapters, ratified #463) — **verified true** (#463 resolved,
  codified). Left intact.
- **Conformance claim** (`check:standards` gate) — true. Left intact.

**Re-run note for the ungated-public stage (per #2089):** the deck census numbers are now de-quantified so
they no longer drift, but any NEW quantified claim added before the ungated-public stage must be re-swept.
The `~80 widgets` figure in the strategic/developer decks is an industry framing of the widget space, not a
WE-corpus count, and is intentionally left.
