---
kind: story
size: 3
parent: "1994"
status: active
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
tags: []
---

# Wire customTemplateTypes activation in parity with attributes

Slice B of #1994. #2010 is now **resolved** — implement its ratified wiring: (1) plugged — instantiate `customTemplateTypes`, register `if`/`switch`/`for-each` via `registerViewTemplateTypes`, `documentInjector.set('customTemplateTypes', …)`, and eager `upgrade(document.body)` at the **4** existing `attributes.upgrade` sites; (2) unplugged — one-line `register(customTemplateTypes)` alongside `register(attributes)`; (3) generalize `resolveRegistry` in `fui:plugs/webexpressions/ExplicitHTMLInsertion.patch.ts` into a `CASCADE_REGISTRIES` set covering the **3** detached-fragment cascade branches (Fork 1 (a)). No live behavior change yet — the registry has nothing live to upgrade until for-each migrates (slice C, #2013). Size 3: the ratified surface is 4 eager + 3 cascade sites (7), not the original false "~15".
