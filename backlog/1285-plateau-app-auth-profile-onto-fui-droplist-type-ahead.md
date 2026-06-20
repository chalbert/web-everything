---
kind: story
size: 2
parent: "1254"
status: open
blockedBy: ["1284"]
dateOpened: "2026-06-20"
tags: []
---

# plateau-app auth/profile onto FUI droplist/type-ahead

Migrate plateau-app's hand-rolled auth/profile control (we:plateau:src/main.ts) onto FUI's droplist (fui:blocks/droplist) and type-ahead (fui:blocks/type-ahead) behaviors. Both FUI blocks ship today; this slice rides the FUI-block integration seam proven by the nav/sidebar pilot (#1284), hence blockedBy it. Demoable: the profile/auth menu opens and selects via FUI behaviors at :4000.
