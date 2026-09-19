#!/usr/bin/env node
/**
 * Stop/SubagentStop guard (#3383): passive-wait prose AND an unresolved background Bash call.
 * Language alone never blocks; harness-tracked Agent/Task calls are excluded. A returned Bash
 * tool_result (including a background-launch acknowledgement) is resolved for this narrow guard;
 * it does not attempt to infer process liveness or Monitor targets from prose/task-id guesses.
 *
 * Read only the supplied agent's transcript, at most 2 MB from its end, following agent-health.mjs's
 * bounded-tail discipline. Missing/invalid input or transcript fails OPEN. Never scan other sessions.
 * The pure decision functions consume raw JSONL entries, without filesystem/process access.
 */
import { readFileSync, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_TRANSCRIPT_BYTES = 2_000_000;

/** System-directed passive waiting, excluding common requests to wait for a human. Pure. */
export function hasPassiveWaitLanguage(text) {
  if (typeof text !== 'string') return false;
  return /\bwill\s+(?:notify|wake|alert)\s+me\b|\bnotify\s+me\s+when\b|\bwaiting\s+for\s+the\s+(?:notification|poll|background)\b|\bmonitor\s+will\s+(?:alert|notify)\b|\bpolling\s+in\s+the\s+background\b|\b(?:I'll|I’ll|I\s+will)\s+wait\s+for\s+(?!(?:your\s+(?:reply|response|input|guidance|approval|confirmation)|you\s+to)\b)\S|\bcheck\s+back\s+(?:later|shortly)\b|\bthe\s+(?:agent|task|job)\s+will\s+(?:let\s+me\s+know|notify)\b/i.test(text);
}

/** Raw Claude transcript message.content blocks only; nested progress/child transcripts are not ours. */
export function findUnresolvedBackgroundedBash(transcriptEntries) {
  if (!Array.isArray(transcriptEntries)) return null;
  const uses = [];
  const results = new Set();
  for (const entry of transcriptEntries) {
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (entry.type === 'user' && block?.type === 'tool_result') results.add(block.tool_use_id);
      if (entry.type === 'assistant' && block?.type === 'tool_use' &&
          block.name === 'Bash' && block.input?.run_in_background === true &&
          typeof block.id === 'string' && block.id) uses.push(block);
    }
  }
  return uses.find((use) => !results.has(use.id)) || null;
}

/** Both signals are required. Give the harness's already-active stop-hook continuation an exit. */
export function shouldBlockStop({ lastAssistantText, transcriptEntries, stopHookActive } = {}) {
  if (stopHookActive === true || !hasPassiveWaitLanguage(lastAssistantText) ||
      !findUnresolvedBackgroundedBash(transcriptEntries)) return null;
  return 'Passive waiting cannot finish this task: your transcript still has an unresolved background Bash call. Check its status/output directly and wait or poll within this turn; do not assume a notification will arrive. Report a concrete blocker if you cannot continue.';
}

/** Bounded IO, no full-file read. Drop the potentially partial first line; reject all other parse errors. */
export function readTranscriptTail(transcriptPath) {
  const fd = openSync(transcriptPath, 'r');
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('Transcript must be a regular file');
    const start = Math.max(0, stat.size - MAX_TRANSCRIPT_BYTES);
    const buffer = Buffer.alloc(stat.size - start);
    const count = readSync(fd, buffer, 0, buffer.length, start);
    if (count !== buffer.length) throw new Error('Incomplete transcript read');
    let text = buffer.toString('utf8');
    if (start > 0) {
      const newline = text.indexOf('\n');
      text = newline < 0 ? '' : text.slice(newline + 1);
    }
    return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } finally {
    closeSync(fd);
  }
}

const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'));
    const hookEventName = event.hook_event_name;
    if (hookEventName !== 'Stop' && hookEventName !== 'SubagentStop') process.exit(0);
    if (event.stop_hook_active === true) process.exit(0);
    const message = event.last_assistant_message;
    const lastAssistantText = typeof message === 'string' ? message : message?.content;
    if (!hasPassiveWaitLanguage(lastAssistantText)) process.exit(0);
    // The official hooks reference documents `transcript_path` as a common field on every event,
    // including SubagentStop, with no separate field for a subagent's own transcript — and does not
    // state whether that path is the subagent's own or the parent's for a SubagentStop event. This
    // guard does not invent an unconfirmed field name to resolve that; it reads whatever
    // `transcript_path` names for the event that fired, which fails open on read/parse trouble either
    // way (see the catch below) and is real evidence of an unresolved background Bash call in
    // whichever transcript the harness handed us — parent or subagent.
    const transcriptPath = event.transcript_path;
    const transcriptEntries = readTranscriptTail(transcriptPath).filter((entry) =>
      (!entry?.sessionId || entry.sessionId === event.session_id) &&
      (!entry?.agentId || entry.agentId === event.agent_id));
    const reason = shouldBlockStop({ lastAssistantText, transcriptEntries, stopHookActive: event.stop_hook_active });
    if (reason) {
      console.log(JSON.stringify({
        decision: 'block',
        reason,
        stop_hook_active: true,
        hookSpecificOutput: { hookEventName, reason },
      }));
      // Exit 2 uses stderr for agent feedback in the current hooks reference; keep the requested JSON too.
      console.error(reason);
      process.exitCode = 2;
    }
  } catch {
    // A guard/read/parse failure must never wedge a legitimate stop.
    process.exitCode = 0;
  }
}
