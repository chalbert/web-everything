---
kind: story
size: 3
parent: "1304"
locus: frontierui
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui:plugs/webregistries declarativeRegistry core (parse/compose/scoped-define/resolve/map-through) FUI-up

D1 of #1304: port we:declarativeRegistry.ts onto FUI's reconciled CustomElementRegistry (#1354) — parseRegistryScript, applyDeclarativeRegistries (IDREF extends + scoped-define + lazy queue), resolveScopedRegistry, applyScopedRegistryToHost/getScopedRegistryOf, activeResult state — plus the non-attribute test blocks. Imports only ./CustomElementRegistry; no binding behavior, no patching. Leaves FUI green (patching stays warn-stub, attribute not yet ported).

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

- Ported `we:plugs/webregistries/declarativeRegistry.ts` → `fui:plugs/webregistries/declarativeRegistry.ts`
  verbatim (the module imports only `./CustomElementRegistry`, so it ports unchanged onto the reconciled
  FUI registry #1354). All of parse/compose/scoped-define/lazy-queue/resolve/map-through + `activeResult`
  state.
- Ported the **non-attribute** test blocks → `fui:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts`
  (parseRegistryScript, applyDeclarativeRegistries, resolveScopedRegistry, applyScopedRegistryToHost/
  getScopedRegistryOf). Dropped the `ScopedRegistryAttribute` import + its describe block (binding behavior
  not ported this slice). **18 tests pass.**
- Wired the declarativeRegistry exports into `fui:plugs/webregistries/index.ts` (NOT `ScopedRegistryAttribute`,
  NOT the patching path — `applyPatches`/`isPatched` stay the existing warn-stub).
