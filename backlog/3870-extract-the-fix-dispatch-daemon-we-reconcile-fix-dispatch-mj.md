---
bornAs: x1yfzce
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:skills-src/conveyor/runner.mjs", "we:scripts/operations/action-store.mjs"]
dateOpened: "2026-09-22"
tags: []
---

# Extract the Fix-dispatch daemon (we:reconcile-fix-dispatch.mjs) to run standalone

we:scripts/conveyor/reconcile-fix-dispatch.mjs already fences its own resume-or-dispatch decision per PR through we:scripts/operations/action-store.mjs's durable, atomic (fs.openSync(path,'wx')) per-resource claim ledger, independent of the shared tick mutex -- confirmed cross-process-safe by direct read. Wrap it as its own long-lived standalone daemon process (own interval loop, own lease heartbeat), then drop it from we:skills-src/conveyor/runner.mjs's own mechanicalPasses list once it has baked -- the rolling, pass-by-pass cutover this epic uses elsewhere, safe here because this pass already tolerates concurrent/duplicate runs by construction. No new lock/lease work needed; this is the one pass in the split whose cross-process safety already exists. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
