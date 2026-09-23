---
kind: task
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/dispatched-agent-system-prompt.md", "we:skills-src/conveyor/fix-agent-brief.md", "we:skills-src/review/review-agent-system-prompt.md", "we:scripts/conveyor/stand-down.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# Fix agent must use Edit/Write (not a Bash rewrite) for tracked files, and report blocked-on-infra instead of standing down on a tool/permission denial

PR #2518's fix session posted the terminal stand-down marker, saying the reviewer's finding "needs a judgment
the fix agent could not safely make." It didn't: live transcript evidence (job `fix-2518`, 2026-09-23) shows the
fix agent used a `python3` heredoc to rewrite `we:backlog/3945-*.md` inside its own already-acquired lane clone,
and Claude Code's own auto-mode permission classifier denied it outright -- `[Modify Shared Resources]` -- even
though Bash itself was fully permitted there. That is infrastructure friction, not a judgment call, and it
wrongly stalled a mechanically-clear repair on a human. This item tells every dispatched agent (fix, and the
review-dispatch sibling) to use the already-allow-listed Edit/Write tool for tracked-file content changes
instead of a Bash rewrite, and gives the fix-agent brief a distinct escalation exit for a permission/tool-use
denial on an otherwise-clear fix -- report `blocked-on-infra` (retried by the reconciler after
`we:scripts/conveyor/reconcile-core.mjs`'s `INFRA_RETRY_COOLOFF_MS`), never `we:scripts/conveyor/stand-down.mjs`
(terminal, reserved for a real judgment call).

## Done when

1. **Executable** -- `npx vitest run we:skills-src/conveyor/__tests__/edit-not-bash-rewrite-rule.test.mjs
   we:scripts/conveyor/__tests__/stand-down.test.mjs we:scripts/conveyor/__tests__/hiccup-classify.test.mjs`
   passes: the standing system prompts and the fix brief name the Edit/Write-not-Bash rule and the new
   `blocked-on-infra` escalation exit, `we:scripts/conveyor/stand-down.mjs`'s reason vocabulary carries no
   permission/infra-shaped entry, and `we:scripts/conveyor/hiccup-classify.mjs` recognizes the new exit's
   one-line return as a KNOWN structured shape.
