/**
 * learnings-grounding.mjs — the HARVEST-SIDE grounding verification for a learnings pool entry (#3016, ratified
 * #2978 Fork 1).
 *
 * THE RULE IT IMPLEMENTS. A note reaches agent memory only if it carries the QUOTED GROUNDING TURN plus a
 * TRANSCRIPT POINTER, and the harvest confirms the quote is really in that file. The check runs against a file
 * the HARNESS writes (`~/.claude/projects/<slug>/<session-id>.jsonl`), not one the emitter controls — which is
 * what makes it worth more than a recurrence count (`session`/`ts` are emitter-written; four hand-written pool
 * lines manufacture "2 sessions across 2 days"). Grounding proves the MOMENT, never the MERIT: a `verified`
 * status is necessary for memory admission, never sufficient — the red-team is still the merit check.
 *
 * WHAT COUNTS AS "IN THE TRANSCRIPT". Only the conversational text of a `user` or `assistant` record: a string
 * `message.content`, or its `{type:'text'}` blocks. Deliberately EXCLUDED:
 *   - `tool_use` blocks — the drop command itself (`learnings-drop.mjs --quoted-turn="…"`) is a tool_use input,
 *     so matching it would let every entry verify against its own emission;
 *   - `tool_result` blocks — `learnings-drop.mjs --json` echoes the appended record back, same self-match;
 *   - `thinking` blocks and harness-injected `isMeta` user records — not a turn anyone saw;
 *   - every non-message record type (`attachment`, `last-prompt`, `ai-title`, …).
 * A match reports its `role` — `human` for a user record, `assistant` otherwise — so the red-team can weigh a
 * quoted operator directive differently from an agent quoting itself.
 *
 * MATCHING. Whitespace-normalized (every run of whitespace → one space, trimmed) substring, case-SENSITIVE — a
 * quote is a quote. The WHOLE transcript is searched, not a tail window: a grounding turn can sit anywhere in a
 * long session (the bounded tail read in we:scripts/dev/active-progress-watch.mjs answers a different question).
 *
 * FAIL-SAFE, NEVER THROWS. Every way verification can go wrong resolves to `failed` with a named `reason`; an
 * entry that carries no grounding at all is `ungrounded` (the legacy shape — NOT a failure, so a pool written
 * before these fields existed never reads as a mass verification failure). Both route to `we:backlog/`, never
 * to memory.
 *
 * DESIGN: pure core (`findQuote` over transcript TEXT) + a thin reader (`verifyGrounding`, injectable `read`),
 * per we:docs/agent/platform-decisions.md #deterministic-core-thin-judgment.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const GROUNDING = Object.freeze({ VERIFIED: 'verified', FAILED: 'failed', UNGROUNDED: 'ungrounded' });

/**
 * The shortest quote (after whitespace normalization) the pool accepts. A two-word quote ("yes do it") appears in
 * almost every transcript, so it would verify without tying the note to any particular moment. Enforced at the
 * APPEND seam (validateEntry) so an unverifiable-by-construction quote never enters the pool.
 */
export const MIN_QUOTE_CHARS = 12;

/** normalizeQuote(s) → whitespace-collapsed, trimmed string. Pure. */
export function normalizeQuote(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * transcriptRoot({ env, home }) → the directory every transcript pointer must resolve inside.
 * Precedence: `$LEARNINGS_TRANSCRIPT_ROOT` (tests/relocation — mirrors `$LEARNINGS_POOL`) → `~/.claude/projects`.
 */
export function transcriptRoot({ env = process.env, home } = {}) {
  if (env && env.LEARNINGS_TRANSCRIPT_ROOT) return env.LEARNINGS_TRANSCRIPT_ROOT;
  return join(home || env?.HOME || homedir(), '.claude', 'projects');
}

/** The conversational text of ONE parsed transcript record, or null when the record is not a visible turn. */
function turnText(rec) {
  if (!rec || typeof rec !== 'object' || rec.isMeta) return null;
  if (rec.type !== 'user' && rec.type !== 'assistant') return null;
  const content = rec.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  const texts = content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text);
  return texts.length ? texts.join('\n') : null;
}

/**
 * findQuote(transcriptText, quote) → { found, role, turn } | { found: false }. PURE.
 * Scans the JSONL line-tolerantly (a torn last line from a live session never costs the rest) for the first
 * visible turn whose normalized text contains the normalized quote. `turn` is that record's `uuid` (or null).
 */
export function findQuote(transcriptText, quote) {
  const needle = normalizeQuote(quote);
  if (!needle) return { found: false };
  for (const line of String(transcriptText ?? '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let rec;
    try { rec = JSON.parse(t); } catch { continue; }
    const text = turnText(rec);
    if (text == null || !normalizeQuote(text).includes(needle)) continue;
    return { found: true, role: rec.type === 'user' ? 'human' : 'assistant', turn: typeof rec.uuid === 'string' ? rec.uuid : null };
  }
  return { found: false };
}

/** Is `abs` strictly inside `root`? Compares resolved paths on a separator boundary (`/a/bc` is not in `/a/b`). */
function isInside(abs, root) {
  const r = resolve(root);
  return abs !== r && abs.startsWith(r.endsWith(sep) ? r : r + sep);
}

function safeRealpath(p) {
  try { return realpathSync(p); } catch { return null; }
}

/**
 * verifyGrounding(entry, { read, root, env, home }) → { status, reason?, role?, turn? }. NEVER THROWS.
 *
 *   ungrounded — the entry carries neither `quotedTurn` nor `transcript` (legacy / honest no-evidence shape).
 *   failed     — reason ∈ incomplete | relative-pointer | outside-transcript-root | unreadable | quote-not-found.
 *   verified   — the quote was found in a visible turn of the pointed-at transcript; `role` + `turn` say where.
 *
 * The root check runs on the RESOLVED path (so `..` cannot climb out) and again on the realpath when the file
 * exists (so a symlink planted under the root cannot point at an emitter-written file elsewhere). `read` is
 * injectable for tests and for a per-run cache (see `cachedReader`).
 */
export function verifyGrounding(entry, { read = (p) => readFileSync(p, 'utf8'), root, env = process.env, home } = {}) {
  const quote = entry?.quotedTurn;
  const pointer = entry?.transcript;
  if (quote == null && pointer == null) return { status: GROUNDING.UNGROUNDED };
  if (typeof quote !== 'string' || !normalizeQuote(quote) || typeof pointer !== 'string' || !pointer.trim()) {
    return { status: GROUNDING.FAILED, reason: 'incomplete' };
  }
  if (!isAbsolute(pointer)) return { status: GROUNDING.FAILED, reason: 'relative-pointer' };
  const base = root || transcriptRoot({ env, home });
  const abs = resolve(pointer);
  if (!isInside(abs, base)) return { status: GROUNDING.FAILED, reason: 'outside-transcript-root' };
  const real = safeRealpath(abs);
  const realBase = safeRealpath(base);
  if (real && realBase && !isInside(real, realBase)) return { status: GROUNDING.FAILED, reason: 'outside-transcript-root' };
  let text;
  try { text = read(abs); } catch { return { status: GROUNDING.FAILED, reason: 'unreadable' }; }
  const hit = findQuote(text, quote);
  if (!hit.found) return { status: GROUNDING.FAILED, reason: 'quote-not-found' };
  return { status: GROUNDING.VERIFIED, role: hit.role, turn: hit.turn };
}

/**
 * cachedReader(read) → a `read` that opens each transcript once per harvest run. Many notes from one session
 * point at the same (often multi-MB) file; a thrown read is cached too, so a missing file is not re-stat'd N times.
 */
export function cachedReader(read = (p) => readFileSync(p, 'utf8')) {
  const cache = new Map();
  return (p) => {
    if (!cache.has(p)) {
      try { cache.set(p, { text: read(p) }); } catch (error) { cache.set(p, { error }); }
    }
    const hit = cache.get(p);
    if (hit.error) throw hit.error;
    return hit.text;
  };
}
