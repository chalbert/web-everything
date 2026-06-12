---
type: idea
workItem: task
status: open
blockedBy: ["398"]
dateOpened: "2026-06-11"
tags: [development-guide, learn-pathway, webdocs, migration, docs]
---

# Migrate the development-guide surface onto webdocs

Migrate the development-guide / learn-pathway surface off its interim configurator-native render (#335) and onto `webdocs`, so the guide is generated from the single `CapabilityProvider` source rather than hand-kept — matching the essay's "updated often" cadence. Ratified in #109 (Fork 3): render via `webdocs` from the single source is the ratified end-state; the configurator-native browse page is only the interim fallback until `webdocs` matures. Blocked on #398 (the Web Docs product build) shipping — #091 ruled the layering (standard→WE, primitives/adapters→FUI, served product→plateau-app, open-core by usage); this migration targets the `plateau-app` served surface.
