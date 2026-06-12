---
type: idea
workItem: story
size: 3
parent: "081"
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/module-service/productionDelivery.ts
tags: []
---

# Module-as-a-Service — production runtime delivery (compiled .js + published bare-specifier package)

Spun out of #081. In dev the import map points at Vite-served WE source (/blocks/renderers/jsx/index.ts); a real deploy must serve compiled .js plus a published bare-specifier package. The production hardening of the native-ESM delivery seam. Relates to the module-resolution axis (#271/#274) and importmap cleanup (#285). Independent of the other #081 follow-ons.
