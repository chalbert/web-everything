---
kind: story
size: 3
parent: "1353"
status: open
dateOpened: "2026-06-20"
tags: []
---

# FUI-host wizard-flow demo, swap WE page to #701 iframe, delete we:blocks/{wizard,workflow-engine}

Build fui:demos/wizard-flow-demo.html combining the (complete) FUI wizard + workflow-engine impls; swap we:demos/wizard-flow-demo.html to a #701 fuiDemo iframe; delete we:blocks/{wizard,workflow-engine} + we:demos/wizard-flow-demo.{ts,css}. #1326 pattern.

## Pre-flight note — demo precondition MET, but a coordinated WE-catalog deletion; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Better positioned than siblings #1355/#1356: the self-bootstrapping FUI demo **already exists** —
`fui:demos/wizard-demo.html` (title "Wizard Flow Demo") imports `fui:blocks/wizard/WizardElement.ts`,
calls `registerWizard()`, and drives `<wizard-flow>` over a portable `WorkflowGraph` through
`customWorkflowEngine` (#925). So the build step is largely done (confirm it covers the workflow-engine
combination, and decide whether to keep the `fui:demos/wizard-demo.html` name or rename it to
`fui:demos/wizard-flow-demo.html`).

What makes this >size-3: deleting `we:blocks/{wizard,workflow-engine}` is a **coordinated multi-file
removal**, not a clean dir delete. WE references to retire/regenerate (grepped 2026-06-20): the per-entry
catalog files `we:src/_data/blocks/{wizard,workflow,workflow-engine}.json`, the CEM `we:custom-elements.json`
(regenerate), the doc descriptions `we:src/_includes/block-descriptions/{wizard,workflow-engine}.njk`, and
the tests `we:tests/a11y/__tests__/sitemap-routes.test.ts` + `we:scripts/__tests__/check-standards-rules.test.mjs`.
Plus the WE page must be browser-verified rendering the fuiDemo iframe after the swap. A focused session
with both dev servers; verify the FUI copies are complete and no other WE consumer imports these blocks
before deleting.
