---
kind: story
size: 2
parent: "1294"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Wire the webtheme docs conformance page via the plateau iframe

## Carry (batch-2026-06-29d parallel /workflow — lane WORKED, blocked by pre-existing plateau build-red)

**Progress: the cross-repo false-drop is GONE.** After syncing `plateau-app:origin/main` (it had been 66
commits behind local, so the lane clones reset to a stale tree — the real root cause of the 2026-06-29
false-drops), this run's lane clone saw the real tree and did
**correct** work (registered webtheme in `plateau-app:src/conformance-engine/embedSuites.ts` + config wiring;
authored `we:demos/webtheme-conformance-demo.*` + its `we:src/_data/demos/` entry), gated green in-lane, and
pushed. It did **not** land only because the integrator's **unscoped** `npm run build` on plateau-app was
**already red for a pre-existing reason** (#1965 — entry imports a deleted `@we` SimpleStore block), unrelated
to this item. Released `active→open`; now `blockedBy: #1965`. Re-attempt once #1965 greens the plateau build.
The impl is small and fully described above — just re-do it; the throwaway `lane/batch-2026-06-29d-1909` refs
were cleaned off the WE + plateau-app origins (no salvage needed).

T4 of the webtheme relocation cascade (#1294). Wire the visible webtheme conformance docs page to surface the FUI binding via the plateau-hosted conformance iframe (#1788 ratified (b) — the runner stays a shared plateau tool), no forbidden build-time @frontierui import. Mirrors webcompliance C4 (#1810).

## Carry (batch-2026-06-29 parallel /workflow — lane FALSE-dropped, prereq re-verified PRESENT)

The `/workflow` cross-repo lane agent dropped this `outgrew`, claiming "the plateau-iframe conformance infra this item wires into does NOT exist in plateau-app" (no `plateau-app:src/conformance-engine/embedSuites.ts` / EMBED_SUITES registry). **That verdict was wrong** — re-checked directly: `plateau-app:src/conformance-engine/embedSuites.ts` **does** exist. The prerequisite is present; the work is real and un-done. Released `active→open` for a **serial** re-attempt. Same root cause as #1947: both plateau-app (cross-repo) lanes false-dropped on "doesn't exist" while the WE-only lane (#1905) landed clean — the slice-4 (#1943) lane clones appear not to have had the plateau-app tree visible. Re-run serially (`/batch`), not `/workflow`, until cross-repo lane provisioning is proven (#1153 watch). Also cleared the stale `blockedBy: ["1908"]` (resolved) flagged by the gate.
