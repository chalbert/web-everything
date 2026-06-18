---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/profiles/schema.ts (persona-preset primitive doc — governance projection) + profiles-page
locus: plateau-app
relatedReport: reports/2026-06-14-persona-preset-primitive.md
tags: [personas, agile, methodology, governance, presets, docs]
crossRef: { url: /backlog/564-personas-as-a-first-class-agile-concept/, label: "Ratified decision (#564)" }
---

# Document the persona-preset primitive as a named platform concept

Materializes the ratified #564 ruling: write up "persona = a named preset over composable concepts (preferences + surfaces-lit-up)" as a first-class, documented platform concept that both lenses cite — the governance roster (#166, resolved, plateau-app) and the agile-role playbook (#563). Names "persona/preset" as #563's explicit role-switching primitive (Fork 2·A) and the shared cross-lens vocabulary (Fork 1·A) without building a unified runtime schema. Grounded in we:reports/2026-06-14-persona-preset-primitive.md. Pure authoring/docs; keeps the two homes separate, adds the naming both reference.

## Progress

Documented the primitive in plateau-app (the governance lens's home), framing the on-disk `Profile` as one projection — without building any unified schema (per #564's bias-toward-separation ruling):

- **`plateau:src/profiles/schema.ts` header** — added the authoritative concept block: "persona = a named preset over composable concepts (preferences + surfaces-lit-up)", VS Code Profiles as canonical prior art, the governance `Profile` named as ONE projection and the #563 agile-role persona as the other (CrewAI kinship), the name-the-pattern-not-the-schema ruling, and the decisive **lens-not-RBAC** boundary (RACI; access stays with #178 via a separate PBAC mapping).
- **`plateau:src/profiles/profiles-page.ts` + `plateau:profiles.css`** — a user-visible `.pf-concept` note on `/profiles` stating the same primitive in one paragraph, so the rendered governance surface names it too.
- Kept the two homes separate (governance = plateau-app #166; agile-role = methodology #563); added only the shared naming both cite. Gate: `npm test` green (113/113); `/profiles` renders (200).
