---
kind: decision
status: open
dateOpened: "2026-09-18"
tags:
  - agent-coordination
  - lane-lifecycle
  - commit-durability
  - git-workflow
  - push-gap
---

# Lane-clone commit push gap

A dispatched agent completes real work in a lane clone (writes, commits, gets a real commit hash) and reports success — but stops without pushing the branch or opening a PR. The commit exists only in the lane clone, is invisible to `git log --all` on origin, and silently vanishes. Two instances tonight: a tracker-note append and decision item `xjlc4y3` in lane-58. Investigate whether a lane-lifecycle guard should warn/block on abandoned lanes with local commits ahead of remote, or whether task-completion contracts should require explicit push/PR confirmation before marking done.

## Details

### The gap

A dispatched agent does real work in a lane clone — writes a file, commits it with a real commit hash, and reports success. The commit genuinely exists. But the agent stops without pushing the branch or opening a PR. The commit is invisible to the real repo: `git log --all` on origin does not see it. The work vanishes silently because nothing ever surfaces the commit. A second pass discovers and re-files what should have been completed the first time.

This is distinct from a false success report (the commit is real, not fabricated). It is a "stopped one step short of durable" gap — the agent worked, but the work never propagated out of the lane clone to where it is persistent or discoverable.

### Real instances (2026-09-18)

1. **Tracker note append.** An agent was dispatched to append a tracker note. It reported success. The append was confirmed real (not a false report), but only existed in the lane clone's working tree. A second pass discovered the unpushed state, confirmed the work was genuine but unmerged, and re-applied it.

2. **Decision item `xjlc4y3`.** An agent claimed and worked a decision item in lane-58. The item was committed (commit `aea2e38c0`), but the branch was never pushed. The commit existed only in the lane clone. A follow-up investigation found the unpushed branch, confirmed the work was real, and re-filed the item as [PR #2308](https://github.com/chalbert/web-everything/pull/2308).

### Proposed investigation angles

**Not a ruling, but concrete angles to explore:**

**Related prior art:** [#2267 — Lane-pool refresh/provision must not hard-reset a dirty-or-ahead lane](/backlog/2267-lane-pool-refresh-provision-must-not-hard-reset-a-dirty-or-a/) shipped the `laneDirtyOrAhead` guard in [we:scripts/lane-pool.mjs](../scripts/lane-pool.mjs): `refreshLane()` (`refresh`/`provision`) skips dirty or ahead lanes by default instead of silently resetting away their work; `aheadIsProvablyPushed` extends that protection to `acquire`'s auto-pick, keeping an ahead lane unsafe to recycle unless its HEAD is provably on a live remote ref. That is an existing safety net against **another session's destructive pool maintenance**. Here, the **authoring agent itself stops short of durability**, reporting success after committing without pushing or opening a PR: nothing destroys the commit, and no other session's pool operation is involved. Both concern unpushed-lane-commit durability, but this gap is **discovery/completion-contract shaped**, not destruction shaped — #2267 keeps protecting the invisible commit from a reset without triggering the surfacing wanted here; requiring proof of push in the author's completion contract would catch the gap immediately instead of waiting for someone to discover an ahead lane.

- **Lane-lifecycle guard (pattern: [PR #2304](https://github.com/chalbert/web-everything/pull/2304) passive-wait Stop hook).** When a lane is being released/abandoned, should the lane-release path warn or block if the lane has local commits ahead of its remote tracking branch? This would catch the gap at abandonment time — force the agent/human to either push or explicitly acknowledge dropped commits.

- **Task-completion contract.** Should the standard pattern for any lane-clone edit task explicitly require confirming a real `git push` or PR open before reporting success? The codebase already treats "backgrounded and forgotten" as a violation (see [we:CLAUDE.md](../CLAUDE.md) pinned rule); this would extend that: "committed but unpushed" is similarly incomplete and should not mark the task done.

Either approach (or both) would make the boundary between "done locally" and "done durably" explicit, preventing silent data loss and downstream discovery/re-file overhead.

## Done when

1. **Investigation complete.** Explored and documented the feasibility and trade-offs of the two angles (lane-release guard vs. task-completion contract), with a recommendation for which (or both) should be pursued.
