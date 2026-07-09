---
name: lane-guard-only-bypass-for-personal-config
description: LANE_GUARD_OFF escape is only for gitignored personal use config; checked-in project files need a lane + PR
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c7533e71-0ae5-4c17-a301-388b1edff599
---

The `guard-lane.mjs` PreToolUse hook blocks edits to the shared PRIMARY checkout (#2123). Its `LANE_GUARD_OFF=1` escape hatch is ONLY legitimate for **gitignored personal use config that does NOT resolve into a repo** — e.g. `~/.claude/settings.json`. For any **git-tracked project file**, do NOT bypass: provision a lane (`node scripts/lane-pool.mjs status --json` / `path --lane=N`), edit there, and land via PR.

**`~/.claude/*` is NOT a blanket bypass — agent memory is the trap (2026-07-09).** The user-level project memory dir `~/.claude/projects/<slug>/memory` is a **symlink into the git-tracked repo store** (`→ <repo>/.claude/agent-memory → <repo>/agent-memory-src`), so a write there realpaths under the PRIMARY and is now DENIED like any tracked file — it must ride a lane. The old "`~/.claude/*` → direct edit fine" shortcut was wrong for this path and reproduced the primary-edit mistake; the guard's memory exemption was removed to match [[no-work-ever-in-primary-all-repos]]. Memory edits go via a lane → PR, same as code (this is also exactly what the close flow's red-team→lane→PR already does).

**Why:** editing the primary tree directly risks colliding with a concurrent session or the user's dev server, and a lane-refresh `reset --hard` can wipe it; project changes (memory included) must flow through the isolated-lane + PR transport. Genuinely personal config that isn't shared/tracked has no lane to live in — editing it in a throwaway clone wouldn't affect the running session anyway.

**How to apply:** before using `LANE_GUARD_OFF=1`, run `git check-ignore <path>` AND check it does not realpath into a repo (`readlink -f`). Ignored *and* outside any repo → direct edit is fine. Tracked, OR a symlink that resolves into `<repo>/…` (the memory case) → stop, pick a lane, PR it. See [[index-batch]], [[approve_verdict_sets_review_accepted_label]].
