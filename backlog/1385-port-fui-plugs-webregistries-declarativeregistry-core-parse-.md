---
kind: story
size: 3
parent: "1304"
locus: frontierui
status: open
dateOpened: "2026-06-21"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui:plugs/webregistries declarativeRegistry core (parse/compose/scoped-define/resolve/map-through) FUI-up

D1 of #1304: port we:declarativeRegistry.ts onto FUI's reconciled CustomElementRegistry (#1354) — parseRegistryScript, applyDeclarativeRegistries (IDREF extends + scoped-define + lazy queue), resolveScopedRegistry, applyScopedRegistryToHost/getScopedRegistryOf, activeResult state — plus the non-attribute test blocks. Imports only ./CustomElementRegistry; no binding behavior, no patching. Leaves FUI green (patching stays warn-stub, attribute not yet ported).
