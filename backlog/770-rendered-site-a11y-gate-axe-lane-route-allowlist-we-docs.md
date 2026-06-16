---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["763"]
dateOpened: "2026-06-16"
tags: []
---

# Rendered-site a11y gate — axe lane + route allowlist (WE-docs)

Add @axe-core/playwright to the existing Playwright integration lane (reuses the running dev servers per playwright.config.ts:24-41) and gate a hand-maintained allowlist of WE-docs URLs (:8080 here, proxied via :3000) against WCAG 2.1 A/AA tags. Warn-only ratchet first (advisory over the curated route set), flip to build-blocking once the set is green. Ratified in #763 fork 1/2/3 = A/A/A.
