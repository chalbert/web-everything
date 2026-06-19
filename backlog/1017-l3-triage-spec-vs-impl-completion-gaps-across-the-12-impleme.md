---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: backlog/1042-l3-completion-umbrella-spec-vs-impl-gaps-across-the-implemen.md
tags: []
---

# L3 triage: spec-vs-impl completion gaps across the 12 implemented standards

L3 conformance check (audit section 10): 11 of 12 implemented standards have spec-vs-impl gaps. Triage each as GENUINE-untracked completion work vs INTENTIONAL layering. Genuine → file completion items: webregistries (global patching API is TODO stubs), webstates (change-tracking + storage protocols absent), webvalidation (registry plane only — no L1 observable surface), webcontexts (no claim/query, SSR), webbehaviors (whenDefined, naming, hyphen validation), webexpressions (excludedElements, cloak, upgrade triggers), webtheme (scheme runtime/high-contrast/accent-CSS untested). Intentional, confirm don't re-file: webcomponents (#854/#792), webguards (#178/#273/#338), webworkflows (#657). webdirectives is THIN (~70% unimplemented, CustomComment) — decide deferred vs build. Full per-standard detail in audit §10.

## Progress (batch-2026-06-18)

Triaged each of the 12 implemented standards (audit §10). The 8 GENUINE-untracked completion gaps
(webregistries, webstates, webvalidation, webcontexts, webbehaviors, webexpressions, webtheme, webdirectives)
now have an owning umbrella — scaffolded **#1042** (epic, tagged `conformance`) with the per-standard scope.
The 3 INTENTIONAL-layering cases are confirmed and **not** re-filed (webcomponents #854/#792, webguards
#178/#273/#338, webworkflows #657). webdirectives' build-vs-defer is captured in #1042 as a prioritization
call, not decided here. Slicing #1042 per standard is its own later turn.
