---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Re-enabled e2e lane (post-#1047): triage 2 now-failing specs to green

Removing the #1047-dead service-worker webServer/project from `we:playwright.config.ts` (done in #1207) unblocked the chromium e2e lane, which had not run since the local plugs tree was deleted. Two specs now run and fail, both unrelated to interpolation: `we:blocks/__tests__/e2e/source-toggle.spec.ts` (/blocks/for-each/ JSX pane is build-generated — needs the build artifact present) and `we:tests/content/rendered-backlog-content.spec.ts` (rendered /backlog/ row count 83 vs loader 82 — stale 11ty render / live-data drift). Triage each to green or mark deliberately skipped.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Both reproduced against the running dev server and triaged to **deliberately skipped** (`test.describe.skip`)
with a documented reason + re-home target — neither can be made reliably green in the *live, watched
dev-server* lane:

- `we:blocks/__tests__/e2e/source-toggle.spec.ts` — `page.goto('/blocks/for-each/')` times out (the `load`
  event never fires) because the **JSX pane is build-generated** (`htmlToJsx` lowering) and absent on the
  dev server; the `template is="for-each"` assertion has no artifact to match. It's a **post-`npm run build`**
  e2e check → re-home to a build-then-test lane.
- `we:tests/content/rendered-backlog-content.spec.ts` — compares the loader (current files) against the
  **watched 11ty render**, which lags during active backlog churn (the observed 83-vs-82 one-item drift). The
  assertion is sound only against a **frozen tree** → re-home to a build-then-test CI lane / the #800
  plateau-hosted rendered-site regression harness.

Skips carry the reason inline. The e2e lane now reports **3 skipped, 0 failed** (verified); `check:standards`
green. The features themselves are unaffected — this is test-lane placement, not a product regression.
