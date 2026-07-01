---
kind: story
size: 8
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Lift the WE-website render under a site/ boundary + add the fail-closed standard-vs-site classifier gate

Interim mechanism ratified by #2006 Fork 2(b): lift the unambiguous WE-website files (we:.eleventy.js, we:vite.config.mts, we:src/*.njk, we:src/_data/*.js loaders, we:src/_includes/*-descriptions/, we:src/assets/) under a site/ root, leaving the standard .json defs + shared we:scripts/lib assembler-loader seam classified in place (split we:src/_data at the file seam, rule 2). Add a check:standards rule that classifies every tracked path as exactly one of {standard-surface, site-surface} and hard-errors on any unclassified path, so new site code can never masquerade as standard. Down-payment on Fork 1(a) extraction (a site/ subtree lifts cleanly to its own repo). The conformance gate/tooling stays WE.
