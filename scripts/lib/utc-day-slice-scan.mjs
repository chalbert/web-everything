/**
 * utc-day-slice-scan.mjs — the gate behind `scripts/lib/local-date.mjs` (#2747).
 *
 * The rule "a date-only stamp must be the OPERATOR's calendar day, never the runtime's UTC day" is only
 * as good as its enforcement: the idiom it replaces — `new Date().toISOString().slice(0, 10)` — is one
 * line, reads as obviously correct, and every existing test compares it against a clock in the same
 * frame, so a re-introduction is green everywhere. Memory rule #51: script-decidable ⇒ hook, and "is this
 * source slicing a UTC ISO string into a day" is a pure source-pattern question. So it is a scan, not a
 * paragraph of prose someone has to remember.
 *
 * Flagged: any `<expr>.toISOString().slice(0, 10)` in `scripts/**` (`.mjs` + `.cjs`).
 * Use `localToday()` (now) or `localDateString(date)` from `scripts/lib/local-date.mjs` instead.
 *
 * Two deliberate exemptions:
 *  - `__tests__/` — an independent oracle for this very behaviour has to compute the expected day WITHOUT
 *    the helper under test (the anti-self-clearing rule, docs/agent/platform-decisions.md
 *    #deterministic-oracle-clears-slice). `backlog-cli-snapshot.test.mjs` does exactly that.
 *  - an explicit `utc-day-slice-ok: <reason>` comment on the offending line itself, or in the CONTIGUOUS
 *    comment block directly above it, for a date that is UTC-anchored ARITHMETIC rather than a wall-clock
 *    read (re-projecting such a date into a local zone would shift it). The reason is required — the
 *    marker alone does not exempt.
 *
 * Not flagged: full instant timestamps (`toISOString()` with no day slice), which legitimately want UTC.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file DEFINES the pattern (its docblock quotes it), so it cannot scan itself. Keyed on the RESOLVED
// path, never the basename: a bare-name skip applied at every recursion depth silently exempts ANY
// `scripts/**/utc-day-slice-scan.mjs` — a copy, a fork, or a file deliberately given that name — with no
// artefact in the file to explain itself and no reason required (#2747 review).
const SELF = resolve(fileURLToPath(import.meta.url));

// Whole-file (not line-oriented) so a call split across lines is still caught.
const DAY_SLICE = /\.toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/g;
const OK_MARKER = /utc-day-slice-ok:[ \t]*\S/; // the reason must start on the marker's own line
const SOURCE = /\.(mjs|cjs|js)$/;

/** Recursively list source files under `dir`, skipping node_modules and `__tests__`. */
function sources(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '__tests__' || name === '__fixtures__' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (resolve(abs) === SELF) continue; // the scanner itself — by PATH, so a same-named sibling is still scanned
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) sources(abs, out);
    else if (SOURCE.test(name)) out.push(abs);
  }
  return out;
}

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/**
 * Is the day-slice on 0-based line `i` annotated by an `utc-day-slice-ok: <reason>` marker?
 *
 * The marker is BOUND to the line it annotates: it counts on that line itself, or anywhere in the
 * unbroken run of comment lines directly above it (so a marker whose reason wraps onto a second comment
 * line still exempts). It deliberately does NOT count when a non-comment line sits between the two.
 *
 * #2747 review — the first cut matched the marker anywhere in a fixed 3-line window ENDING at the hit,
 * so one justified exemption granted blanket amnesty to whatever landed on the next two source lines: a
 * genuine wall-clock stamp added just below an exempt one was skipped and `check:standards` stayed green,
 * with nothing on the offending line to show for it. That is a fail-open satisfiable by an author
 * assertion made about a different line — the exact control-channel shape this gate exists to close.
 */
function isExempt(lines, i) {
  if (OK_MARKER.test(lines[i] ?? '')) return true;
  for (let j = i - 1; j >= 0 && COMMENT_LINE.test(lines[j]); j--) {
    if (OK_MARKER.test(lines[j])) return true;
  }
  return false;
}

/**
 * Scan for raw UTC day-slices that should be operator-local stamps.
 *
 * @param {string} scriptsDir absolute path to the repo's `scripts/` directory
 * @param {string} [root] absolute repo root, for the reported relative paths
 * @returns {{ file: string, line: number, text: string }[]} one entry per offending line
 */
export function findUtcDaySlices(scriptsDir, root = join(scriptsDir, '..')) {
  const hits = [];
  for (const abs of sources(scriptsDir)) {
    const text = readFileSync(abs, 'utf8');
    const lines = text.split('\n');
    for (const match of text.matchAll(DAY_SLICE)) {
      const i = text.slice(0, match.index).split('\n').length - 1; // 0-based line of the match start
      if (isExempt(lines, i)) continue;
      hits.push({ file: relative(root, abs), line: i + 1, text: lines[i].trim() });
    }
  }
  return hits;
}

/** The error message for one hit — the same text whichever gate reports it. */
export function utcDaySliceMessage(hit) {
  return `${hit.file}:${hit.line} slices a UTC ISO string into a calendar day (\`${hit.text}\`) — that stamps `
    + 'the runtime\'s UTC day, which is a day AHEAD of a UTC-behind operator all evening (#2747). Use '
    + '`localToday()` (now) or `localDateString(date)` from `scripts/lib/local-date.mjs`. If the date is '
    + 'UTC-anchored arithmetic rather than a wall-clock read, say so with a `utc-day-slice-ok: <reason>` '
    + 'comment on or just above the line.';
}
