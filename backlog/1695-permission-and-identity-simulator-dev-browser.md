---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
humanGate: { kind: review, short: "Interactively verify the role/permission preview + contract-diff in the running dev-browser app.", what: "Acceptance is 'preview the LIVE app as any declared role/permission set and diff the rendered surface against the contract' — a live dev-browser surface whose verification is hands-on interaction in the running app (select a role → observe the re-rendered app → confirm the contract diff), not a headless unit check a serial batch can perform. The data blocker is clear: webidentity exists (#1060/#1061) and the webpermissions contract #1699 is now RESOLVED (the body's 'blocked by #1699' note is stale), so the declared roles/scopes are available — the residual is the interactive build-and-verify in a dev-browser session. Needs a focused session driving the running app." }
dateOpened: "2026-06-23"
tags: []
---

# Permission and identity simulator (dev browser)

Build story for the permission/identity simulator (#1645, ratified go). Preview the live app as any declared role/permission set, enumerated from the webpermissions/webidentity declared contracts, and diff the rendered surface against the contract. Blocked by the **webpermissions contract [#1699](/backlog/1699-webpermissions-contract-declared-role-permission-scope-model/)** — the declared roles/scopes to enumerate. webidentity contract exists (#1060/#1061) so the identity axis is ready, but the permission half is unbuilt (#178/#379 ruled it but graduated nothing); without #1699 this degrades to a generic view-as-user toggle. Home plateau:dev-browser.
