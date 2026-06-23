---
kind: story
size: 8
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Live-element to declaration/source/owner resolver (dev browser)

The shared resolution layer the resolver-trio rides: given a clicked/selected live element in a running WE app, resolve it through the declared model (which intent/component/provider/rule produced it) to its declaration, source file:line, and owner. Built once, consumed by jump-to-source (#1652), semantic search hit-resolution (#1651), and the explain-this-element inspector (#1634). Stack-agnostic via the declared model, not a framework fiber tree. Home plateau:dev-browser.
