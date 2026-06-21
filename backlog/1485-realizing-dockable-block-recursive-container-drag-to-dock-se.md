---
kind: story
size: 8
status: open
blockedBy: ["1437", "1484"]
dateOpened: "2026-06-21"
tags: []
---

# Realizing dockable block — recursive container + drag-to-dock + serialization + popout

Realizing build of #1437: the dockable block implementing the dockable intent — recursive row/column/stack container rendered via CSS Grid/Flex, drag-to-dock edge/center zone hit-testing that splits a leaf into a new row/column (the tree-topology mutation that is dockable's irreducible vocabulary), layout-tree serialization (row to column to stack-of-tabs), and the optional popout: none|window dimension. Composes #1384's Pointer-Events substrate + moveBefore relocation. Block contract in WE, impl in FUI.
