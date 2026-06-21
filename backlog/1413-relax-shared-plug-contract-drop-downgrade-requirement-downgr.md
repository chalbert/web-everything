---
kind: task
parent: "1250"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:plugs/core/Plug.ts"
tags: []
---

# Relax shared Plug contract: drop downgrade requirement (downgrade? optional) per #1350 — both repos

Apply the #1350 ruling (A): relax we:plugs/core/Plug.ts (downgrade? optional), drop the downgrade check in isPlug, relax we:plugs/core/HTMLRegistry.ts abstract downgrade to optional, and null-guard the three plug.downgrade(root) call sites in we:plugs/unplugged.ts (lines 63/160/188) to plug.downgrade?.(root). Lands in both WE and FUI (we:plugs/core/ + we:plugs/unplugged.ts are byte-identical). Turns the red we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts green. upgrade stays mandatory; real downgrade bodies (CustomAttributeRegistry/InjectorRoot/CustomTextNodeRegistry) are preserved — only the requirement relaxes.

## Progress

- we:plugs/core/Plug.ts: `downgrade?(root)` now optional; dropped the `typeof downgrade === 'function'`
  check from `isPlug` (upgrade stays required).
- we:plugs/core/HTMLRegistry.ts: relaxed `abstract downgrade` → optional `downgrade?(node)`.
- we:plugs/unplugged.ts: null-guarded the two real `plug.downgrade()` method call sites (unregister
  loop + downgrade-all loop) to `plug.downgrade?.(root)`, and updated the register() error message to
  list downgrade as optional. (The item's "188" is the module's own `downgrade(root)` FUNCTION call in
  `reset()`, not a `plug.downgrade` method invocation — left as-is; the two method sites are the guards.)
- Replicated all three byte-identical files into fui:plugs/core/ + fui:plugs/unplugged.ts (confirmed
  byte-identical to the WE pre-edit baseline first, copied the edited versions over).
- Green: we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts (4/4) and the full FUI
  plug suite (86 files / 1004 tests). Lands in both repos, committed to each.
