---
bornAs: xk83zyw
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs", "we:skills-src/conveyor/com.we.conveyor-pass-daemon.merge-orphan-sweep.plist.example"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Give the merge-ai-prs orphan-PR sweep a home in the pass-daemon watchers (epic #3383)

Found live: PR #2504 (branch lane/wip-socket-card, label checking only, CI green) has no owner — we:scripts/conveyor/reconcile-pass.mjs reports it nothing-owed/phase open, correctly, because reconcile only tracks producer-completed (ready-to-merge-labelled) or review-parked PRs, never a bare AI-authored PR sitting on checking with no manifest/label transition at all. Every running daemon in this epic (the review daemon, the fix-dispatch daemon, every we:skills-src/conveyor/pass-daemon.mjs watcher) is downstream of we:scripts/conveyor/reconcile-pass.mjs's own discovery, so NONE of them would ever surface #2504. The one pass that DOES cover this population is we:scripts/merge-ai-prs.mjs's own bare (no --label) invocation — documented in its own header as the /merge orphan sweep, which lists every open PR directly via its own gh pr list, independent of reconcile — but it previously ran ONLY on manual /merge invocation, never mechanically. This slice registers it as a new we:skills-src/conveyor/daemon-manifest.mjs entry (merge-orphan-sweep, bare args, 15-minute interval — heavier than a read-only watch since it can actually merge a PR, but far more frequent than the 6h orphan-claim-release since an orphaned green PR should not sit for long) so it can run under we:skills-src/conveyor/pass-daemon.mjs --pass=merge-orphan-sweep, plus a NEW launchd plist EXAMPLE (we:skills-src/conveyor/com.we.conveyor-pass-daemon.merge-orphan-sweep.plist.example, mirrored from the existing supervisor plist example — inert, not installed, not loaded) documenting how an operator would actually run it as a resident watcher. Deliberately never --label=ready-to-merge (the separate, already-covered /drain role) and never --repos/--this-repo (bare already defaults to the full constellation). Safe to run periodically alongside any other lander: we:scripts/merge-ai-prs.mjs's own header states it is the SOLE WRITER TO MAIN, serializing every real merge through its own whole-process drain lease + we:scripts/lib/pr-merge-gate.mjs — the same mutual-exclusion primitive an interactive /merge, /pr, or /finish run, or an already-resident labeled drain, also goes through, so this periodic bare sweep is either the only lander touching an orphan PR (real, needed work) or a harmless no-op behind another lander's held lease, and it does not need to know which case is live before being added. New tests pin the manifest entry's shape (script/args/interval) and its two negative invariants (no --repo*, no --label). No code in we:scripts/merge-ai-prs.mjs itself changes.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
