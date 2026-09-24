---
kind: story
size: 3
parent: "3383"
status: active
scaffoldedBy: "close-3784"
dateScaffolded: "2026-09-23"
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:docs/agent/platform-decisions.md"]
dateOpened: "2026-09-23"
tags: []
---

# Build #3850 Fork 2: force review:pending / a merge hold on delegated routes at the land seam

#3850's Fork 2 was ratified 2026-09-22 (every route whose executed vendor is not Claude gets a dispatch-time hold, then a merge hold at the land seam requiring independent review before landing) but only Fork 1 (naming a supervisor so a well-formed dispatch is never held at spawn) was ever built, as part of #3784's own scope. Fork 2 -- forcing review:pending or an equivalent merge hold on a delegated route at the land seam -- has no code and no tracking item. Needed before #3443 graduates the branch to main, since without it a delegated (non-Claude) dispatch that clears spot-check has no independent look before landing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
