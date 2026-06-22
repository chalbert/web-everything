---
kind: story
size: 5
parent: "1483"
status: open
locus: frontierui
dateOpened: "2026-06-22"
tags: []
---

# Rework webregistries root-scope upgrade: construction-delegation / native-delegate (replaces #1544 prototype-swap)

The #1544/#1560 root-scope upgrade swaps el prototype + copies own-keys, which CANNOT install #private fields (only the real constructor does). Proven 2026-06-22: re-enabling the root swap (#1545) white-pages plateau — route-view upgrades to RouteViewElement then throws 'Cannot write private member #routes'. Replace the prototype-swap mechanism so the browser's native machinery runs the real constructor on the existing node (installing #private fields). Two correct mechanisms: (1) root scope has exactly one class per tag, so define() delegates to the NATIVE registry (define the real class) and native upgrade-on-define handles already-parsed elements correctly — simplest, bulletproof for the root case; (2) general construction-delegation — the native stand-in's constructor does Reflect.construct(RealClass, args, standIn) so native construct/upgrade routes to the real constructor in ANY scope (the @webcomponents/scoped-custom-element-registry technique; #228 ensureNativelyConstructible already does Reflect.construct under a private tag). locus frontierui; FUI-only (no we:plugs byte-replica, #1047). Must keep #1544's passing scoped/non-private upgrade tests green. Blocks the re-enable (#1545).
