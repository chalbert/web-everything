---
bornAs: xo9j1o7
kind: task
status: open
scope: ["we:scripts/lib/rebase-drop-content.mjs", "we:scripts/lib/rebase-drop-manifest.mjs", "we:scripts/lib/nnn-collision-heal.mjs", "we:scripts/operations/review-prep-io.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/lib/__tests__/rebase-drop-content.test.mjs", "we:scripts/lib/__tests__/rebase-drop-manifest.test.mjs", "we:scripts/lib/__tests__/nnn-collision-heal.test.mjs", "we:scripts/operations/__tests__/review-prep-io.test.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs", "we:scripts/conveyor/soak/breaks/"]
dateOpened: "2026-09-29"
tags: []
---

# Real soak break for #4293's drain rebase-push fix (waived in #2945)

PR chalbert/web-everything#2945 (closing #4293, merged 2026-09-29) made the drain's own mechanical rebase/heal pushes (we:scripts/lib/rebase-drop-content.mjs, we:scripts/lib/rebase-drop-manifest.mjs, we:scripts/lib/nnn-collision-heal.mjs, we:scripts/operations/review-prep-io.mjs) refuse a push on a branch another fixer holds a live per-PR fix claim on, via a new we:scripts/conveyor/fix-procedure.mjs export (refuseHeldPush). It shipped with a soak-waiver instead of a real soak break: "Nothing broke in production; there is no live incident to replay ... a synthetic daemon-soak scenario would only re-derive the same assertion through a heavier harness." That reasoning conflates unit coverage with soak coverage, and a break here is genuinely feasible: we:scripts/conveyor/soak/breaks/lease-reaper-merge-commit-blind-spot.mjs is the live precedent for exactly this shape -- no daemon tick loop (daemons: []), just the real resident code driven directly against a throwaway git repo and fake claim-store state, red before its fix and green after.

Proposed break, we:scripts/conveyor/soak/breaks/drain-mechanical-push-ignores-fix-claim.mjs: build a throwaway git repo with a branch, acquire a live fix claim on it (we:scripts/conveyor/fix-claim-store.mjs) under a DIFFERENT session/token than the caller, then call one of the four now-guarded push paths directly (e.g. rebaseDropManifest from we:scripts/lib/rebase-drop-manifest.mjs) attempting a push to that branch. RED -- with the guard reverse-applied via we:scripts/conveyor/soak/red-green.mjs --break=drain-mechanical-push-ignores-fix-claim --revert=809a8e4d64585f8ccae3a1b7905bd22b1dc61bf6 --paths=we:scripts/lib/rebase-drop-manifest.mjs,we:scripts/conveyor/fix-procedure.mjs (or the sibling files) -- the push lands on the claimed branch anyway. GREEN -- with the fix restored, the call returns { action: 'error', reason: <pushRefusal's message> } and the branch is untouched.

## Done when

1. **Executable** — `node we:scripts/conveyor/soak/red-green.mjs --break=drain-mechanical-push-ignores-fix-claim` reports RED with #4293's own fix commit (809a8e4d64585f8ccae3a1b7905bd22b1dc61bf6) reverse-applied on we:scripts/lib/rebase-drop-manifest.mjs (or whichever guarded path the break drives) plus we:scripts/conveyor/fix-procedure.mjs, and GREEN against this tree with the fix intact — the daemon-soak proof #2945's soak-waiver said would only "re-derive the same assertion through a heavier harness", now actually run.
2. we:scripts/conveyor/soak/breaks/drain-mechanical-push-ignores-fix-claim.mjs exists and is auto-discovered by we:scripts/conveyor/soak/breaks/index.mjs (no hand-edit there); its `fixPresent` probe reads false on a pre-#4293 tree and true on this one.
3. we:backlog/4293-drain-s-mechanical-rebase-pushes-should-respect-the-per-pr-f.md's own record carries a note that its soak-waiver is now retired by this item's real break, so the waiver is never mistaken for still-standing policy.
