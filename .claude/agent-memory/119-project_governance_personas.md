---
name: project_governance_personas
description: "Governance persona roster — one family, two lenses (plateau-app /profiles + dev-browser"
metadata: 
  node_type: memory
  type: project
  originSessionId: 96604f98-5ade-436d-8657-cb64c0404922
---

Platform stakeholder **personas** are one unified family with one schema, surfaced through two lenses:
- **Governance charter** — plateau-app `/profiles` (`src/profiles/profiles.ts` data + `profiles-page.ts` mount + `profiles.css`): what each role *reviews / approves (gates, blocksDeployment+sla) / manages*, each ReviewArea pinned to a `platformArea`.
- **Dev-browser toggle-map** — [[reference_repo_constellation]] dev browser (backlog #141): which introspection surfaces a persona enables. The charter *drives* the toggle-map (what a role cares about = what surfaces it wants lit).

Roster (7 implemented as full charters): developer, designer, manager, translator, analyst/QA, security, legal. Security & legal were the original ask ("review/approve/manage all aspects of an app").

Canonicalized in **backlog #166** (`166-governance-persona-roster-charter-schema`, status:active, crossRef #141). Open: should the roster be a shared `personas` registry both products read (today hand-authored in plateau-app), and do gates ever become *enforced* CI/deploy checks vs descriptive.

**Why:** the persona concept pre-existed only as prose in #141; this gave it a schema + working materialization. **How to apply:** add a persona by appending a `Profile` to `profiles.ts`; new discovery/governance surfaces follow the configurator mount pattern (compose, no new components — plateau-app CLAUDE.md cardinal rule).
