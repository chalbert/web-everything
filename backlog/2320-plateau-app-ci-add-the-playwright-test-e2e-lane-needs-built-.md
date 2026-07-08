---
kind: story
size: 3
parent: "2241"
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: []
---

# plateau-app CI: add the Playwright test:e2e lane (needs built-and-served app)

Follow-up to #2243, which added plateau-app's `test` CI job but deferred the Playwright leg to keep the first required check deterministic. `we:.github/workflows/ci.yml` (plateau-app) currently runs the vitest suite + `check:render-conformance` only; `npm run test:e2e` (playwright) is NOT wired. Add it: install Playwright browsers, build the app (`npm run build`) and serve it (vite `preview`, strict port), then run `test:e2e` against the served instance — mirroring WE's served-app lane pattern (#2070/#800) rather than the fixture-server lane. Decide whether e2e runs in the same `test` job (keeps one required check) or a separate job that is NOT required (avoids browser flakiness blocking the drain). Keep the 3-repo sibling checkout (plateau-app + webeverything + frontierui via FUI_READ_TOKEN) the `test` job already provisions. relatedTo #2243, #2241.
