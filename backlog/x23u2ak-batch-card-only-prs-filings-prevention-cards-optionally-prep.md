---
kind: epic
parent: "4376"
status: open
dateOpened: "2026-10-02"
tags: []
---

# Batch card-only PRs (filings, prevention cards, optionally prepares) into rolling PRs, configurable in Plateau

Operator, 2026-10-02: group filings and small prevention items to reduce PR count, with the setting in Plateau. Measured: of the last 300 PRs (since 2026-10-01), 236 touch only backlog cards (160 prevention filings, 105 prepares; overlapping). Each one pays a full CI run, a review round and a merge. Design to prepare: a rolling batch PR per kind (new filings and prevention cards; prepares as a separate opt-in kind because they unblock builds and should stay fast) that each filing appends to (one commit per card, through the existing guarded writer) until it reaches its size or age limit, then it is reviewed and merged like any PR; a card that fails review is dropped from the batch into its own PR so it never holds the rest. Delivery-policy settings, shown and edited in Plateau: which kinds batch, max cards per batch, max wait before the batch is sent, and whether a high-priority card skips the batch. Defaults proposed: filings and prevention cards batch, up to 15 cards or 60 minutes; prepares do not batch. Every batch PR lists its cards and their sources.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
