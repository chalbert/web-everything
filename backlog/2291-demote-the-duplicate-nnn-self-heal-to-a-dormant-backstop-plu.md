---
kind: story
size: 5
parent: "2289"
status: resolved
blockedBy: ["2288"]
dateOpened: "2026-07-05"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# Demote the duplicate-NNN self-heal to a dormant backstop plus a tripwire

Once JIT numbering makes duplicate-NNN unrepresentable, the self-heal stops being the primary mechanism but is KEPT as defense-in-depth. Retain the shared collision-heal helper at the drain (the sole writer) as a dormant backstop; prune only the now-dead heal wiring on the deprecated /pr and /merge routes. Turn the pre-merge duplicate-NNN check (#2248) into a tripwire: an assertion that should never fire post-JIT, and if it ever does, it signals a JIT allocation bug and alerts rather than silently healing. Net: prevention is primary, heal is the safety net, nothing is thrown away.

## Done
- **Pruned (dead wiring on `/pr`):** `we:scripts/pr-land.mjs`'s step-2b PRE-CHECK id-collision self-heal (`healNnnCollision`, #2222) — pr-land no longer merges by default (#2290), and under JIT numbering (#2288) a new item is born hash-keyed, so "this lane's new item reuses a base NNN" is unrepresentable pre-land; the precheck could only ever no-op. Removed the import, the precheck block, its dry-run plan line, and the `precheckHealed` report fields. The RETAINED post-merge heal (`runHeal`, #2071) on the `--fallback-git` break-glass path is untouched — that path is still a real write to main.
- **Retained (dormant backstop at the drain):** `we:scripts/merge-ai-prs.mjs`'s own `HEAL_COLLISION` precheck (the sole-writer drain, #2290) and the folded heal inside `we:scripts/lib/rebase-drop-manifest.mjs` (`applyCollisionHealToIndex`) — both left functionally unchanged, comments updated to frame them explicitly as the #2291 dormant backstop (defense-in-depth, expected to no-op post-JIT).
- **Tripwire framing:** `#2248`'s `check:standards` "ids must be unique" gate (`duplicateBacklogNums`, `we:scripts/check-standards-rules.mjs`) already carried the tripwire framing from its own resolution; left as-is (confirmed, not re-done here).
- Updated `we:docs/agent/backlog-workflow.md`'s NNN-collision pipeline section to mark fire-point 3 (pr-land precheck) as pruned and fire-points 5/6 as the retained dormant backstop / tripwire.
