---
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md", "we:scripts/__tests__/priority-order.test.mjs", "we:scripts/operations/__tests__/priority-sync.test.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Seed main's #3383 tracker card with an initial `## Priority order` skeleton so priority-sync can maintain it for real

we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md on main has no `## Priority order` section at all -- unlike the prototype branch's own copy of this card, main's has never run priority-sync. we:scripts/operations/priority-sync.mjs (graduated by #3892) is a SYNC tool, not a section-creator: it refuses outright when the heading is entirely absent (we:scripts/operations/priority-sync-io.mjs's read step), because placing a new ordered/claimed line requires a pre-existing Band A/B/C/Claimed/Off-path skeleton (we:scripts/operations/priority-sync.mjs's place() throws otherwise). Seeding that skeleton needs one genuine operator judgment call this item's build must NOT invent unaided: which cards currently belong in the Health-chain and Delegation-to-other-providers sections (both rule-3-pinned, never auto-populated). Once a skeleton (even with empty Health-chain/Delegation lists) is in place, `node we:scripts/operations/run.mjs priority-sync --apply` mechanically derives every Band A/B/C/Claimed/Off-path entry from main's live tree with zero further judgment. Done when: the section exists on main, priority-sync --apply runs clean against it, and the two it.skip tests in we:scripts/__tests__/priority-order.test.mjs (landed by #3891, explicitly written to wait for this) plus the one it.skip this item's own sibling #3892 added to we:scripts/operations/__tests__/priority-sync.test.mjs are un-skipped and green.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
