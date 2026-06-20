---
type: idea
workItem: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "frontierui:tools/explorer/cli.ts"
crossRef: { url: /backlog/1167-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that/, label: "#1167 autonomous UI tester epic (resolved) — this adds its missing run entrypoint" }
tags: [fui-devtool, exploratory-testing, cli, dx]
---

# Explorer CLI + npm script — run the autonomous stress-test/gate against a URL on the already-running dev server

The explorer (epic #1167) shipped as a programmatic library only — `stressTestComponent` / `sweepSite` / `runGate` in `fui:tools/explorer/`, no runnable entrypoint. Add `fui:tools/explorer/cli.ts` + an `npm run explore -- <url>` script (and a `gate` variant) in `fui:package.json`. The CLI launches a Playwright chromium, **attaches to the already-running dev server** (probe `:3001`/`:8082`, never spin or kill one — the harnesses take a caller-owned `page` for exactly this), opens the URL, runs the EXPLORE profile (`stressTestComponent`) or deterministic GATE profile (`runGate`), and prints Layer-1 findings as markdown (+ `--json`). Mirrors `fui:tools/mock-server/cli.ts`. Prerequisite for the `/stress-test` skill (#1220) and the entrypoint to exercise the Tier-2 judge (#1221).

## Progress — built + verified (2026-06-20, batch-2026-06-20)

- `fui:tools/explorer/cli.ts` — the entrypoint. Parses a positional `<url|path>` + flags (`--gate`, `--json`, `--max-states N`, `--max-depth N`); `resolveUrl` uses an absolute URL verbatim or probes `:3001` then `:8082` (a cheap `fetch` with a 1.5s timeout — never spins/kills a server, exits 2 with guidance if none is up) and joins a path against the first reachable base; launches `chromium` from `@playwright/test`, owns the `page`, runs `stressTestComponent` (EXPLORE, default) or `runGate` (GATE, `--gate`), renders Layer-1 findings as a markdown coverage line + findings table (or `--json`), and `process.exitCode = 1` on a failed gate verdict. Mirrors `fui:tools/mock-server/cli.ts`.
- `fui:package.json` — adds the `explore` and `explore:gate` scripts, both running `fui:tools/explorer/cli.ts` through `vite-node` (the `:gate` one prepends `--gate`). **Runner = `vite-node`** (already present), not `node --experimental-strip-types` as the `fui:tools/mock-server/cli.ts` header suggests: this Node (v22.1.0) predates `--experimental-strip-types` (22.6) and `tsx` is not a dep.
- **Verified live** against the running FUI dev server (`:3001`): `npm run explore -- ` on the `fui:demos/anchored-resize.html` route → 4 states / 6 edges / 100% coverage / ✅ no findings; a 404 path correctly surfaces the `no-console-errors` Layer-1 finding as markdown; `--json` and the gate variant render. The CLI attaches to the caller-owned page exactly as designed.
- **Surfaced + filed #1232:** the GATE profile against the rich docs homepage crashes inside the explorer's in-page `page.evaluate` walk (`getAttribute` of null — a non-Element child node, missing an element-node guard). The CLI catches and reports it cleanly; the fix is in explorer-core (#1168), not this entrypoint — filed as `frontierui` issue #1232, does not block this item.
