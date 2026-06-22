---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau-app/tools/dev-panel/vite-plugin.ts"
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

## Resolution 2026-06-22 (focused dev-server-ownership session)

Canonical single copy moved to its ratified Plateau home (#1565) at
`plateau:tools/dev-panel/vite-plugin.ts`; the byte-identical copies were `git rm`'d from
`we:tools/dev-panel/vite-plugin.ts` and `fui:tools/dev-panel/vite-plugin.ts` (each repo keeps its own
runtime selection file `we:.browser-selection.json` / `fui:.browser-selection.json` — the plugin
writes it cwd-relative, so it stays repo-local). The `we:vite.config.mts` and `fui:vite.config.mts`
configs repoint their `devPanel` import to the sibling plateau source.

**Sub-question resolved → single Plateau-owned copy, not a published package.** The "shared package"
option is a non-starter for *this* surface: `devPanel` is a **build-time Vite plugin imported by the
config file itself**, and `resolve.alias` only rewrites the *app* module graph — it never touches the
config's own imports. A named-package boundary would therefore require a real installed
`plateau:@plateau/dev-panel` package (its own manifest + a local-path dependency + install in two
repos) for a single 10.4KB zero-dep file. The direct sibling import is the lightweight,
equally-escapable (dev-only) form of "Plateau-owned single copy" and rides the same `../<sibling>`
checkout assumption the `@frontierui/*` / `weRoot` aliases already depend on.

**Acceptance verified:** editing both config files auto-restarted Vite on :3000 and :3001; both return
`HTTP 200` at root and `/__dev-panel/health` → `{"available":true,...}`, proving the relocated single
copy is consumed correctly by both servers.
