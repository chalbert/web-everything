---
kind: story
size: 5
parent: "1684"
status: open
dateOpened: "2026-06-23"
tags: []
---

# webrouting serializable route-map projection schema + conformance vectors

Define the serializable route-map projection schema ratified in #1685: a JSON shape DERIVED from RouteDefinition (path, guard, guardLeave, loader, outlet, isErrorBoundary) that drops the non-serializable pattern + template. Ship it as an internal WE schema plus conformance vectors — statically-authored routes only, route templates not concrete URLs. The derived-map BUILDER is not this slice; it folds into the first consuming slice (#1688 sitemap). Authorable now (decision resolved, no blocker). Graduated from the #1685 ratification (DOM is the authoring SoT, this is its derived projection).
