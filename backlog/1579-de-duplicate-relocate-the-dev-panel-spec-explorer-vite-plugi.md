---
kind: story
size: 3
status: open
humanGate: { kind: setup, what: "Relocating the dev-panel Vite plugin de-duplicates a file BOTH live dev servers load at config time — `we:vite.config.mts:4` and `fui:vite.config.mts:3` each `import { devPanel } from './tools/dev-panel/vite-plugin'` (byte-identical 10.4KB source). Any relocation repoints those imports (or a config-dependency stub), which restarts Vite on :3000 AND :3001, and the acceptance ('keeps both dev servers working') requires rebooting both to verify. A concurrent batch can't restart/verify the user's running :3000/:3001 (don't-kill-dev-server). Needs a focused session that owns the WE+FUI dev-server lifecycle — same class as #1545/#1561." }
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

# De-duplicate + relocate the dev-panel / spec-explorer Vite plugin to Plateau

Per #1565 (we:docs/agent/platform-decisions.md#devtools-placement): the spec-explorer / dev-panel Vite plugin is byte-duplicated across we:tools/dev-panel/ and fui:tools/dev-panel/ (project_dev_panel_plugin_duplicated). It is an operated dev surface → Plateau. Relocate AND de-duplicate. Sub-question for this slice: Plateau-owned single copy vs a shared package each dev server (WE :3000, FUI :3001) consumes — pick the one that keeps both dev servers working with zero lock-in.

## Pre-flight 2026-06-22 (batch-2026-06-22-1580-1579-1030-1564) — humanGate `setup` (dev-server-ownership)

Grounded: `we:tools/dev-panel/vite-plugin.ts` and `fui:tools/dev-panel/vite-plugin.ts` are **byte-identical**
(10463 B), and both `vite.config.mts` files import `devPanel` from their repo-local copy at **config load
time** (WE `vite.config.mts:4`/`:94`, FUI `vite.config.mts:3`/`:86`). De-duplicating *requires* repointing
those imports to a shared/Plateau home — a `vite.config` (or config-dependency) edit that **restarts Vite on
both :3000 and :3001** — and the acceptance criterion ("keeps both dev servers working") can only be met by
rebooting both and confirming they boot clean. That cannot run safely against the user's live servers in a
concurrent batch (don't-kill-dev-server). Gated `setup` so it demotes out of Tier-A until a focused session
owns the WE+FUI dev-server lifecycle. The sub-question (single copy vs shared package) is also still open —
the shared-package option is what "keeps both working with zero lock-in," but confirm at execution.
