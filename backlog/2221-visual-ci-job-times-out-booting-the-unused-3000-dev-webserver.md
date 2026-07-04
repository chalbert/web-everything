---
kind: task
status: active
dateOpened: "2026-07-04"
tags: []
---

# `visual` CI job times out booting the unused :3000 dev webServer

The `visual` job in we:.github/workflows/ci.yml builds the docs and serves `_site` statically on :8080
itself (`npx serve _site --listen 8080`), then runs `npm run check:visual`
(`playwright test --project=chromium tests/visual`). But we:playwright.config.ts's `webServer[0]` boots
`npm run dev` (Vite :3000) and waits on `http://localhost:3000`. The visual specs pin their baseURL to
`WE_ELEVENTY_PORT ?? 8080` (we:tests/visual/rendered-site-visual.spec.ts,
we:tests/visual/fui-card-cross-origin-render.spec.ts) — they hit :8080 and never touch :3000 — so the
:3000 boot is pure dead weight, and in CI it never binds within the 120s `webServer` timeout, failing the
whole job (`Error: Timed out waiting 120000ms from config.webServer`).

Because the `visual` job is unrequired (branch protection gates on `test` alone, #2220), this has left
**every** main CI run red for a long stretch — no green CI run in the last 25 as of 2026-07-04. A
permanently-red gate that nobody watches is exactly how the #2184 `build:docs` breakage reached main
unnoticed for ~6h. Restoring `visual` to a real pass/fail signal is the point of this item.

## Fix

Add a `WE_PREBUILT_SITE` env flag to we:playwright.config.ts that drops `webServer[0]` (the :3000 dev
server) when set — mirroring the existing `WE_INTERACTION_ONLY` skip, but named for the
prebuilt-and-externally-served case (the visual job already serves :8080). Set `WE_PREBUILT_SITE: "1"` on
the `Visual regression` step in we:.github/workflows/ci.yml. The visual specs continue to hit the static
:8080 server; the redundant :3000 boot (and its timeout) is gone.

Landed together with this item — the same PR that files it fixes it.
