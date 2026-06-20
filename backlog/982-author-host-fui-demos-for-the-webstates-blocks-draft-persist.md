---
kind: story
size: 5
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/webstates-blocks-demo.html"
tags: []
---

# Author + host FUI demos for the webstates blocks (draft-persistence, simple-store, audit-trail, lifecycle)

Author runtime demos for draft-persistence, simple-store, audit-trail and lifecycle in fui:demos/ and wire demoFile. Largest cluster (4 demos). Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/webstates-blocks-demo.html` (reuses `fui:demos/playground.css`), four live sections —
the last two **compose**:
- **simple-store** — `new SimpleStore({ count })`; `subscribe` re-renders, `getItem`/`setItem` mutate (+/−).
- **draft-persistence** — `new DraftPersistence('demo-draft')`; `update()` autosaves to localStorage, a
  "Reload from storage" button does `save()` → clear → `load()` and restores the exact text.
- **lifecycle** — `new DefaultLifecycleProvider({ initial, states, transitions })`; renders the current
  state + `available(entity, actor)` transitions as buttons (`draft → review → published`).
- **audit-trail** — `new DefaultAuditProvider()`; each lifecycle `transition()` also `append()`s an
  immutable `AuditEvent`, rendered from `queryByEntity('doc-42')` — the #357 lifecycle↔audit composition.

Wired `demoFile` → `fui:demos/webstates-blocks-demo.html` on all four blocks + cleared them from
`DEMO_PENDING` (`fui:scripts/check-standards.mjs`, #973; only the #990-blocked wizard + workflow-engine
remain). **Playwright-verified on :3001**: store reaches 2, draft restores "my draft text", lifecycle goes
Draft → In review, the audit log gains 1 entry per transition, 0 console errors. FUI check:standards green.
