---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Permission and identity simulator (dev browser)

Build story for the permission/identity simulator (#1645, ratified go). Preview the live app as any declared role/permission set, enumerated from the webpermissions/webidentity declared contracts, and diff the rendered surface against the contract. Gated: needs the webpermissions contract to ship (declared roles/scopes to enumerate) — webidentity contract exists (#1060/#1061) but no webpermissions contract card yet; without it this degrades to a generic view-as-user toggle. Home plateau:dev-browser.
