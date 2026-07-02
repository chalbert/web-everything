---
kind: epic
size: 13
status: open
dateOpened: "2026-07-02"
tags: []
---

# Framework-flavored delimiter bundles

Ship customNodes bundles that reproduce popular template languages' delimiter grammars (Handlebars, Vue, Svelte, Angular, Liquid/Jinja, Blade) as ready-made authoring styles over the #2074 recipe model — the delimiter-language analogue of the design-system reproduction program (#1226). Dual purpose: offer developers a familiar syntax to build in (not only FUI's native grammar), and stress-test customNodes against real, diverse grammars (the sigil and declared-close edge cases Fork 3 surfaced). One bundle per framework flavor as a slice, each scored on faithful reproduction. Builds on we:docs/agent/block-standard.md#custom-node-recipes.
