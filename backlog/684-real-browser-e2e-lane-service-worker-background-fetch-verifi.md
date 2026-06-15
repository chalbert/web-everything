---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-15"
relatedProject: webintents
tags: [testing, e2e, service-worker, background-fetch, harness, verification]
---

# Real-browser E2E lane: service-worker + Background Fetch verification harness

Establish the real-Chromium E2E lane that SW/Background-Fetch verification items depend on: a Playwright context with `serviceWorkers: 'allow'`, a register→arm→hard-reload→assert-rehydrate helper, and a Background-Fetch-absent context for the fallback branch. Unblocks #675 (and any future durable-tier verification). The harness, not the feature — its DoD is a sample SW spec going green in a real browser via `npm run test:integration`.

## Why this is its own item (the agent-runnable-verification rule)

#675 ("Background Task durable tier — live-browser/SW end-to-end verification") cannot be *correctly tested* on the existing tiers: Vitest runs under happy-dom (no service worker, no Background Fetch) and the default Playwright E2E lane doesn't configure SW registration or the Background-Fetch surface. Per the **"every verification must be agent-runnable"** rule (`docs/agent/testing.md`), a verification item whose proof needs a real runtime must have that runtime's harness as a **resolved `blockedBy` dependency** — otherwise the verification is a claim no agent can reproduce. This card *is* that harness; #675 now `blockedBy: ["684"]`.

## Scope

- **Real-Chromium context** — a Playwright project/fixture launching Chromium (headed or `--headless=new`) with `serviceWorkers: 'allow'`, serving the demo over `http://localhost` (the dev server / a static fixture server), since SW + Background Fetch require a secure-context-equivalent origin.
- **Rehydration helper** — a reusable `registerSW → arm transfer → page.reload() (hard) → assert surface re-hydrates the in-flight task` helper, so any durable-tier page can assert reload-survival in one call.
- **Fallback context** — a second context where Background Fetch is unavailable (feature-detect stub or a non-supporting engine), to assert the navigation-guard re-arms (the degraded path #134 ships).
- **Wiring** — register the lane under `plugs/__tests__/e2e/` (or the established E2E location) so `npm run test:integration` runs it; document the real-browser requirement in `docs/agent/testing.md`'s pyramid.

## DoD

A sample SW-registered spec (register → arm → hard-reload → rehydrate, plus the fallback assertion) goes **green in a real browser** via `npm run test:integration`. The residual that genuinely needs a flagged/real profile (a true Background Fetch network transfer surviving reload) is documented as the one manual step, if it can't be driven headlessly even with `--headless=new`.
