---
kind: story
size: 13
status: open
blockedBy: ["1437", "1484"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# Realizing dockable block — recursive container + drag-to-dock + serialization + popout

Realizing build of #1437: the dockable block implementing the dockable intent — recursive row/column/stack container rendered via CSS Grid/Flex, drag-to-dock edge/center zone hit-testing that splits a leaf into a new row/column (the tree-topology mutation that is dockable's irreducible vocabulary), layout-tree serialization (row to column to stack-of-tabs), and the optional popout: none|window dimension. Composes #1384's Pointer-Events substrate + moveBefore relocation. Block contract in WE, impl in FUI.

## Pre-flight (batch-2026-06-21-1501-1356) — re-sized 8 → 13, needs /split (not batchable as one)

Claimed + grounded. Deps (#1437, #1484) are resolved and the dockable **intent** JSON
(`we:src/_data/intents/dockable.json`) landed, but there is **no dockable block contract in WE**
(`we:contracts/dockable.ts` does not exist) and **no FUI impl** — this is a net-new contract + net-new impl
of an entire golden-layout/dockview-class docking paradigm. The intent JSON itself scopes it as: recursive
row/column/stack rendering, recursive `resizable` splits, tab-`stack` leaves, drag-to-dock topology
mutation, a **separate first-class layout-tree Protocol** that materializes *with* this build (#1486 is
`blockedBy` this), AND cross-document **popout-window** relocation (which breaks `moveBefore` + the
single-document roving-tabindex wiring). Its core — drag-to-dock edge/center hit-testing — is **inherently
live-interactive** to verify (no meaningful unit proof of a pointer-driven re-tile). That is materially
larger than an 8-pt slice and is **not batchable as one** → re-sized to 13 and dropped from the batch pool.

**Carve (for /split, a foundational-first order, [[contract-ts-is-a-separate-slice]]):**
1. WE dockable block contract `we:contracts/dockable.ts` + `@webeverything/contracts/dockable` re-export
   (the foundational slice the FUI impl imports; bounded, gate-verifiable, no live dep).
2. FUI recursive **container render** (row/column/stack via CSS Grid/Flex + recursive `resizable` splits).
3. FUI **drag-to-dock** edge/center hit-testing + topology mutation (live-interactive; composes #1384
   Pointer-Events + `moveBefore` + the #1495 gesture `pan`).
4. **Layout-tree serialization** + the #1486 interchange Protocol.
5. **popout: window** cross-document relocation (the deferred, highest-risk dimension).

Carry-forward reason: **outgrew / not-batchable** — re-sized 13, released to `open`. #1486 stays blocked behind it.
