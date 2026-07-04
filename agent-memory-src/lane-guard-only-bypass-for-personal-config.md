---
name: lane-guard-only-bypass-for-personal-config
description: LANE_GUARD_OFF escape is only for gitignored personal use config; checked-in project files need a lane + PR
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c7533e71-0ae5-4c17-a301-388b1edff599
---

The `guard-lane.mjs` PreToolUse hook blocks edits to the shared PRIMARY checkout (#2123). Its `LANE_GUARD_OFF=1` escape hatch is ONLY legitimate for **gitignored personal use config** — `.claude/settings.local.json`, `~/.claude/*`. For any **git-tracked project file**, do NOT bypass: provision a lane (`node scripts/lane-pool.mjs status --json` / `path --lane=N`), edit there, and land via PR.

**Why:** editing the primary tree directly risks colliding with a concurrent session or the user's dev server; project changes must flow through the isolated-lane + PR transport. Personal use config isn't shared/tracked, so it has no lane to live in — editing it in a throwaway clone wouldn't affect the running session anyway.

**How to apply:** before using `LANE_GUARD_OFF=1`, run `git check-ignore <path>`. Ignored → direct edit in primary is fine. Tracked → stop, pick a lane, PR it. See [[index-batch]].
