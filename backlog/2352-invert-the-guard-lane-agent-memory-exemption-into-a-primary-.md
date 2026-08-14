---
kind: story
size: 2
parent: "2301"
status: resolved
blockedBy: ["2350"]
dateOpened: "2026-07-09"
dateStarted: "2026-08-14"
dateResolved: "2026-08-14"
graduatedTo: b54f49a8
tags: []
---

# Invert the guard-lane agent-memory exemption into a primary-only deny-with-reason backstop

Delete the inAgentMemory allow carve-out at we:scripts/guard-lane.mjs:54-61 and replace it with a deny-with-reason that fires only when a write realpaths into the PRIMARY agent-memory-src/ (or the user-skills dir) — the same primary-leak class. In the happy path (memory now resolves to the dedicated lane, blocked-by 2350) it never fires; it catches a mis-pointed symlink or a stray direct primary write loudly instead of silently dirtying the tree. Blocked by the repoint slice so the deny never fires while the symlink still resolves to primary (would break the loop). Slice of #2301.

## Already delivered — resolved 2026-08-14, graduated to `b54f49a8`

Verified against the current file, not the card's prose. The commit `b54f49a8` ("guard-lane: remove
agent-memory exemption — memory edits ride a lane too") landed **2026-07-09 — the same day this card was
filed** — and does exactly what the card asks:

- **The allow carve-out is gone.** `we:scripts/guard-lane.mjs` no longer contains an `inAgentMemory`
  identifier at all (`git log -S inAgentMemory` shows it added by `8ba95d91` and removed by `b54f49a8`).
  The header now carries the opposite ruling in prose: *"AGENT MEMORY IS NOT EXEMPT (2026-07-09,
  superseding a conflicting 2026-07-03 …note)"*. The card's line reference `:54-61` now points at that
  superseding comment, not at any carve-out.
- **It is a deny-with-reason, and the reason is memory-specific.** `laneGuardDecision` computes
  `isMemory` from `/agent-memory-src/` or `/.claude/agent-memory/` in the realpath and appends
  *"Agent memory is git-tracked project content — it is NOT exempt (2026-07-09); edit it in a lane too,
  same as any file"* to the deny, and deliberately withholds the `LANE_GUARD_OFF=1` escape hint for the
  memory case.
- **It fires only against the PRIMARY.** The decision returns `null` (allow) for any path under
  `.lanes/` before it ever reaches the primary branch, so a write into a lane clone's own
  `agent-memory-src/` passes — which is the backstop shape this card specified.
- **The user-skills dir is covered by the same rule.** `~/.claude/skills/<name>` symlinks into
  `we:skills-src/<name>`, which realpaths under the primary checkout, so a skills write in primary is
  denied by the same primary-prefix test. Residual, cosmetic only: the deny message is the generic
  primary-checkout text rather than a skills-flavoured one. Not worth a card.

**Note for #2350/#2351.** The ordering this card worried about did happen: the deny landed **without**
#2350's repoint, and the machine-global memory symlink still realpaths to the PRIMARY
(`~/.claude/projects/-Users-…-webeverything/memory` → `we:.claude/agent-memory` → `we:agent-memory-src/`).
So today a memory Edit through the harness path is denied everywhere except from inside a lane clone —
the "blanket deny breaks the loop" failure mode #2301 predicted. That is #2350's remaining human-gated
cutover to fix, not this card's.
