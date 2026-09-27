---
bornAs: xqy8cxu
kind: task
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lib/rebase-drop-content.mjs", "we:scripts/lib/rebase-drop-manifest.mjs", "we:scripts/lib/nnn-collision-heal.mjs", "we:scripts/operations/review-prep-io.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/fix-claim-store.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Drain's mechanical rebase pushes should respect the per-PR fix claim

PR #2821 (open) adds a per-PR fix claim (we:scripts/conveyor/fix-procedure.mjs, we:scripts/conveyor/fix-claim-store.mjs): while held, a push by anyone but the holder is refused in we:scripts/pr-land.mjs, the push helper, and we:scripts/guard-bash.mjs. Per that PR's own 'Not covered' note, the drain's own mechanical rebase/update pushes — we:scripts/merge-ai-prs.mjs's rebase-drop and nnn-collision-heal paths (we:scripts/lib/rebase-drop-content.mjs, we:scripts/lib/rebase-drop-manifest.mjs, we:scripts/lib/nnn-collision-heal.mjs) plus we:scripts/operations/review-prep-io.mjs — do not check the claim at all. Safe today only because the drain acts solely on ready-to-merge PRs and a claimed PR is held as a draft (fix-begin flips it via gh pr ready --undo); make the drain check and refuse a push on a held claim too, so the invariant holds by construction rather than by that draft-only coincidence. blockedBy: no numbered backlog item exists yet for PR #2821 itself (it was never filed as a card) — noting it here instead of a blockedBy reference; this item cannot land its scope check against we:scripts/conveyor/fix-claim-store.mjs until #2821 merges, since that module does not exist on main yet.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
