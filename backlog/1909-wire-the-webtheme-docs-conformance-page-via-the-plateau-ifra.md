---
kind: story
size: 2
parent: "1294"
status: active
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
tags: []
---

# Wire the webtheme docs conformance page via the plateau iframe

T4 of the webtheme relocation cascade (#1294). Wire the visible webtheme conformance docs page to surface the FUI binding via the plateau-hosted conformance iframe (#1788 ratified (b) — the runner stays a shared plateau tool), no forbidden build-time @frontierui import. Mirrors webcompliance C4 (#1810).

## Carry (batch-2026-06-29 parallel /workflow — lane FALSE-dropped, prereq re-verified PRESENT)

The `/workflow` cross-repo lane agent dropped this `outgrew`, claiming "the plateau-iframe conformance infra this item wires into does NOT exist in plateau-app" (no `plateau-app:src/conformance-engine/embedSuites.ts` / EMBED_SUITES registry). **That verdict was wrong** — re-checked directly: `plateau-app:src/conformance-engine/embedSuites.ts` **does** exist. The prerequisite is present; the work is real and un-done. Released `active→open` for a **serial** re-attempt. Same root cause as #1947: both plateau-app (cross-repo) lanes false-dropped on "doesn't exist" while the WE-only lane (#1905) landed clean — the slice-4 (#1943) lane clones appear not to have had the plateau-app tree visible. Re-run serially (`/batch`), not `/workflow`, until cross-repo lane provisioning is proven (#1153 watch). Also cleared the stale `blockedBy: ["1908"]` (resolved) flagged by the gate.
