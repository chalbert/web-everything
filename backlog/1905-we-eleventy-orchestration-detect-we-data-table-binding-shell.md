---
kind: story
size: 5
parent: "1600"
locus: webeverything
status: open
blockedBy: ["1902", "1904"]
dateOpened: "2026-06-28"
tags: [data-table, ssr, build-integration, eleventy]
---

# WE Eleventy orchestration: detect we-data-table binding, shell out to FUI CLI, splice SSR

Slice C of the #1867 harness — the integration slice. A new WE Eleventy build hook (`we:.eleventy.js:259-272` seam) detects a `we-data-table` `rows` web-expression binding, gathers the deterministic build context, shells out to the FUI build-CLI (slice A, #1902) over the subprocess boundary, and splices the returned SSR `<table>` HTML. The build NEVER reads the dev /_maas/data/ route (#workbench-inert-data-static-slot). No build-time evaluator or FUI subprocess exists in WE today (we:src/_data/buildId.js:7,11 is the only execSync). Demoable on one real #1600-family surface or a build fixture. Homed in WE (locus: webeverything). blockedBy A (#1902, the CLI) and B (#1904, the enhancer).
