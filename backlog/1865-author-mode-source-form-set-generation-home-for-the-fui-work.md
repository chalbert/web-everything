---
kind: decision
parent: "746"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Author-mode-source form-set + generation-home for the FUI workbench

Two build-blocking sub-calls for #1618: (a) form-set — build the missing html/jsx source-text emitters + lossy/diagnostics signal, or scope the workbench panel to the 3 author-mode forms FUI faithfully emits (declarative, wc-class, functional); (b) generation-home — build-emit JSON the thin-descriptor registry carries vs a live /_maas/ author-source endpoint (today /_maas/ serves only consume-mode wrapper bytes, not author-mode source). Both small but real. Blocks #1618.
