---
kind: story
size: 5
status: open
locus: webeverything
relatedTo: ["178", "379", "009", "1645"]
dateOpened: "2026-06-23"
tags: []
---

# webpermissions contract — declared role / permission-scope model types in @webeverything

The declared authorization model the permission/identity simulator (#1645/#1695) enumerates and the access-control gate consults: roles, permission scopes, and the affordances each scope is declared to gate, as introspectable type-only contract entries in @webeverything/contracts. Ruled by #178 (declarative authorization / feature-flag gate) and #379 (identity, roles and field/action/state permission model) — both resolved as DECISIONS with graduatedTo none, so the contract was specified but never built; #009 folded the Permissions domain into webnotifications, which shipped only push-delivery (#1064), leaving the permission half unbuilt. Mirrors the webidentity contract shape (#1060); webidentity supplies identity shapes, this supplies the role/scope half. Type-only WE contract slice; the runtime authorization gate and the dev-browser RACI lens (#1636) consume it, they do not own it.
