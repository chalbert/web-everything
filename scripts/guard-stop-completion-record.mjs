#!/usr/bin/env node
/**
 * Stop guard (#4070): a dispatched agent may not end its turn while its own completion record is still open.
 *
 * Every dispatched brief says "report `started` first, report `done` last". On 2026-09-24 agents reported
 * `started` and then stopped without the `done` — and a record left at `started` reads exactly like a live
 * session, so nothing downstream moved until the session reaper's backstop
 * (`we:scripts/conveyor/session-reaper.mjs#planBackstopCompletion`) caught it much later. Whether this session
 * has an open record is fully script-decidable, so it is a hook, not a sentence in a brief:
 *
 *   • a completion record (`we:scripts/operations/completion-store.mjs`) whose `sessionId` is THIS session's
 *     id and whose status is still `started` — `completion-cli.mjs report` stamps `CLAUDE_CODE_SESSION_ID`
 *     into every agent-written record (#4306), so ownership is exact, never guessed from a slug;
 *   • the delivery report named by `$DELIVERY_SESSION` (`we:scripts/operations/delivery-report-store.mjs`,
 *     the v2 delivery brief's channel) still at `started`.
 *
 * Blocks ONCE: on the harness's continuation (`stop_hook_active`) it lets the stop through, so an agent that
 * genuinely cannot report is never wedged — the reaper backstop still covers it. A session that never wrote
 * `started` has nothing open here and is not this hook's case (the backstop is). Missing input, an unreadable
 * store or a corrupt record all fail OPEN.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listCompletionSessions, resolveCompletionsDir, tryReadCompletion } from './operations/completion-store.mjs';
import { resolveDeliveryReportsDir, tryReadDeliveryReport } from './operations/delivery-report-store.mjs';

/** The records in `completions` this session still owes a `done` for. Pure. */
export function openCompletionRecords(completions, sessionId) {
  if (!sessionId || !Array.isArray(completions)) return [];
  return completions.filter((r) => r && r.status === 'started' && r.sessionId === sessionId);
}

/**
 * The block reason, or null to let the stop through. Pure.
 * @param {{completions?: object[], deliveryReport?: object|null, sessionId?: string, stopHookActive?: boolean}} input
 */
export function shouldBlockStop({ completions = [], deliveryReport = null, sessionId, stopHookActive } = {}) {
  if (stopHookActive === true) return null;
  const open = openCompletionRecords(completions, sessionId);
  const commands = open.map((r) =>
    `node scripts/operations/completion-cli.mjs report --session=${r.session} --status=done --outcome=<outcome>`);
  if (deliveryReport?.status === 'started') {
    commands.push(`node scripts/operations/delivery-report-cli.mjs report --session=${deliveryReport.session} --status=done --outcome=<done|blocked|needs-human-judgment>`);
  }
  if (!commands.length) return null;
  return `Your completion record is still \`started\`, so the conveyor reads this session as live and nothing downstream moves. Report your outcome before you end the turn — the outcome your brief names for where you stopped (a blocked or escalated stop is an outcome too):\n  ${commands.join('\n  ')}`;
}

/** Every completion record on disk; a corrupt one is skipped, never fatal. */
export function readCompletions(dir = resolveCompletionsDir()) {
  const out = [];
  for (const session of listCompletionSessions(dir)) {
    try {
      const record = tryReadCompletion(session, dir);
      if (record) out.push(record);
    } catch { /* a torn record is the reaper's problem, not a reason to wedge a stop */ }
  }
  return out;
}

const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'));
    if (event.hook_event_name !== 'Stop' || event.stop_hook_active === true) process.exit(0);
    const sessionId = event.session_id || process.env.CLAUDE_CODE_SESSION_ID;
    let deliveryReport = null;
    if (process.env.DELIVERY_SESSION) {
      try { deliveryReport = tryReadDeliveryReport(process.env.DELIVERY_SESSION, resolveDeliveryReportsDir()); } catch { /* fail open */ }
    }
    const reason = shouldBlockStop({ completions: readCompletions(), deliveryReport, sessionId, stopHookActive: event.stop_hook_active });
    if (reason) {
      console.log(JSON.stringify({ decision: 'block', reason }));
      console.error(reason);
      process.exitCode = 2;
    }
  } catch {
    process.exitCode = 0;
  }
}
