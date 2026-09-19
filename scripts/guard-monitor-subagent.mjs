#!/usr/bin/env node
/**
 * PreToolUse(Monitor) guard: ask before a subagent starts a background watch.
 * Defense in depth for SubagentStop events that may not fire. Main-session watches are allowed.
 * Input: hook JSON on stdin. Output: an ask decision, or nothing. Read/parse errors fail OPEN.
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
      permissionDecision: 'ask',
      permissionDecisionReason: "Ending this subagent's turn after starting a Monitor watch will not reliably deliver a wake-up notification. Per the pinned rule in root CLAUDE.md, block or poll in the foreground within this turn instead; do not end the turn assuming a background process will wake you. Confirm that Monitor is appropriate before starting this watch.",
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
