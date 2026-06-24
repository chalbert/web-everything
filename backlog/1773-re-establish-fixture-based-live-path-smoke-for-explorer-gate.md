---
kind: story
size: 3
parent: "1522"
status: open
dateOpened: "2026-06-24"
locus: plateau-app
blockedBy: [1577]
tags: [explorer, exploratory-testing, plateau, test-coverage]
---

# Re-establish fixture-based live-path smoke for explorer gate + component harnesses

The #1577 FUI→plateau relocation dropped three browser smoke specs under plateau:tools/explorer/__tests__/ (the workbench, gate, and docs-sweep smoke lanes) because they hardcoded FUI-only surfaces (fui:demos/workbench.html, the FUI docs site) that don't exist in plateau-app. The surviving fixtures smoke lane in plateau:tools/explorer/__tests__/ covers the sweepSite live path generically against synthetic HTML fixtures, but the runGate (GATE profile) and stressTestComponent (live component stress) paths lost their end-to-end smoke coverage — only their unit lanes remain. Re-establish charter-pure coverage: author synthetic fixtures + smoke specs exercising runGate and stressTestComponent against plateau:tools/explorer/fixtures (no app-specific routes), wired into plateau:playwright.config.ts against the :4000 dev server. locus:plateau.
