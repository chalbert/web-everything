---
kind: task
status: open
dateOpened: "2026-06-22"
tags: []
---

# Re-enabled e2e lane (post-#1047): triage 2 now-failing specs to green

Removing the #1047-dead service-worker webServer/project from `we:playwright.config.ts` (done in #1207) unblocked the chromium e2e lane, which had not run since the local plugs tree was deleted. Two specs now run and fail, both unrelated to interpolation: `we:blocks/__tests__/e2e/source-toggle.spec.ts` (/blocks/for-each/ JSX pane is build-generated — needs the build artifact present) and `we:tests/content/rendered-backlog-content.spec.ts` (rendered /backlog/ row count 83 vs loader 82 — stale 11ty render / live-data drift). Triage each to green or mark deliberately skipped.
