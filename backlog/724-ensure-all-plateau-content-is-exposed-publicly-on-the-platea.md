---
type: issue
workItem: story
size: 5
status: resolved
locus: plateau-app
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [plateau-app, public-surface, audit]
---

# Ensure ALL Plateau content is exposed publicly on the Plateau website

Audit the Plateau (plateau-app) public website against everything Plateau actually contains — products, services, the Technical Configurator, governance personas/charters, every served capability — and close the gaps so nothing built is invisible to the public. Plateau owns the rendered display of its own product surface. Deliver an inventory-vs-published diff and the pages/nav to expose anything missing. Sibling to the FUI public-exposure card; both surfaced during #713 as a general 'all content must be publicly exposed in its own website' principle across the constellation.

## Audit delivered — Plateau's built surface is already fully exposed (2026-06-15, batch-2026-06-15)

Claimed in a batch; ran the inventory-vs-published audit. Unlike its FUI sibling (#723, which found five
unbuilt exposure surfaces and became an epic), **plateau-app's built content is already publicly reachable**
— so #724's premise ("nothing built is invisible") is essentially **met**. The deliverable here is the
audit + a small hygiene carve, not a build.

**Plateau site:** a Vite custom-element SPA. Routing + nav are **hand-wired** (not data-driven): routes are
inline `<template route="...">` in `plateau-app/index.html`, nav is a hardcoded sidebar there, mounts are
imperative `path ===` checks in `plateau-app/src/main.ts`. Adding a surface = 4 edits (route template, nav
link, mount fn, breadcrumb).

**Inventory-vs-published diff (built content):**

| Surface | In repo | Published | Status |
|---|---|---|---|
| Technical Configurator domains | 9 (`src/technical-configurator/provider.ts` → `listDomains()`) | all 9 selectable in `/technical-configurator` | **PUBLISHED** |
| Governance personas/charters | 7 (`src/profiles/roster.ts`) | all 7 on `/profiles` | **PUBLISHED** |
| Applications / Libraries | 5 / 6 (mocks) | `/apps`(+`/apps/:id`) / `/libraries` | **PUBLISHED** |
| Platform-manager surfaces | 4 (impact-analysis, contract-drift, platform-map, governance) | 4 routes, all in nav | **PUBLISHED** |
| Compatibility map, Learn, Intent-configurator, Component-assembler, Web-docs | each built | each routed + navved | **PUBLISHED** |
| dev-browser tooling | 27 files | not routed | **correctly internal** (not Plateau-facing) |

**Result: 17 of 19 routes published; no built-but-invisible content found.** The configurator's 9 domains
and the 7 personas render in-page (no per-item routes), which satisfies exposure — #724 never mandated
per-item routes.

**The only findings are the *inverse* of #724's concern (advertised-but-unbuilt) + one nav omission**, a
separate hygiene matter carved to its own item:
- `/components` and `/standards` are **stub routes** ("coming soon") with no data behind them — they
  advertise *unbuilt* features (and `/standards` content properly lives in WE, not Plateau, per the
  constellation). Implement-or-remove, don't leave dead nav links.
- `/settings` is routable but **absent from the sidebar nav** (auth-guard currently disabled) — decide
  expose vs keep-hidden-pending-auth.

These are not "built content hidden from the public" (#724's premise), so they don't gate this item;
captured as a hygiene child (plateau-app locus). #724 resolved: the audit confirms full exposure of built
content.
