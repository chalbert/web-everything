---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/intents/tag.json"
relatedProject: webintents
tags: [reproduction, gap-sweep, shadcn, intent, candidate-standard]
---

# Mint the decorative tag intent (Tag Intent) per #1319 ruling

## Progress (batch-2026-06-20) — DONE

Authored `we:src/_data/intents/tag.json` per the #1319 ruling (decompose-overloaded-vocabulary-by-semantic-source):
- **Dimensions** — `tone` (`neutral|info|positive|caution|critical` + an open `categorical` for brand/topic
  tags, default `neutral`), `emphasis` (`subtle|solid|outline`, default `subtle`), `shape`
  (`badge|pill|tag`, reusing Status Indicator's vocabulary). All optional, most-permissive defaults.
- **Decorative-only (Fork 2 = A)** — no interactivity baked in; a removable/clickable tag composes
  Action / Selection on the host, Tag stays the inert label.
- **a11y** — inert text; earns an accessible name when it conveys meaning beyond colour; **not** announced
  via Live Region Status. Distinct from lifecycle Status Indicator + count Notification Marker.
- Remaps shadcn's `badge` off `status-indicator`; feeds gap-sweep #315. Auto-renders at `/intents/tag/`.
  Regenerated `we:AGENTS.md` inventory (intents 66 → 67). Gate green.
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
