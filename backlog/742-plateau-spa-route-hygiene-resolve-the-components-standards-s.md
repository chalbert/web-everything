---
type: issue
workItem: story
size: 2
locus: plateau-app
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: plateau-app/index.html
tags: []
---

# Plateau SPA route hygiene — resolve the /components + /standards stubs and the hidden /settings nav

plateau-app advertises two dead 'coming soon' stub routes (/components, /standards) with no data and hides /settings from nav (auth-guard off); implement-or-remove the stubs (/standards content lives in WE) and decide settings nav. From the #724 audit.

## Resolved (2026-06-16)

**Removed** both dead stubs (`index.html` `<template route>` + sidebar nav link + the orphaned breadcrumb
labels in `src/main.ts`) rather than implement them — their content belongs to other constellation repos,
not plateau-app: standards live in WE and are already surfaced via the existing **/web-docs** product nav
(the `/standards` stub was redundant), and the component catalog is FUI's (impl + rendered display), so a
native plateau-app `/components` catalog would mis-home it. Removing routes that advertise content the
product doesn't own is the hygiene #724 flagged.

**Settings nav — decided KEEP (in nav, guarded).** Unlike the stubs, `/settings` is a real working surface
(org settings form) behind `route:guard="requireAuth"`. The #724 "hidden / auth-guard off" concern was
already addressed in the current code (the route is present in the sidebar *and* guarded), so the right
call is to leave it visible-and-guarded — a legitimate authenticated product surface, not a dead end.

Gate: `npm test` in plateau-app green (166 tests); verified on the live :4000 dev server (nav no longer
lists Components/Standards, `/settings` still present, no "coming soon" stubs served).
