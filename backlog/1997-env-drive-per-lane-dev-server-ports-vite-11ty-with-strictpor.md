---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Env-drive per-lane dev-server ports (vite + 11ty) with strictPort + generated .env.local

Implements #1996 Fork 2. Make WE's vite server.port + every 11ty proxy target and the 11ty --port read from WE_VITE_PORT/WE_ELEVENTY_PORT (defaults 3000/8080 unchanged), set strictPort:true + changeOrigin:true in we:vite.config.mts, and have we:scripts/lane-pool.mjs write a generated .env.local per clone with pure deterministic per-index offsets in WE's 3000+/8080+ band. Unblocks per-clone dev servers (support-both) and the Fork 5 visual harness.
