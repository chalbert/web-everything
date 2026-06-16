---
type: issue
workItem: story
size: 3
parent: "723"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# FUI demos public catalog — gallery page + nav (auto-rendered from a demos registry)

24 demos/*.html exist in FUI with no public /demos/ catalog or nav; add a demos registry (scan or JSON) + a catalog .njk + nav link, curating out internal dev tooling. From the #723 audit.

## Progress

- Added `src/_data/demos.js` — a **scan-based** registry that reads repo-root `demos/*.html`, pulls each `<title>` (stripping the " | Web Everything" suffix), and emits `{slug, name, href}`. New demos appear automatically. Internal dev tooling (`dev-panel` Spec Explorer) is curated out via a `CURATED_OUT` set.
- Added `src/demos.njk` (`/demos/`) gallery grid (22 demos after curation) + a "Demos" nav entry in `src/_layouts/base.njk`.
- Added `site.demosUrl` (dev → `http://localhost:3001` Vite, build → relative same-origin) so catalog cards link to the runnable `.html` demos; links open in a new tab in dev (cross-port).
