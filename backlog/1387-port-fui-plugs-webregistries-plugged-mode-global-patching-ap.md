---
kind: task
parent: "1304"
locus: frontierui
status: resolved
blockedBy: ["1385"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "frontierui:plugs/webregistries/index.ts"
tags: [plugs, webregistries, reconciliation, frontierui, contract-anchored]
---

# Port fui:plugs/webregistries plugged-mode global patching (applyPatches/removePatches/isPatched/attachShadow)

P of #1304 (blocked-by D1 #1385): replace the TODO console.warn stubs in fui:plugs/webregistries/index.ts with WE's written plugged-mode patching — save/swap CustomElementRegistry + customElements, attachShadow scoped-init via applyScopedRegistryToHost (imported from declarativeRegistry), removePatches restore, isPatched. Pure copy of shipped WE code + port we:globalPatching.test.ts. Independent of D2.

## Progress (2026-06-21, batch-2026-06-21-1385-1392, seam top-up)

- Replaced the three TODO/console.warn stubs in `fui:plugs/webregistries/index.ts` with WE's shipped
  plugged-mode impl (verbatim): `_patched`/`_original*` save-restore state, the `redefine` getter-safe
  reassign helper, the `ScopedShadowInit` type, and `applyPatches` (save → swap `window.CustomElementRegistry`
  + `window.customElements` to the scoped class + patch `attachShadow` to associate a scoped registry via
  `applyScopedRegistryToHost`) / `removePatches` (restore) / `isPatched`. Added the two value imports
  (`CustomElementRegistryImpl`, `applyScopedRegistryToHost`) — the latter satisfied by the #1385 declarativeRegistry port.
- Ported `we:globalPatching.test.ts` → `fui:plugs/webregistries/__tests__/unit/globalPatching.test.ts`
  verbatim (identical relative paths + matching FUI exports). **Full webregistries suite 49 passing; FUI gate green.**
- Independent of D2 (#1386, the ScopedRegistryAttribute binding) — patching is the unplugged→plugged seam, not the attribute behavior.
