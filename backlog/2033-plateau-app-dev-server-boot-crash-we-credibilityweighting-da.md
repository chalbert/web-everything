---
kind: task
status: open
dateOpened: "2026-07-01"
tags: []
---

# plateau-app dev-server boot crash: WE credibilityWeighting _data module has no ESM default (dev surface #1984 missed)

In dev (Vite :4000) plateau-app crashes on boot — the CommonJS module we:src/_data/credibilityWeighting.js provides no synthetic default for the default-import #1984 introduced, so every page fails to mount (console: does not provide an export named default). #1984 verified only the prod Rollup build, not the dev-server runtime. Fix: give the module a real ESM surface, or use the interop import path plateau-app uses elsewhere for WE _data. Blocks any browser verification of plateau-app pages.
