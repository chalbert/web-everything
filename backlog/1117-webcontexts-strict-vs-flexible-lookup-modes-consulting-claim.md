---
type: idea
workItem: story
size: 3
parent: "1091"
status: resolved
blockedBy: ["1115"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webcontexts/Node.contexts.patch.ts"
tags: []
---

# webcontexts: strict vs flexible lookup modes consulting claim()

Add a claim-aware resolution path to we:plugs/webcontexts/Node.contexts.patch.ts:78-91,152-159: strict = first claim()-ing context; flexible = walk the injector chain when a provider declines (spec we:src/_includes/project-webcontexts.njk:78-79,95). Default flexible per the Most-Flexible-Default rule (#911) — note it in the body, do not re-decide. Demo: integration test, child declines so flexible resolves to parent, strict to child.

## Progress

Added a claim-aware resolution path to `we:plugs/webcontexts/Node.contexts.patch.ts`:
- New `Node.resolveContext(contextType, query?, mode?)` + `ContextLookupMode` export. **strict** = the
  closest matching context (claim ignored, delegates to `getContext`); **flexible** = walks the injector
  chain consulting `context.claim(query)` (#1115), skipping decliners and returning the first that claims —
  the spec's negotiation/protocol-driven fallback (njk:78-79,95). **Default `flexible`** per the
  Most-Flexible-Default rule (#911) — noted, not re-decided; the base `claim()` claims everything so
  un-overriding contexts resolve identically to strict.
- `queryContext` now resolves via `flexible` (a binding the closest context declines defers up-chain to a
  claiming provider). Patch-removal + type augmentation updated.
- `we:plugs/webcontexts/__tests__/integration/resolveContext.test.ts` — 5 green: child declines →
  flexible resolves to parent, strict to child; flexible resolves to child when it claims; default is
  flexible; queryContext subscribes the parent for a child-declined query (subscribe-spy).

Full webcontexts suite 73 green; WE `check:standards` 0 errors.
