---
kind: story
size: 5
parent: "xxi3zgv"
status: open
scope: ["we:scripts/dev/agent-instruction-slip-scan.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Stage 1 - fleet-wide scanner for false monitor-wait claims across active subagent transcripts (report-only)

First buildable slice of we:backlog/xxi3zgv-catch-and-correct-agent-instruction-slips-mechanically-a-syn.md. Scope: a report-only fleet-wide scanner for exactly one syntactic pattern - a subagent's transcript containing a prose claim that a background wait is being tracked (e.g. "I've set up a monitor", "I'm monitoring this in the background", "I'll be notified when it finishes") with no real Monitor tool_use anywhere in the same recent window of its own transcript. This is the clearest, most common catch from the session that motivated the epic, and is genuinely pattern-detectable, not a judgment call.

Two existing pieces get reused, not re-derived: (1) we:skills-src/inspect-agent-health/agent-health.mjs already supplies the safety property this needs - a byte-capped, line-capped bounded tail read of one transcript (never the whole file), its transcript-location logic (id / output_file / direct path resolution across ~/.claude/projects/<slug>/<session>/subagents/agent-<id>.jsonl), and its per-entry summarize/format helpers (summarizeEntry, flattenToolResultText) - all already exported for reuse. (2) we:scripts/dev/active-progress-watch.mjs already demonstrates the fleet-wide enumeration this needs with no ListAgents tool involved: it derives PROJECT_SLUG from cwd, walks ~/.claude/projects/<slug>/ for every session directory, and lists each one's subagents/ (plus the nested subagents/workflows/<runId>/ shape) directly off disk via readdirSync, using file mtime for freshness. The new scanner combines these two: enumerate every currently-active subagent transcript the we:scripts/dev/active-progress-watch.mjs way, then run we:skills-src/inspect-agent-health/agent-health.mjs's bounded-tail read plus a new text-vs-tool_use cross-check over each one - scan the tail's text/thinking blocks for the monitor-claim phrasing, and separately collect every real Monitor tool_use in the same bounded window (a straightforward tool_use.name === "Monitor" match, no new parsing needed since summarizeEntry already classifies each block by kind); flag any transcript where a claim is present but no matching tool_use is.

Report-only in this slice, per the epic's staged plan: it prints/logs which agent transcripts look suspicious (id, transcript path, the matched claim text, snippet) - no auto-correction, no SendMessage, no session state change. That is explicitly a later stage.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
