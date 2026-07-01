---
kind: story
size: 3
parent: "2005"
status: open
blockedBy: ["2065"]
dateOpened: "2026-07-01"
tags: []
---

# Client hydrate(root) adopt path for SSR directive regions — shared upgrade idempotency set

Fourth slice of the SSR surface (per #2030). Add a registry hydrate(root) method that walks the same SHOW_COMMENT markers and, for each region with content already present between start/end (+ serialized state per #2065), BINDS lifecycle/refresh to the existing nodes and marks the region hydrated — skipping re-stamp. Defined as upgrade-without-stamp-when-content-present, sharing upgrade's #upgraded idempotency WeakSet (both key on the comment node) so a region never connects twice or stamps over live SSR content. Nested regions adopt via the existing connectOrder tree. This is the single JS client for all languages. Degenerate fallback: on absent/corrupt serialized state, fall back to discard-and-re-stamp (Lit digest-mismatch behaviour).
