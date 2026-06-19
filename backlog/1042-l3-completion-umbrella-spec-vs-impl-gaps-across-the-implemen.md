---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-19"
tags: []
---

# L3 completion umbrella: spec-vs-impl gaps across the implemented standards

Surfaced by the #991 audit (§10): 11 of 12 implemented standards have spec-vs-impl gaps triaged as GENUINE-untracked completion work. Captures: webregistries (global-patching API TODO stubs), webstates (change-tracking + storage protocols), webvalidation (no L1 observable surface), webcontexts (claim/query, SSR), webbehaviors (whenDefined, naming, hyphen validation), webexpressions (excludedElements, cloak, upgrade triggers), webtheme (scheme runtime/high-contrast/accent-CSS untested), and webdirectives (THIN ~70% unimplemented, CustomComment — build-vs-defer is a prioritization call). Intentional layering confirmed (NOT re-filed): webcomponents #854/#792, webguards #178/#273/#338, webworkflows #657. Slice per standard when picked; full per-standard detail in we:audits/standards-surfacing-audit.md §10.
