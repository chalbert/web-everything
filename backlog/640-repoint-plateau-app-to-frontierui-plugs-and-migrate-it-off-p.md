---
kind: story
size: 5
status: open
blockedBy: ["170", "1545"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-22"
tags: []
---

# Repoint plateau-app to @frontierui/plugs and migrate it off plugged bootstrap to unplugged

plateau-app currently aliases @we/plugs (vite.config.mts:119) and imports the plugged @we/plugs/bootstrap (plateau:src/main.ts:9) — a real app on the demo-only plugged path, violating the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) invariant (origin #606) that real apps use the unplugged surface. Repoint the alias to @frontierui/plugs and migrate plateau-app to unplugged consumption (register/upgrade, no global patching). Blocked on the canonicalization (#170).

## Discovery (2026-06-22, batch-0622) — split into done repoint + blocked migration

Claimed in batch-0622; on inspection the two halves have diverged:

- **Repoint half — already DONE** (by #1046): plateau-app has **zero** `@we/plugs` refs left; `plateau:vite.config.mts` + `plateau:vitest.config.ts` alias `@frontierui/plugs` and the HTML/SSR paths reference `@frontierui/plugs/bootstrap`. The body's `@we/plugs` citations are stale.
- **Unplugged-migration half — BLOCKED on #1545.** Dropping the plugged `bootstrap` for the unplugged surface (`register`/`upgrade`, no global patching) requires plateau-app's **root-document** custom elements (`<route-view>`, the `route:*` attrs, reactive text, etc.) to upgrade without the global `window.customElements` swap. That swap is `applyPatches` step 3 in `fui:plugs/webregistries/index.ts` — still **disabled** (line ~95). #1544 (this batch) implemented the root-scope *determination path* the swap needs but explicitly did **not** re-enable it; the re-enable is **#1545** (`webregistries re-enable root customElements swap`, OPEN). Until #1545 lands, a root-document app cannot consume unplugged.

**State fix:** added `blockedBy: 1545` (the real prerequisite; #170 is resolved). The story stays open and re-surfaces once #1545 resolves. No code change landed (the repoint was already complete; the migration is the blocked residual).
