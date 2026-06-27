---
name: project_dev_panel_plugin_duplicated
description: dev-panel BACKEND plugin de-duplicated to Plateau (#1579); FRONTEND demos/dev-panel.html still copied in WE+FUI and now drifted
metadata: 
  node_type: memory
  type: project
  originSessionId: 0bad5e23-04e5-46bd-807d-7d4f2cf70d4d
---

The Spec Explorer "dev panel" — which spawns the local Claude Code binary and streams responses over SSE to an in-page iframe — has a backend Vite plugin AND a frontend HTML page. Across the [[reference_repo_constellation]]:

- **backend `tools/dev-panel/vite-plugin.ts` — DE-DUPLICATED (#1579, 2026-06-22).** Single canonical copy now at `plateau:tools/dev-panel/vite-plugin.ts` (its ratified home per #1565 devtools-placement); WE :3000 and FUI :3001 configs import it from the sibling plateau source. The cross-repo mechanism is a sibling-path import, NOT a `resolve.alias` (a plugin is config code — see [[project_vite_config_plugin_no_alias]]). Each repo keeps its own runtime `.browser-selection.json` (cwd-relative).
- **frontend `{webeverything,frontierui}/demos/dev-panel.html` — STILL DUPLICATED and now DRIFTED** (no longer byte-identical: WE 21920 B vs FUI 20623 B, differ ~line 79 as of 2026-06-22). Not in #1579's scope. Per #1565 this operated dev surface should also relocate to a single Plateau home — UNFILED follow-up; check `grep -ril dev-panel backlog/` before filing.

They run concurrently, so an error seen "on the site" may originate from whichever port the open tab is on — check the cwd of the listening process (`lsof -p <pid> -d cwd`) to know which repo/port produced it.

**Why:** the frontend was copy-pasted and has since diverged — a bug fixed in one silently persists in the other, and the two now differ in unintended ways.

**How to apply:** the backend plugin is now single-source — edit only `plateau:tools/dev-panel/vite-plugin.ts`, verify each live via `curl localhost:{3000,3001}/__dev-panel/health`. For the frontend HTML, until it's relocated, apply identical changes to BOTH `demos/dev-panel.html` copies (diff them first — they already differ).

Concrete instance (2026-06-02, pre-relocation): `findClaudeBinary()` hardcoded `<version>/claude`, but the managed Claude Desktop install now ships `<version>/claude.app/Contents/MacOS/claude` → `spawn ... ENOENT`. Fix hardened discovery (env override `DEV_PANEL_CLAUDE`/`CLAUDE_BIN` → PATH → managed install checking both `.app` bundle and bare-binary layouts, validated with `accessSync(X_OK)`).
