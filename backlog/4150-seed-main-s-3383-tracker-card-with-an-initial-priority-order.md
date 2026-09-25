---
bornAs: xdzl6mb
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md"]
dateOpened: "2026-09-24"
tags: []
---

# Seed main's #3383 tracker card with an initial `## Priority order` skeleton so priority-sync can maintain it for real

we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md on main has no `## Priority order` section at all -- unlike the prototype branch's own copy of this card, main's has never run priority-sync. we:scripts/operations/priority-sync.mjs (graduated by #3892, PR #2628) is a SYNC tool, not a section-creator: it refuses outright when the heading is entirely absent (we:scripts/operations/priority-sync-io.mjs's read step), because placing a new ordered/claimed line requires a pre-existing Band A/B/C/Claimed/Off-path skeleton (we:scripts/operations/priority-sync.mjs's place() throws otherwise). #2628 made its own test hermetic against a fixture instead of the live card, so this gap no longer blocks any test -- but it still blocks ever running `priority-sync --apply` for real on main. Seeding the skeleton needs one genuine operator judgment call this item's build must NOT invent unaided: which cards currently belong in the Health-chain and Delegation-to-other-providers sections (both rule-3-pinned, never auto-populated). Once a skeleton (even with empty Health-chain/Delegation lists) is in place, `node we:scripts/operations/run.mjs priority-sync --apply` mechanically derives every Band A/B/C/Claimed/Off-path entry from main's live tree with zero further judgment. Done when: the section exists on main and priority-sync --apply runs clean against it.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
