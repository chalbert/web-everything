---
kind: story
size: 3
parent: "2021"
status: open
blockedBy: ["2098", "2099"]
dateOpened: "2026-07-02"
tags: []
---

# Dogfood rich detail generators onto we-card (capability/capability-adapter/demo/research-topic sweep)

Convert the ~17 section-card fui-card panels + detail headers across we:src/capability-pages.njk (4 panels), we:src/capability-adapter-pages.njk (3), we:src/demo-pages.njk (5, incl. the gradient hero panel), we:src/research-topic-pages.njk (5) to SSR we-card via the #2098 primitive, headers riding the #2099 shared status-badge macro. Presentational tables stay plain per #1964. JS-off correct; Playwright before/after per family.
