---
kind: story
size: 5
status: resolved
parent: 1327
blockedBy: ["1371"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/blocks/droplist.json
tags: []
---

# Block/plug curation pass — flag isConcept names for the glossary

Per #1343's ratified A + isConcept opt-in: review the 80 blocks + 53 plugs to surface which carry a load-bearing naming choice — a contested industry term WE disambiguated (e.g. tag vs chip/pill/token) — and flag those isConcept: true, then author their glossary terms. These are ubiquitous language (the glossary's job is to pin a contested name), distinct from concrete impls / registry class names which stay catalogue-only on /blocks/ + /plugs/. Feeds the #1327 coverage gate's per-item fire-set.

## Progress (batch-2026-06-20-1372-1369)

Done. Reviewed all 80 blocks + 53 plugs against the test **"the industry uses competing names for this thing
AND WE made a deliberate disambiguating pick"** (the #1343 contested-name bar). **Plugs are out by
construction** — they are `Custom*`/registry class names and native-patch impls (catalogue-only, not
ubiquitous-language concepts). Flagged **9 blocks `isConcept: true`** (the genuinely contested names):
`droplist` (WE-coined family vs `dropdown`), `dropdown` (the concrete member of that pair), `drawer` (vs
sidebar/sheet/off-canvas), `segmented-control` (vs button-group/radio), `carousel` (vs slider/slideshow),
`status-indicator` (vs badge/chip/pill/tag), `type-ahead` (vs autocomplete), `dialog` (vs modal),
`toggle-switch` (toggle vs switch). Seven already had glossary terms; authored the **2 missing** —
`we:src/_data/semantics/dialog.json` + `we:toggle-switch.json`. Deliberately **left settled names unflagged**
(button, checkbox, breadcrumb, slider, tooltip, notification, tabs, …) so the `isConcept` set stays the
contested-name subset, not "every block."

Feeds the #1371 coverage gate's per-item fire-set (the gate now requires a term for each — all 9 satisfied,
**0** `isConcept`-without-term warnings). Gate 0 errors; 286 terms, no duplicate-term errors; the set is
extensible as new contested-name blocks land.
