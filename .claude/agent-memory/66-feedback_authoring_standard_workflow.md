---
name: Authoring workflow for new Web Everything standards
description: Workflow for designing and standardizing complex domains — use tiered feature tables, open decisions in plans, registry+adapter patterns
type: feedback
originSessionId: 632552c1-a19a-44e5-89e5-307b251ba792
---
**Present scope as a tiered feature-inventory table; capture forks as bold-defaulted open decisions written into the plan, not rapid-fire popups; prefer registry+adapter (provider-contract) patterns over reimplementing third-party libs.**

**Why:** When designing a standard that multiple vendors or libraries need to adopt, the feature scope must be visible upfront (so the user can review and approve before implementation). Open forks should be written into the plan with a recommended default in bold text — this forces the decision to be explicit and reviewable, rather than surfacing as popups mid-conversation which breaks flow. For multi-provider domains (positioning, keyboard handling, context resolution), a registry+contract pattern ("one engine, all consumers delegate") is more maintainable than thin wrappers — each adapter implements one interface, not duplicated.

**How to apply:**
- In **Step 1 (Research)** of design-first.md, produce a feature-inventory table: list every candidate capability, assign disposition (built-in / adapter / compose), and tier (1/2/3). This forces scope clarity before planning.
- In **Step 4 (Plan)** of design-first.md, write open decisions inline in the plan file with **bold recommended defaults**, not as AskUserQuestion popups.
- When designing a plug that enables **many independent components to interoperate**, use `Custom[Name]Registry` + `Custom[Name]` base-contract pattern: one provider per app, all vendors delegate through the injector chain. Keep the contract minimal (often one method), and bridge third-party libs via thin adapters, not reimplements.
