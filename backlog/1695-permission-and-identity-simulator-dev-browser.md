---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
blockedBy: ["1699"]
dateOpened: "2026-06-23"
tags: []
---

# Permission and identity simulator (dev browser)

Build story for the permission/identity simulator (#1645, ratified go). Preview the live app as any declared role/permission set, enumerated from the webpermissions/webidentity declared contracts, and diff the rendered surface against the contract. Blocked by the **webpermissions contract [#1699](/backlog/1699-webpermissions-contract-declared-role-permission-scope-model/)** — the declared roles/scopes to enumerate. webidentity contract exists (#1060/#1061) so the identity axis is ready, but the permission half is unbuilt (#178/#379 ruled it but graduated nothing); without #1699 this degrades to a generic view-as-user toggle. Home plateau:dev-browser.
