---
kind: story
size: 3
parent: "1353"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:demos/wizard-demo.html"
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

## Progress (2026-06-21 — batch-2026-06-20-1358-1357, RESOLVED)

Executed the #1326-pattern swap. **Verified preconditions first:** `fui:demos/wizard-demo.html` already
self-bootstraps the wizard over a portable `WorkflowGraph` through `customWorkflowEngine` (#925) — covers
the wizard + workflow-engine combination — and serves 200 on :3001. WE-local dependency graph confirmed
safe: `we:blocks/wizard` imports only `we:blocks/workflow-engine` (both deleted together) and the demo
(`we:demos/wizard-flow-demo.ts`, deleted); there is **no `we:blocks/workflow` dir** (its catalog/CEM entries
already point at FUI) and no external WE runtime importer.

**Changes (all webeverything):**
- Swapped `we:demos/wizard-flow-demo.html` to a #701 fuiDemo iframe shell embedding `fui:demos/wizard-demo.html`
  (served on :3001; mirrors the `we:demos/view-tabs-demo.html` #1326 model).
- Deleted the WE-local runtime + demo assets: `we:blocks/wizard/`, `we:blocks/workflow-engine/`,
  `we:demos/wizard-flow-demo.{ts,css}`, and the runtime e2e `we:blocks/__tests__/e2e/wizard-flow-demo.spec.ts`
  (the runtime — and its tests — now live in FUI; WE holds zero delivery runtime).
- Rewrote `we:src/_data/demos/wizard-flow-demo.json` to the iframe-hosted framing (status `draft`→`active`,
  dropped the in-page-runtime / spec-drift claims), matching the view-tabs entry.

**Kept (correct per the #1326 precedent — WE owns the standard, FUI the runtime):** the catalog entries
`we:src/_data/blocks/{wizard,workflow-engine}.json` (already `implementedBy: @frontierui/...`), the CEM
`we:custom-elements.json` (regenerated → no diff; `gen-cem` sources the kept catalog), the doc descriptions
`we:src/_includes/block-descriptions/{wizard,workflow-engine}.njk`, and the `/blocks/wizard/` sitemap route
test (it asserts the catalog-driven **block page**, which still renders). The card's pre-flight list of these
as deletions was over-specified.

**Verified:** `npm run check:standards` → 0 errors. Playwright on the served `we:demos/wizard-flow-demo.html`
(:3000) → iframe shell renders, FUI demo loads (:3001), `<wizard-flow>` mounted and live ("Current: account ·
status process"), no page errors.
