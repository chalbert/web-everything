---
kind: task
parent: "1250"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Relax shared Plug contract: drop downgrade requirement (downgrade? optional) per #1350 — both repos

Apply the #1350 ruling (A): relax we:plugs/core/Plug.ts (downgrade? optional), drop the downgrade check in isPlug, relax we:plugs/core/HTMLRegistry.ts abstract downgrade to optional, and null-guard the three plug.downgrade(root) call sites in we:plugs/unplugged.ts (lines 63/160/188) to plug.downgrade?.(root). Lands in both WE and FUI (we:plugs/core/ + we:plugs/unplugged.ts are byte-identical). Turns the red we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts green. upgrade stays mandatory; real downgrade bodies (CustomAttributeRegistry/InjectorRoot/CustomTextNodeRegistry) are preserved — only the requirement relaxes.
