---
kind: story
size: 3
status: open
dateOpened: "2026-06-20"
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
