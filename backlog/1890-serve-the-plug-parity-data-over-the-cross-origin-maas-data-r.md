---
kind: story
size: 2
parent: "1836"
locus: frontierui
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: []
---

# Serve the plug parity data over the cross-origin MaaS data route (FUI)

FUI. Serve the parity manifest (S5a/#1887) over the existing cross-origin MaaS data route — mirror the fui:tools/maas/vite-plugin.mjs:80-88 data-route handler (the existing per-tag JSON route) with a parity data route. This is the cross-origin data path #1839 mandates for the verdict reaching the WE doc-site. Blocked by #1887 (needs the manifest to serve).

## Progress (batch-2026-06-27)

Added `fui:tools/maas/parityServeHandler.mjs` — a framework-agnostic Fetch-in/out handler mirroring the
`/_maas/data/` route, served under `/_maas/parity/`:
- `GET /_maas/parity/` → aggregate `{ domains: [manifest, …] }`, domain-sorted (one fetch for the doc-site).
- `GET /_maas/parity/<domain>.json` → the single plug manifest, or 404.
CORS-open (`Access-Control-Allow-Origin: *`), JSON content-type. Source is `readParityManifests(plugsDir)`
reading each `fui:plugs/*/parity.json` **per request** (a re-seeded manifest serves without a restart;
malformed manifests are skipped — shape is the #1889 drift gate's job). Wired as a Vite middleware in
`fui:tools/maas/vite-plugin.mjs`, registered before `/_maas/` (more-specific prefix wins) via the shared
Fetch↔Node-stream adapter. Unit-tested with an injected source
(`fui:tools/maas/__tests__/parityServeHandler.test.mjs`, 6 tests):
aggregate order, per-domain 200, unknown-domain 404, non-parity-path 404, CORS on every response, lazy
resolution. `locus` added (the card lacked it; FUI-runtime data path).
