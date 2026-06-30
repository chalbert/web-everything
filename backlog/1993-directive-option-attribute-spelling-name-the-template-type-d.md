---
kind: decision
status: open
dateOpened: "2026-06-30"
tags: []
---

# Directive option-attribute spelling — name the <template type=> directive expression/option attributes (if-condition, switch-selector; reconcile for-each items/as/key)

The #1986/#1987 directive form moved directives onto <template type="if|switch|for-each">, but the EXPRESSION each directive used to carry as its colon-attribute value (view:if="@state.loggedIn", for-each="@items as user") now has no specified home. #1987 settled the type= VALUE spelling (bare core / owner-kind hyphen / no colon) but did NOT enumerate the per-directive OPTION attributes: the if-condition, the switch-selector. for-each is closest to settled (the #1987 audit lists bare items/as/key sub-attrs); if/switch are not. This decides those authored attribute names (native-shaped bare structural sub-attrs per the #1987 per-surface discipline) so the chunk-4 migration (#1991) can proceed without inventing standard API in FUI impl. Blocks #1991.
