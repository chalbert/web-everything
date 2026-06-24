---
kind: story
size: 5
parent: "1663"
status: resolved
blockedBy: []
locus: frontierui
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1663
tags: []
---

# Repro-bundle viewer and replay UI components

Build the FUI components the plateau dev-browser tool composes to view and replay a repro bundle: a bundle inspector that renders the declared-state snapshot, the declared rules and the ownership map; a replay timeline that steps through the action trace; and ownership chips surfacing who owns each node so a recipient can self-route. Pure presentation over the #1664 contract shape — no capture dependency. Lands as FUI components (fui:) consumed by the plateau export+replay tool.

## Progress (batch-2026-06-23-1725-1665) — DONE

Built the FUI Repro Bundle Viewer block — three pure-presentation components over the WE-owned `ReproBundle` shape (`we:repro-bundle/contract.ts`, #1664), consumed type-only (no capture dependency):
- `fui:blocks/repro-bundle/BundleInspector.ts` — `createBundleInspector(bundle)` renders the three static parts: per-snapshot scope→key/value tables (labelled by `label`/`seq`), declared rules (kind badge · id · contract · description · vectorIds), the ownership table.
- `fui:blocks/repro-bundle/ReplayTimeline.ts` — `createReplayTimeline(bundle)` renders the action trace in `seq` order as a step-through timeline; real `<button>` prev/next, active step `aria-current="step"`, bounds clamp, surfaces the snapshot in force (latest `seq ≤` active). Pure presentation — steps the recorded trace, no replay execution.
- `fui:blocks/repro-bundle/OwnershipChips.ts` — `createOwnershipChips(ownership)` renders one node→owner chip per edge (badge/tag aesthetic) so a recipient self-routes.
- `fui:blocks/repro-bundle/index.ts` barrel (factories + CSS + combined `mountInDocument` showcase over `reproBundleGolden`); `fui:demos/repro-bundle-demo.html`; `fui:blocks/__tests__/unit/repro-bundle/` (24 tests green).
- Registered the block in `fui:src/_data/blocks.json`; added the `@webeverything/contracts/repro-bundle` → `we:repro-bundle/index.ts` alias to `fui:vite.config.mts`, `fui:tsconfig.json`, and `fui:vitest.config.ts` (FUI's vitest keeps its own alias map).

Every bundle value reaches the DOM via `textContent`, never `innerHTML` (escape-safe). Verified live on :3001: 2 timeline buttons, 3 inspector tables, 11 ownership chips, 1 `aria-current`, 0 console errors. FUI gate 0 errors. Consumed by the plateau export+replay tool (#1666/#1667). Cleared the stale `blockedBy: 1664`.
