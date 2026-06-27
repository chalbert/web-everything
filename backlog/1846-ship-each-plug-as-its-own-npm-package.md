---
kind: story
size: 3
parent: "1836"
status: open
dateOpened: "2026-06-27"
tags: [plugs, packaging, exports, conformance]
---

# Verify every plug has a clean subpath export + tree-shakes independently

**Reframed by the #1837 ruling (upheld #1045 — monolith `@frontierui/plugs`, not per-plug packages).** The minimal-install goal the original "ship each plug as its own npm package" ask cited is already delivered by subpath exports + tree-shaking, so this is now a **conformance check on the existing monolith**, not a split: confirm every plug domain is reachable via a clean `@frontierui/plugs/<domain>` subpath and tree-shakes without dragging in the others.

The load-bearing gap for the parent epic's "every plug functional" goal: **only 8 of the 19 plug domains are exported today** (`./core`, `./webregistries`, `./webinjectors`, `./webcomponents`, `./webcontexts`, `./webbehaviors`, `./webstates`, `./webexpressions`). The **11 unexported domains have no published access at all** — for them the consumer's choice isn't "monolith vs per-plug", it's "no subpath yet":

- `webanalytics`
- `webdirectives`
- `webguards`
- `webidentity`
- `webnotifications`
- `webportals`
- `webrealtime`
- `webresources`
- `webtheme`
- `webtraces`
- `webvalidation`

## Scope

1. Add a clean subpath export to `fui:plugs/package.json` for each of the 11 unexported domains above (public index entry per domain; no deep-reach into private files).
2. Add a conformance check that asserts every plug domain has a subpath export and that importing one domain tree-shakes the rest (no cross-domain pull-in beyond declared runtime seams).
3. The genuine per-package work survives only as the #1837 option-(c) `-labs` exception — file a fresh card if a specific plug's API destabilises; do **not** split per-feature.

The future external `npm install` consumer (#872/#907) — add a build step + `sideEffects: false` — rides on #872, not here.
