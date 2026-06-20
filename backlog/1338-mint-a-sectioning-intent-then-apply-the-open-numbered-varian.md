---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/intents/sectioning.json"
tags: []
---

# Mint a sectioning intent, then apply the open-numbered variant axis (the #1323 sectioning half)

The **sectioning half of #1323**, carved out because it has no target intent yet. #1323 applied the
open-numbered `variant` axis (`we:docs/agent/platform-decisions.md#open-numbered-variants`, generalized
from Action #1318 per #1322) to `we:src/_data/intents/layout.json` — but the statute also generalizes to
**sectioning** (document `section`/`article`/`aside`-style content regions), and **no sectioning intent
exists** (`we:src/_data/intents/layout.json` is app-shell regions; `we:src/_data/intents/hierarchy.json`
is tree-nesting). So this needs a
`/new-standard` pass: mint a sectioning intent (define the semantic contract once — what a content
section *is*, distinct from app-shell layout and from hierarchy), then expose its presentational
treatments as the open-numbered `variant` axis (recommended core set, e.g. `plain | card | bordered`;
author-extensible). Structural differences stay block-polymorphism, not variants.

Filed by batch-2026-06-20 while resolving #1323 (layout half delivered). Cites the codified rule.

## Progress

- Minted `we:src/_data/intents/sectioning.json` (`Sectioning Intent`, status draft) — defines the
  semantic contract once: a self-contained thematic **content region** (HTML sectioning content:
  `section`/`article`/`aside`/labelled `region`), explicitly distinct from the Layout Intent (app-shell
  chrome) and the Hierarchy Intent (tree nesting). Auto-renders via `we:src/intent-pages.njk` (no nav/registry
  wiring needed — catalogs render from JSON).
- Applied the open-numbered `variant` axis (recommended core set `plain | card | bordered`,
  author-extensible per #1318/#1322, most-permissive default `plain`) — the #1323 statute generalized to
  sectioning, exactly mirroring the layout-half application.
- Semantic **role** (generic section vs self-contained article vs tangential aside vs labelled region)
  is left as the native HTML element / block polymorphism, **not** a dimension and **not** a variant, per
  the carve note ("Structural differences stay block-polymorphism").
- No design fork surfaced: this is the carved application of an already-ratified statute to a
  semantically well-bounded target. Gate green (`check:standards --scope`, 0 errors; intents 67→68).
