---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plugs/__tests__/e2e/sw-fixtures/ + chromium-sw Playwright project (real-browser SW rehydration lane)
relatedProject: webintents
tags: [testing, e2e, service-worker, background-fetch, harness, verification]
---

# Real-browser E2E lane: service-worker + Background Fetch verification harness

Establish the real-Chromium E2E lane that SW/Background-Fetch verification items depend on: a Playwright context with `serviceWorkers: 'allow'`, a register→arm→hard-reload→assert-rehydrate helper, and a Background-Fetch-absent context for the fallback branch. Unblocks #675 (and any future durable-tier verification). The harness, not the feature — its DoD is a sample SW spec going green in a real browser via `npm run test:integration`.

## Why this is its own item (the agent-runnable-verification rule)

#675 ("Background Task durable tier — live-browser/SW end-to-end verification") cannot be *correctly tested* on the existing tiers: Vitest runs under happy-dom (no service worker, no Background Fetch) and the default Playwright E2E lane doesn't configure SW registration or the Background-Fetch surface. Per the **"every verification must be agent-runnable"** rule (`we:docs/agent/testing.md`), a verification item whose proof needs a real runtime must have that runtime's harness as a **resolved `blockedBy` dependency** — otherwise the verification is a claim no agent can reproduce. This card *is* that harness; #675 now `blockedBy: ["684"]`.

## Scope

- **Real-Chromium context** — a Playwright project/fixture launching Chromium (headed or `--headless=new`) with `serviceWorkers: 'allow'`, serving the demo over `http://localhost` (the dev server / a static fixture server), since SW + Background Fetch require a secure-context-equivalent origin.
- **Rehydration helper** — a reusable `registerSW → arm transfer → page.reload() (hard) → assert surface re-hydrates the in-flight task` helper, so any durable-tier page can assert reload-survival in one call.
- **Fallback context** — a second context where Background Fetch is unavailable (feature-detect stub or a non-supporting engine), to assert the navigation-guard re-arms (the degraded path #134 ships).
- **Wiring** — register the lane under `plugs/__tests__/e2e/` (or the established E2E location) so `npm run test:integration` runs it; document the real-browser requirement in `we:docs/agent/testing.md`'s pyramid.

## DoD

A sample SW-registered spec (register → arm → hard-reload → rehydrate, plus the fallback assertion) goes **green in a real browser** via `npm run test:integration`. The residual that genuinely needs a flagged/real profile (a true Background Fetch network transfer surviving reload) is documented as the one manual step, if it can't be driven headlessly even with `--headless=new`.

## Progress

Resolved 2026-06-15. WE locus (commit → webeverything). All four scope points delivered; the lane is green in real Chromium.

- **Real-Chromium context** — new `chromium-sw` Playwright project ([we:playwright.config.ts](../playwright.config.ts)) with `serviceWorkers: 'allow'`, `baseURL: http://localhost:3210`, matching only `**/*.sw.spec.ts`. The default `chromium` project now `testIgnore`s `*.sw.spec.ts`, so the lanes don't overlap (verified via `--list`: `sw.spec` → 2 tests under `chromium-sw` only; `chromium` = 251, unchanged).
- **Static fixture server** — `we:plugs/__tests__/e2e/sw-fixtures/serve.mjs`, a **zero-dependency** Node `http` server (no new package, no Vite transform) serving `sw-fixtures/public/` on :3210 with `Service-Worker-Allowed: /` + `Cache-Control: no-store`. Added as a second `webServer` entry (array form), `reuseExistingServer` locally.
- **Fixture SW + page** — `we:public/sw.js` (in-flight task registry, MessageChannel replies, `skipWaiting`/`clients.claim`) + `we:public/index.html` (registers the SW, re-hydrates held tasks on load, exposes the `window.__durable` contract).
- **Rehydration helper** — `we:sw-fixtures/rehydrate-helper.ts`: `assertSurvivesHardReload(page, task)` = ready → arm → `page.reload()` → ready → assert the worker re-hydrated. One call, drives any page implementing the `window.__durable` contract.
- **Fallback context** — the second spec opens a context that sets `window.__forceNoBgFetch` via `addInitScript`, asserts the page's feature-detect reports Background Fetch absent, and asserts the degraded (navigation-guard re-arm) path still survives a hard reload with the task marked `bgFetch:false`.
- **Wiring + docs** — registered under `plugs/__tests__/e2e/` (so `npm run test:integration` includes it via the project) and documented the real-browser requirement + the manual residual in [we:docs/agent/testing.md](../docs/agent/testing.md)'s pyramid.

**DoD met:** `npx playwright test --project=chromium-sw` → **2 passed (1.7s)** in real Chromium (register→arm→hard-reload→rehydrate + the Background-Fetch-absent fallback). `npm run check:standards` = 0 errors (28 pre-existing warnings, none mine). **Manual residual** (per DoD): a true Background-Fetch *network* transfer surviving reload may need a flagged/real Chromium profile — the harness drives the SW-state reload-survival headlessly; the network-transfer branch is the documented one manual check.

**Unblocks #675** (`blockedBy: ["684"]`) — the durable-tier verification can now assert reload-survival against this lane.
