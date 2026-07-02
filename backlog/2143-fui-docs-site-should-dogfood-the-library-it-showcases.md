---
kind: story
size: 3
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
relatedProject: webcomponents
tags: [docs-site, dogfood, reference-implementation, webtheme]
---

# FUI docs-site should dogfood the library it showcases

The FUI Eleventy docs-site renders zero FUI components — fui:src/_layouts/base.njk loads no script at all, and its chrome is a standalone 479-line stylesheet disjoint from fui:webtheme/. A reference-implementation library's own docs are the cheapest dogfood surface: render the catalog pages with FUI blocks (e.g. card, navigation, code-view, props-table) themed by webtheme, so the site exercises the library it documents. Surfaced by the #2053 discussion (ruling: co-locate, conditioned on clean separation) — dogfooding strengthens co-location while keeping the site surface under fui:src/.
