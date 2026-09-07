---
bornAs: xyaf9lm
kind: story
size: 8
parent: "3593"
status: open
scope: ["we:scripts/dev/agent-instruction-slip-scan.mjs", "we:skills-src/inspect-agent-health/agent-health.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Stage 1 - fleet-wide scanner for false monitor-wait claims AND broken busy-spin Monitor calls across active subagent transcripts (report-only)

First buildable slice of we:backlog/3593-catch-and-correct-agent-instruction-slips-mechanically-a-syn.md. Scope: a report-only fleet-wide scanner over TWO distinct syntactic patterns, both genuinely pattern-detectable and not judgment calls:

**Pattern (a) - the false claim.** A subagent's transcript containing a prose claim that a background wait is being tracked (e.g. "I've set up a monitor", "I'm monitoring this in the background", "I'll be notified when it finishes") with no real Monitor tool_use anywhere in the same recent window of its own transcript. This is the clearest, most common catch from the session that motivated the epic.

**Pattern (b) - the broken busy-spin Monitor call, added 2026-09-07 from a second live catch the same night.** A REAL `Monitor` tool_use whose own `command` field is itself broken: a wait-loop (`until`/`while` with a condition) whose body has no `sleep` call anywhere (a bare `:` no-op, or nothing at all, in its place). Live example caught and manually killed after 3.5+ minutes at 95-98% CPU: `until [ -f /tmp/verify-lane-done.marker ] ...; do :; done ...` - note the checked marker path was itself hallucinated (nothing in this repo's verify-lane tooling ever creates it), but that half is NOT what pattern (b) checks - the missing-sleep half is independently dangerous even when the checked condition is real and will eventually become true, because a no-sleep loop polls as fast as the OS allows instead of at a reasonable interval. Detecting pattern (b) needs no judgment about whether the condition is real or fake, and no execution of the command - it is a static check against the `command` string of any `Monitor` tool_use: does it contain an `until`/`while` loop, and if so, does that loop's body contain a `sleep` call anywhere? No `sleep` -> flag it. This is a documentation gap as well as a scanning gap: grepped this repo's we:skills-src/ and we:docs/agent/ for any existing guidance on constructing a Monitor wait-loop (e.g. in we:skills-src/mechanical-delivery-doctrine/SKILL.md) and found none - no rule anywhere says a Monitor loop body must sleep between polls, so this scanner's flag is the first place this gets caught.

Two existing pieces get reused, not re-derived: (1) we:skills-src/inspect-agent-health/agent-health.mjs already supplies the safety property this needs - a byte-capped, line-capped bounded tail read of one transcript (never the whole file), its transcript-location logic (id / output_file / direct path resolution across ~/.claude/projects/<slug>/<session>/subagents/agent-<id>.jsonl), and its per-entry summarize/format helpers (summarizeEntry, flattenToolResultText) - all already exported for reuse. (2) we:scripts/dev/active-progress-watch.mjs already demonstrates the fleet-wide enumeration this needs with no ListAgents tool involved: it derives PROJECT_SLUG from cwd, walks ~/.claude/projects/<slug>/ for every session directory, and lists each one's subagents/ (plus the nested subagents/workflows/<runId>/ shape) directly off disk via readdirSync, using file mtime for freshness. The new scanner combines these two: enumerate every currently-active subagent transcript the we:scripts/dev/active-progress-watch.mjs way, then run we:skills-src/inspect-agent-health/agent-health.mjs's bounded-tail read plus TWO cross-checks over each one - (a) scan the tail's text/thinking blocks for the monitor-claim phrasing, and separately collect every real Monitor tool_use in the same bounded window (a straightforward tool_use.name === "Monitor" match, no new parsing needed since summarizeEntry already classifies each block by kind), flagging any transcript where a claim is present but no matching tool_use is; (b) for every real Monitor tool_use found, statically check its `command` string for an until/while loop with no sleep in the body, flagging that Monitor call directly regardless of whether a prose claim was even made.

Report-only in this slice, per the epic's staged plan: it prints/logs which agent transcripts (pattern a) or which specific Monitor tool_use calls (pattern b) look suspicious (id, transcript path, the matched claim text or command snippet) - no auto-correction, no SendMessage, no session state change, no killing a live process. That is explicitly a later stage.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
