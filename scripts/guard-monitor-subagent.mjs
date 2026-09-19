#!/usr/bin/env node
/**
 * PreToolUse(Monitor) guard: deny subagent background watches with foreground guidance.
 * An "ask" decision is unreliable in non-interactive contexts and may require an unavailable
 * human to answer for a background subagent; denial resolves synchronously without a prompt.
 * Defense in depth for SubagentStop events that may not fire. Main-session watches are allowed.
 * Input: hook JSON on stdin. Output: a deny decision, or nothing. Read/parse errors fail OPEN.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Only the documented subagent identity on a PreToolUse Monitor event triggers this guard. Pure. */
export function decide(event) {
  if (event?.hook_event_name !== 'PreToolUse' || event.tool_name !== 'Monitor' ||
      typeof event.agent_id !== 'string' || !event.agent_id) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: "Monitor is denied for subagents: its 'started' acknowledgment does not ensure a completion notification will reach you. Per the pinned rule in root CLAUDE.md, run the gating check as a synchronous foreground command within this turn (for example, until <condition>; do sleep N; done). Do not end the turn assuming a background watch will wake you.",
    },
  };
}

const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'));
    const decision = decide(event);
    if (decision) process.stdout.write(JSON.stringify(decision));
  } catch {
    // A guard/read/parse failure must never wedge a legitimate tool call.
    process.exitCode = 0;
  }
}
