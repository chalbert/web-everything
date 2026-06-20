---
kind: story
size: 5
status: open
dateOpened: "2026-06-20"
relatedProject: webintents
tags: [reproduction, gap-sweep, shadcn, intent, candidate-standard]
---

# Mint the decorative tag intent (Tag Intent) per #1319 ruling

Ratified [#1319](/backlog/1319-decorative-label-tag-intent-distinct-from-lifecycle-status-i/)
([statute](docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source))
minted a distinct **decorative label/tag intent** (Fork 1 = A) named **`tag`**, distinct from lifecycle
**Status Indicator** and the count **Notification Marker**. Build it via `/new-standard`: author
we:src/_data/intents/tag.json with dimensions — `tone`
(`neutral|info|positive|caution|critical` + a categorical/brand tone, default `neutral`), `emphasis`
(`subtle|solid|outline`, default `subtle`), `shape` (`badge|pill|tag`, reusing Status Indicator's
vocabulary). **Decorative-only** — interactivity composes Action / Selection (Fork 2 = A), nothing baked
in. a11y: inert text, earns an accessible-name when it conveys meaning beyond color, not announced via
Live Region Status. Remaps shadcn's `badge` off `status-indicator`. Feeds gap-sweep #315.
