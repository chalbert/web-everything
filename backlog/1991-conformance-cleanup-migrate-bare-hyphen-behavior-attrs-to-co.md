---
kind: task
status: open
blockedBy: ["1987"]
dateOpened: "2026-06-30"
tags: []
---

# Conformance cleanup: migrate bare-hyphen behavior attrs to colon namespace + normalize route:guard:leave

Triggered by #1987's Fork 1 ruling (colon is the collision-safe namespace; bare-hyphen behavior attrs are the actually-unsafe names). In Frontier UI, migrate the ~8 bare-hyphen behavior attribute names (type-ahead, droplist-anchor/anchored/selection, focus-delegation, navigation-guard) into the colon namespace (e.g. droplist:anchor), and normalize the double-colon outlier route:guard:leave (no precedent on any convention) to single-colon route:guard-leave. Mechanical rename + registration update; keep back-compat aliases if any author surface depends on the old names.
