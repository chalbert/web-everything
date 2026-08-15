---
bornAs: xmio19r
kind: story
size: 3
parent: "2676"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Auto-capture a design snapshot when the design-studio committee run ratifies

Once the design-studio product surface (#2676: request-intake, committee-run, ratify) actually exists, wire it to call plateau-app's design-snapshot capture (#2688: `plateau-app:scripts/record-design-snapshot.mjs` / `plateau-app:src/feature-tracker/design-snapshots.ts`) automatically on ratify, instead of requiring a human to run the CLI by hand. Deferred out of #2688 because #2676 has no product surface yet to call from — this card exists so that gap is a named, sequenced follow-up rather than a silently dropped half of the original design.

Not given a `blockedBy` edge: #2676 is explicitly unsliced ("kept unsliced for now... a future /slice candidate") and this item is one of its own eventual children, so its real prerequisite — a real committee-run build slice under #2676 — does not exist as a filed item yet. Revisit when #2676 is sliced and point `blockedBy` at whichever slice lands the ratify step.
