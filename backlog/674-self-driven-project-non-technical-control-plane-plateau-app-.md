---
kind: story
size: 3
parent: "666"
status: resolved
locus: plateau-app
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: plateau-app/src/control-plane/dashboard.ts
relatedReport: reports/2026-06-16-backlog-split-analysis.md
tags: []
---

# Self-Driven Project control plane — gate dashboard + `/control-plane` shell (plateau-app SaaS surface)

Core slice of the non-technical control plane (sliced 2026-06-16 after artefact contract #672 landed; siblings #B/#C/#D below). Build the persona-scoped `/control-plane` route + shell in plateau-app and the **jargon-translated gate dashboard**: render each gate (`GateType` advisory/validating/blocking/escalating, `plateau:src/profiles/schema.ts:75`) in plain founder/PM/compliance language, scoped by persona (`plateau:src/profiles/profiles.ts:14` `getProfile`, `plateau:src/profiles/roster.ts`). Reads the existing enforcement layer — `GateEnforcer.evaluate()→DeployVerdict` and `GateRecord` (`plateau:src/profiles/gate-enforcement.ts:201`/`:32`) — no new enforcement logic.

New `plateau:src/control-plane/dashboard.ts` mounted on the proven `mountProfiles` pattern (`plateau:src/profiles/profiles-page.ts:158`, `we:index.html:135`, `plateau:src/main.ts:216`/`:351`). This shell is the landing surface the sibling panels (escalation inbox, audit view, trip planner) plug into. Constellation: plateau-app product layer (#091); standard+taxonomy stay in WE. Maps gate severities (#166) + autonomy levels (#672 L0–L4) onto persona-scoped views.

> Note: the body's "plain-language-gate requirement on the step-tree" is **absorbed here** (the dashboard IS the jargon translation); a dedicated step-tree-coupled slice is deferred until a plateau-app step-tree surface exists (#671 graduated to a webeverything `/research/` njk, not running code). See `we:reports/2026-06-16-backlog-split-analysis.md`.

## Progress (2026-06-16, batch-2026-06-16) — built

- **Route + shell:** `/control-plane` added to plateau-app — nav link + `<template route>` + `#control-plane-mount` in `we:index.html`, route-change case + `tryMountControlPlane` + the **INITIAL SETUP** direct-load/deep-link mount in `plateau:src/main.ts` (the mount path the sibling routes use; missing it was a real deep-link bug, caught by a browser probe).
- **Dashboard:** `plateau:src/control-plane/dashboard.ts` (`mountControlPlane`) + `plateau:control-plane.css`, on the proven `mountProfiles` pattern (persona tabs, full re-render, localStorage selection). Reads the **existing** enforcement layer — builds a `GateEnforcer` from each persona's review-area gates and renders its `DeployVerdict`; **no new enforcement logic** (#568 owns that).
- **Jargon translation:** each `GateType` (advisory/validating/blocking/escalating → "Heads-up / Automated check / Needs sign-off / …escalates") plus a plain deploy verdict ("Clear to ship" / "Not ready — N gate(s) need attention"), scoped per persona; an autonomy-ladder legend maps the #672 L0–L4 levels into plain language (modelled locally until the artefact-contract registry ships as data).
- **Verified:** plateau-app `npm test` **172/172** (incl. 6 new dashboard helper tests); Playwright on the live `:4000` server — `/control-plane` mounts on **both** direct-load and client-side nav (7 persona tabs, gate rows, verdict render, no console errors).
- Constellation: plateau-app product layer (#091); standard + taxonomy stay in WE. The landing surface the sibling control-plane panels (escalation inbox #780, audit view #781, tolerance envelope #782) plug into.
