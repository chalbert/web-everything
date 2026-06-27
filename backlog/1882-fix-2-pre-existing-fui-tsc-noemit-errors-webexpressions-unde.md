---
kind: task
status: open
dateOpened: "2026-06-27"
tags: []
---

# Fix 2 pre-existing FUI tsc --noEmit errors (webexpressions UndeterminedTextNode + webstates CustomStorageStrategyRegistry)

Surfaced gating batch-2026-06-27-1842-1720 unplugged work: fui:plugs/webexpressions/UndeterminedTextNode.ts has TS2416 ('parserName' not assignable to the same property in base CustomTextNode<CustomTextNodeOptions>), and fui:plugs/webstates/CustomStorageStrategyRegistry.ts has TS2345 (CustomStorageStrategyRegistryOptions not assignable to CustomRegistryOptions<CustomStorageStrategy<T>, string, CustomStorageStrategy<T>> — the 'unknown' vs 'T' variance). Both are pre-existing (independent of the unplugged seams added this session) and keep fui tsc --noEmit red, so a clean repo-wide typecheck gate can't pass. Fix the two type signatures (align the override property type / the registry-options generic). Distinct from the 34 #908 tag-parameterization check:standards errors. Locus: FUI.
