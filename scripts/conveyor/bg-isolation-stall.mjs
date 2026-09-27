/**
 * @file scripts/conveyor/bg-isolation-stall.mjs
 * @description #x9fbg1x — a SIXTH, more specific fact layered on top of `reconcile-core.mjs#isAwaitingPermission`
 *   (the fifth state: `status:'waiting'` + a `waitingFor` naming a permission prompt). That check alone cannot
 *   tell "genuinely needs a human to approve something risky" apart from "stuck on Claude Code's own
 *   background-session worktree-isolation guard" — the SAME message that stalled `fix-2748`/`fix-2770` live
 *   (2026-09-26) and recurs across dozens of transcripts since 2026-08-29. The distinguishing evidence is not
 *   on the `claude agents --json` row at all (its `waitingFor` is a generic permission-prompt label) — it is
 *   in the session's OWN transcript, whose newest `tool_result` carries the guard's exact refusal text ("This
 *   background session hasn't isolated its changes yet. Call EnterWorktree first…").
 *
 *   MODELED DIRECTLY ON `we:scripts/conveyor/hung-session.mjs` — same `resolveSessionTranscript` reuse, same
 *   bounded tail read (`skills-src/inspect-agent-health/agent-health.mjs#tailLines`/`summarizeEntry`), same
 *   "any read failure ⇒ no signal, never a guess" contract — so a session correctly waiting on a genuine human
 *   decision is never mislabeled, and a session stuck on this SPECIFIC, product-fixable guard is named
 *   precisely instead of falling into the same generic bucket as everything else that can block an agent.
 *
 *   THIS NEVER DISPATCHES ANYTHING ON ITS OWN. It only attaches a clearer reason
 *   (`bgIsolationStall: true`, via `we:scripts/conveyor/reconcile-core.mjs#markBgIsolationStalls`) to a row
 *   `assessLiveness` already reports as `awaiting-permission` — the actual fix is
 *   `we:scripts/lib/dispatch-bg-isolation.mjs`, which stops the stall from happening at all for every
 *   dispatched session and lane clone; this module exists for whatever still gets stuck (a host that has not
 *   yet picked up the fix, an operator's own manually-started background session outside the dispatch path)
 *   and for the historical record — 43+ prior transcripts this incident cites had no way to be told apart
 *   from an ordinary, genuinely-needs-a-human permission block until now.
 */
import { resolveSessionTranscript } from '../operations/agent-usage-report.mjs';
import { tailLines, summarizeEntry } from '../../skills-src/inspect-agent-health/agent-health.mjs';

/**
 * The guard's own refusal text, matched loosely so a CLI wording tweak does not silently stop matching —
 * every clause is distinctive enough alone that a false positive is not a real risk (no ordinary tool_result
 * otherwise mentions "EnterWorktree" or "bgIsolation").
 */
export const BG_ISOLATION_STALL_SIGNATURE = /EnterWorktree|hasn't isolated its changes|bgIsolation/i;

// Bounded read — never the whole file. Mirrors `hung-session.mjs`'s own ceilings; the field cap is wider here
// (the guard's own sentence is longer than most tool_result snippets that module cares about).
const READ_TAIL_LINES = 15;
const READ_MAX_BYTES = 400_000;
const READ_FIELD_MAX = 400;

/**
 * PURE: does this bounded set of already-summarized transcript entries ({@link summarizeEntry} shape) show
 * the EnterWorktree/bgIsolation guard's own refusal text in a `tool_result` block?
 * @param {Array<{blocks?:Array<object>}>} entries
 * @returns {{stall:boolean, evidence:string|null}}
 */
export function classifyBgIsolationStall(entries) {
  for (const e of Array.isArray(entries) ? entries : []) {
    for (const b of e?.blocks || []) {
      if (b?.kind !== 'tool_result') continue;
      const text = String(b.content || '');
      if (BG_ISOLATION_STALL_SIGNATURE.test(text)) return { stall: true, evidence: text };
    }
  }
  return { stall: false, evidence: null };
}

/**
 * IO SHELL — resolves `agent`'s own transcript (never another session's), reads a bounded tail, and asks
 * {@link classifyBgIsolationStall} whether it shows the guard's own refusal text. NEVER THROWS: a missing
 * `cwd`/`sessionId`, an unresolvable transcript, or any read failure answers `{stall:false, reason:'no-signal'}`
 * — absence of a transcript is never evidence of this specific stall, mirroring
 * `hung-session.mjs#readHungInfo`'s own discipline exactly.
 * @param {{cwd?:string, sessionId?:string}} agent
 * @returns {{stall:boolean, reason:string, evidence:string|null}}
 */
export function readBgIsolationStallInfo(agent) {
  const cwd = agent?.cwd, sessionId = agent?.sessionId;
  if (!cwd || !sessionId) return { stall: false, reason: 'no-signal', evidence: null };
  let file;
  try {
    file = resolveSessionTranscript({ session: String(sessionId), cwd: String(cwd) });
  } catch {
    return { stall: false, reason: 'no-signal', evidence: null }; // no transcript found — never guess
  }
  let entries;
  try {
    const { lines } = tailLines(file, READ_TAIL_LINES, READ_MAX_BYTES);
    entries = lines.map((l) => summarizeEntry(l, READ_FIELD_MAX));
  } catch {
    return { stall: false, reason: 'no-signal', evidence: null }; // unreadable transcript — never guess
  }
  const { stall, evidence } = classifyBgIsolationStall(entries);
  return stall
    ? { stall: true, reason: 'EnterWorktree/bgIsolation guard refusal seen in transcript tail', evidence }
    : { stall: false, reason: 'no-signal', evidence: null };
}
