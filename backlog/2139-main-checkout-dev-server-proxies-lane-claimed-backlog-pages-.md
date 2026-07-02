---
kind: story
status: resolved
size: 3
parent: "1143"
relatedTo: ["2123", "2138"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [lane, dev-server, proxy, decision-dx, ports]
---

# Main-checkout dev server proxies lane-claimed backlog pages to the owning lane's server

Working a **decision** in an isolated lane has one real DX gap: the human reviews the live decision card at `/backlog/<NNN>/`, but while the item is being prepared in a lane, the latest version renders only on that lane's offset-port server ([we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](docs/agent/platform-decisions.md): WE lanes at `3000+laneIndex`, `strictPort:true`, env-driven via a generated `.env.local`). Juggling per-lane ports makes decision review painful. Fix: the **main checkout's server stays the single review URL** — port `3000` always shows the latest version — by dynamically proxying a lane-claimed item's backlog page to the lane that owns it.

## Design sketch

- **A lane-port registry.** Lane provisioning ([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs)) already computes the deterministic port offset per lane; have it write/refresh a small registry file in the primary checkout (e.g. `we:.claude/lane-ports.json`): `{ "<NNN>": { port, lane, repo } }`, entries added at claim/provision and removed at teardown/merge. This is the same durable lane-metadata seam #2138 fork 2 needs — one manifest can serve both.
- **A dynamic proxy middleware, not static `server.proxy` entries.** Lanes come and go, and [we:vite.config.mts](vite.config.mts) proxy config is static at boot. Add a tiny Vite plugin (`configureServer`) in the main checkout that, per request to `/backlog/<NNN>/`, reads the registry (cheap fs read or watched) and, when the NNN is lane-claimed and the lane's server answers, forwards to `http://localhost:<lanePort>`; otherwise falls through to the normal 11ty proxy. Result: `3000` serves the lane's newer render for claimed cards and the main render for everything else.
- **Graceful fallback.** If the lane's server isn't up (probe fails / connection refused), serve the main checkout's version — never a broken page. A small banner injected by the proxy ("rendered from lane N") would make the source unambiguous, optional.
- **Caveats to handle:** assets (CSS/JS) still come from the main server unless the whole request tree is forwarded — acceptable for card review, but forwarding the full path prefix per request is simpler and correct; live-reload websockets belong to the lane's server, so a proxied page may need manual refresh (document it, or proxy the ws upgrade for lane-owned paths too).

Scope: WE band only (backlog pages live in WE); decision lanes are the motivating case (#2123's review concern) but it works for any lane-claimed item's card. Acceptance: with a decision item claimed in a lane, editing the item in the lane and refreshing `http://localhost:3000/backlog/<NNN>/` shows the lane's version; after teardown, the same URL falls back to main with no restart.

## Progress

- **Built as designed, all three seams (2026-07-02):** the pure half (registry parse + URL→lane resolution) in [we:scripts/dev/lane-page-proxy.mjs](scripts/dev/lane-page-proxy.mjs) (13 unit tests); the registry CLI as `map`/`unmap` commands on [we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) (writes `we:.claude/lane-ports.json`, git-ignored; auto-unmaps on `remove`, `refresh`, and `provision` since a reset lane no longer renders its item); the dynamic middleware as the `lanePageProxy` plugin in [we:vite.config.mts](vite.config.mts) (per-request registry read, GET/HEAD only, any failure falls through to the normal 11ty proxy).
- **One design refinement over the sketch:** lane-pool can't own the *item*→lane mapping at provision time (it doesn't know items — the dispatcher does), so the registry is maintained by explicit `map`/`unmap` at dispatch, with teardown/refresh cleanup wired in.
- **Verified live against the running dev server (no restart):** mapped item + lane down → main render (fallback); stub lane server on the mapped port → `:3000` serves the lane's response for slugged, bare-number, and query-string URLs while an unmapped item stays on main; `unmap` → main render restored.
