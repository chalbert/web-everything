---
kind: epic
size: 13
parent: "1963"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Phase 2 — nested-directive lifecycle composition (declarative-HTML deep structural)

Case 10 declarative-HTML deep STRUCTURAL nesting is UNMET: the structural mechanism is comment-anchor directives (CustomComment), not transient (no native-element target there). Foundation is built (#1130; the ForEach, ViewIf and ViewSwitch directives are one-time render plus manual refresh, #1217), but about 80% remains and was deferred as Phase 2 (uncarved in #1217 and #042). Build: parent-to-child nesting and ownership ordering; reactive cascade; keyed reconciliation; moveBefore state-preserving moves; SSR and hydration of comment regions; nesting tests. Align to DOM Parts ChildNodePart for the migration path. Ratified under #1963.
