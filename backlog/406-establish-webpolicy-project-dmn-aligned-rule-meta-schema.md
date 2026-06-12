---
type: issue
workItem: story
size: 5
parent: "093"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webpolicy
tags: []
---

# Establish webpolicy project + DMN-aligned rule meta-schema

Fork 1 of the #093 ruling: stand up webpolicy as a new Web Project (domain policy, distinct from webvalidation's input invalidity) and define the DMN-aligned rule meta-schema — the declarative rule vocabulary (decision tables / FEEL-style expressions), versioning, and per-context/tenant scoping. Composes webvalidation/webexpressions/webcontexts/webtraces; does not absorb into them. Register in projects.json; rule authoring surfaces as a Technical Configurator domain (plateau-app). Adopts DMN's vocabulary (standardize the meta-schema, not the rule list). Foundation for the proof + enforcement slices.

## Progress

**Resolved 2026-06-12** (batch). Established the `webpolicy` Web Project (Fork 1):
- `src/_data/projects.json` — registered `webpolicy` (category `standard`, status `concept`): domain policy distinct from input invalidity, DMN-adopted meta-schema, composes webexpressions/webcontexts/webvalidation/webtraces, authoring as a Technical Configurator domain.
- `src/_data/protocols.json` — registered the **Policy Rule (DMN-aligned)** protocol (`policy-rule`, `ownedByProject: webpolicy`, anchor `protocol-policy-rule`): `PolicyRuleSet { id, version, scope?, hitPolicy, inputs[], rules[] }`, decision-table rules with FEEL entries, versioned-for-reproducibility, per-context/tenant scope; authoring-vocabulary only (proof format + enforcement seam are the later slices).
- `src/_includes/project-webpolicy.njk` — project page: Mission, Feature Surface (meta-schema + composed-neighbours tables), the Policy Rule protocol section with a worked decision-table example, Composition, Status + open questions.
- `src/assets/icons/webpolicy.svg` — house-style decision-table icon.

Forks 2 (proof-of-compliance log) and 3 (OPA PDP/PEP enforcement) remain the graduated follow-ups. Gate: `check:standards` 0 errors, `scripts/__tests__` 93 pass.
