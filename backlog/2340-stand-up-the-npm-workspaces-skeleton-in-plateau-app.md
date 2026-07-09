---
kind: story
size: 3
parent: "2346"
status: open
dateOpened: "2026-07-09"
tags: []
---

# Stand up the npm-workspaces skeleton in plateau-app

Convert plateau:plateau-app root to an npm-workspaces monorepo without moving product code yet: add a workspaces:[packages/*] entry to the root plateau:package.json, create plateau:packages/ with empty per-production stubs (core, dev-browser, saas, extensions, tooling) each carrying a scoped name (@plateau/<pkg>), its own package manifest, and a tsconfig that extends the root, and wire the root plateau:tsconfig.json path aliases so future moves are drop-in. No source relocated in this slice — it only establishes the skeleton every extraction slice builds on. Verify npm install resolves the workspace graph and the existing app still builds.
