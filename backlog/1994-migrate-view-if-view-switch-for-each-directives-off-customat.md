---
kind: story
size: 3
status: open
blockedBy: ["1993"]
dateOpened: "2026-06-30"
tags: []
---

# Migrate view:if/view:switch/for-each directives off CustomAttribute onto CustomTemplateTypeRegistry

Chunk 4 of the Custom Type Registry family (#1990, chunks 1-3 delivered). Migrate the three structural directives (fui:blocks/view/ViewIfDirective.ts, fui:blocks/view/ViewSwitchDirective.ts, fui:blocks/for-each/ForEachBehavior.ts) off CustomAttribute onto the minted CustomTemplateTypeRegistry: the directive now IS the typed template (extends CustomTemplateType), authored as a typed <template>, registered by type VALUE not attribute name. Drop the registry-define calls for the directives in fui:blocks/view/registerViewDirectives.ts (view:show stays a behavior). NOTE the re-prototype constraint proven in chunk 2: upgrade() re-prototypes the existing node and runs NO constructor, so the directives must NOT use private instance fields with initializers (those throw on access for a re-prototyped node) — move marker/state init into connectedCallback. Blocked on #1993 (the option-attribute spelling — where the if-condition / switch-selector expression lives now that type= carries the identity).
