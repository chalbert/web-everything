---
kind: story
size: 8
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/blocks/undo-history.json"
tags: []
---

# Build undo-history block (Web States): navigable mutation history composing the Change Tracking Protocol

Realizing build for the #1394 placement ruling. Mint an undo-history block (type: Module) homed in Web States #011, mirroring draft-persistence: a past/present/future cursor over Change Patches, undo via CustomChangeStrategy.applyInverse + redo via forward re-apply, stack bounds, a transact() grouping/coalescing API, scope read from CustomChangeStrategyRegistry, and a bridge from the native historyUndo/historyRedo InputEvent for editable surfaces. Shares the reversible-op primitive with optimistic mutation #1395 but a separate runtime (rollbacks must not hit the undo stack). The undo/redo UI control is a SEPARATE downstream block composing command + status-indicator + feedback — out of scope here.

## Progress

- Minted the WE block contract we:src/_data/blocks/undo-history.json (`type: Module`, `status: draft` —
  spec authored, FUI impl pending, like the other unbuilt draft blocks: no `implementedBy`/exports yet).
  Auto-renders at /blocks/undo-history/ via we:src/block-pages.njk; homes to webstates via summary prose
  (the #011 navigable-time facet, sibling to draft-persistence's storage facet).
- Captured all four #1394 forks as `designDecisions`: composes-the-protocol-not-extends (reuse Change
  Patch + applyInverse, no new inverse contract), transact() groups undo-steps (Fork 3 UX-granularity),
  scope from CustomChangeStrategyRegistry (fixed mechanic), separate-runtime-from-optimistic-rollback
  (Fork 4 — rollbacks never enter the undo stack), bounded stacks, and UI-control-is-separate (out of
  scope). Events: `history-changed` (canUndo/canRedo/depths) + `history-reverted` (composes the
  protocol's change-reverted). webStandards: native historyUndo/historyRedo InputEvent bridge +
  structuredClone snapshotting.
- This is the WE standard artifact (contract). The FUI runtime impl
  (@frontierui/blocks/undo-history/...) + a demo are downstream FUI work (not filed here — surfaces when
  FUI builds the mapped block, per the dogfood/impl cadence). Cleared the stale `blockedBy: ["1394"]`.
