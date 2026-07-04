---
name: project_enforce_shared_gate_at_write_time
description: "To stop an in-work item from breaking the shared check:standards gate for concurrent agents, enforce at write-time (PreToolUse), not pre-commit — the gate scans the working tree on disk"
metadata: 
  node_type: memory
  type: project
  originSessionId: b185c785-d82a-4947-bbcf-6aec86e86742
---

`check:standards` (and the other gates) scan the **working tree on disk**, not the git index — so a bare/invalid ref breaks the gate for **every concurrent agent the instant it's saved**, long before any commit. Therefore the correct place to enforce a shared-gate invariant against in-work breakage is **write-time**, not commit-time:

- **`PreToolUse(Edit|Write)` hook** that scans the *proposed* content (from the hook event JSON) and **denies the write** if it would introduce a violation → the working tree never holds a gate-breaking state, so no concurrent agent's gate goes red from your mid-edit file. This is the load-bearing layer.
- A **pre-commit hook is the wrong layer** for this goal: the file is already broken on disk pre-commit, so the concurrent-agent damage is already done. (A pre-commit/`--staged` sweep is still a useful *backstop* for `cat >>`/heredoc body-appends that fire no Edit/Write tool.)

**Why:** the failure mode is "shared gate red from someone else's unfinished work", and the shared surface is the working tree. Block before disk, not before commit.

**How to apply:** when adding enforcement for any working-tree-scanned gate (locus-prefix #883/#884/#885 was the first — `scripts/lint-locus-prefix.mjs --pre` wired as `PreToolUse(Edit|Write)` in `we:.claude/settings.json`), reach for a `PreToolUse` content-scan first; add `PostToolUse`/`--staged` only as backstops. Diagnose the real failure layer before building enforcement machinery (I first built a pre-commit hook here and it was the wrong layer). Relates to [[feedback_gate_red_stop_scoped_to_own_work]] (the consumption-side mitigation: `--scope` demotes concurrent findings) — this is the production-side prevention.
