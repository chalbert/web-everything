---
kind: story
size: 2
parent: "2021"
status: open
blockedBy: ["2098", "2099"]
dateOpened: "2026-07-02"
tags: []
---

# Dogfood thin detail generators onto we-card (adapter/plug/resource/state/rules/project sweep)

Convert the six thin detail generators — we:src/adapter-pages.njk, we:src/plug-pages.njk, we:src/resource-pages.njk, we:src/state-pages.njk, we:src/rules-pages.njk, we:src/project-pages.njk (0-1 section-card panels each; mostly plug-detail-header + status chrome) — onto the #2098 we-card primitive and the #2099 shared status badge. Mechanical after the foundations; one Playwright before/after sweep across the six families. JS-off correct.
