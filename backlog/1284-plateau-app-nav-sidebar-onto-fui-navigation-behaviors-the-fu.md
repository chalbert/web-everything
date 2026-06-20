---
kind: story
size: 3
parent: "1254"
status: open
dateOpened: "2026-06-20"
tags: []
---

# plateau-app nav/sidebar onto FUI navigation behaviors — the FUI-block integration-seam pilot

Migrate plateau-app's hand-rolled nav/sidebar (we:plateau:index.html marked 'workaround: no NavMenu'; we:plateau:src/main.ts:521 upgrades route:link today) onto FUI's navigation block behaviors (fui:blocks/navigation/registerNavigation.ts — nav:list / nav:section / nav:menubar). This is the integration-seam PILOT: plateau already bootstraps @frontierui/plugs/bootstrap but wires zero FUI block behaviors; this proves the plugs-registry -> FUI-behavior seam end-to-end so every later surface rides a proven pattern. Demoable: sidebar renders + navigates via FUI behaviors at :4000.
