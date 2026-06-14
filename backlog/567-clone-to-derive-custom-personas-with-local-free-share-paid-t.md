---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["565"]
dateOpened: "2026-06-14"
locus: plateau-app
tags: [personas, profiles, governance, monetization, tiering, plateau, presets]
crossRef: { url: /backlog/166-governance-persona-roster-charter-schema/, label: "Governance-persona decision (#166)" }
---

# Clone-to-derive custom personas with local-free, share-paid tiering

Graduated from [#166](/backlog/166-governance-persona-roster-charter-schema/) (Fork 1·A + Fork 2·A, ratified 2026-06-14). Add the clone-to-derive extension mechanism: an org authors a custom persona only by cloning a built-in template and overriding (the RBAC template guardrail) — same `Profile` schema, so both lenses keep working. Tiering line per Fork 2·A-refined: local custom personas are FREE (client-side config, zero server cost); the share/sync/team-template plane (publish, distribute, sync an org roster) is the PAID affordance, falling exactly on the [#141](/backlog/141-dev-browser-vision/) server-cost boundary.

## Scope

- **Clone-to-derive mechanism** — a custom persona is created only by cloning a built-in template and overriding `reviewAreas`/`gates` (no free-form taxonomy). It's a *derivation* of the same `Profile` schema, so `/profiles` and the dev-browser toggle-map keep working unchanged. Depends on the shared data home ([#565](/backlog/565-extract-governance-persona-roster-to-a-shared-data-home/)) as the place customs live.
- **A persona is a preset, not a group** ([#564](/backlog/564-personas-as-a-first-class-agile-concept/)) — overriding preferences + which surfaces light up, the lens sense; not RBAC permissions.
- **Tiering (Fork 2·A-refined):**
  - **Local custom personas → FREE.** Cloning + overriding stays client-side config; zero marginal server cost, so it stays on the free tier (the cost-flat rule — the line is drawn at *cost*, not at "premium-sounding feature").
  - **Share / sync / team-template plane → PAID.** Storing, distributing, and syncing an org's roster is server-shaped → the paid/enterprise affordance, on the #141 server-cost boundary and the open-core split ([#089](/backlog/089-monetization-product-ideas/)).

## Note

The free/paid split is the ratified business call (2026-06-14), not an open decision — this card is the build. The share/sync plane likely overlaps the broader hosted/server work; coordinate placement with the monetization narrative ([#089](/backlog/089-monetization-product-ideas/)).
