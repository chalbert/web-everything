---
kind: story
size: 8
status: open
blockedBy: ["1394"]
dateOpened: "2026-06-21"
tags: []
---

# Build undo-history block (Web States): navigable mutation history composing the Change Tracking Protocol

Realizing build for the #1394 placement ruling. Mint an undo-history block (type: Module) homed in Web States #011, mirroring draft-persistence: a past/present/future cursor over Change Patches, undo via CustomChangeStrategy.applyInverse + redo via forward re-apply, stack bounds, a transact() grouping/coalescing API, scope read from CustomChangeStrategyRegistry, and a bridge from the native historyUndo/historyRedo InputEvent for editable surfaces. Shares the reversible-op primitive with optimistic mutation #1395 but a separate runtime (rollbacks must not hit the undo stack). The undo/redo UI control is a SEPARATE downstream block composing command + status-indicator + feedback — out of scope here.
