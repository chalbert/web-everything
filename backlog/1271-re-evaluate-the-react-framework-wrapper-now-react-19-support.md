---
kind: story
size: 3
parent: "1258"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Re-evaluate the React framework wrapper now React 19 supports custom elements natively

React 19 passes Custom Elements Everywhere (property/attribute heuristic plus custom event support), so the resolved React wrapper (#977) may now be largely unnecessary — native-first (#031) extended to frameworks. Re-evaluate the wrapper: demote it to thin or optional where React 19 native consumption suffices, keeping it only for genuine gaps. Surfaced by the 2026-06-20 framework-churn watch (#1258).
