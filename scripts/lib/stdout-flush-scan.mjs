/**
 * stdout-flush-scan.mjs — the gate behind `scripts/lib/write-all-sync.mjs` (#3061).
 *
 * THE DEFECT IT CATCHES. `process.stdout.write` (and `console.log`) to a PIPE is ASYNCHRONOUS in Node once the
 * payload passes the pipe buffer; `process.exit()` tears the process down without waiting, so the tail is
 * dropped — silently, with a zero exit status and no error anywhere. A TTY or a redirect to a real file is
 * synchronous and wins the race, which is why this is invisible in manual use and only bites when a parent
 * CAPTURES stdout. Measured on macOS: `execFileSync` delivered 8 192 bytes of a 1 741 141-byte payload.
 *
 * WHY A GATE AND NOT A COMMENT (memory rule #51 — script-decidable ⇒ hook). Five separate files had grown
 * near-identical prose about the pipe buffer, and the drain loop had been copy-pasted into three — five local
 * rediscoveries, never a rule — while eight live CLIs still carried the bug, four of them losing over 99 % of
 * their payload, including the repo health gate itself. The failure mode is a SILENT truncation with exit 0, so
 * no test that redirects to a file and no human running it in a terminal can ever see it. It is a pure
 * source-pattern question, so it is a scan.
 *
 * ── THE THREE SHAPES ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Each of these was found live during the #3061 sweep, and the first cut of this scan — "a stdout write within
 * three lines of a `process.exit`" — caught only the first, missing two of the eight MEASURED instances:
 *
 *   `emit-then-exit`  A stdout write of an UNBOUNDED payload, then a `process.exit(` within `WINDOW` lines.
 *                     The textbook shape (`we:scripts/review-core-cli.mjs`, every subcommand).
 *
 *   `emit-then-exit-fn`  The same, but the exit is reached through a LOCAL helper that exits
 *                     (`we:scripts/review-runner.mjs`'s `exit(holding, owner, 0)`,
 *                     `we:scripts/review-core-cli.mjs`'s `fail()`). Helper names are resolved per file, so no
 *                     name is hardcoded: any local function whose body contains `process.exit(` counts as one.
 *
 *   `exit-wraps-call`  `process.exit(main(argv))` — the exit is nowhere near a write, but it discards the drain
 *                     for EVERY byte the callee wrote. `we:scripts/readiness/velocity-metrics.mjs` (644 635 B →
 *                     8 192) and `we:scripts/progress-board.mjs` (25 142 → 8 192) both died this way, and the
 *                     window rule cannot see it at any window size.
 *
 * ── WHAT COUNTS AS AN UNBOUNDED PAYLOAD ──────────────────────────────────────────────────────────────────────
 *
 * A `process.stdout.write(…)` whose argument is not a PLAIN STRING LITERAL — i.e. a `JSON.stringify`, an
 * identifier, a call, or any interpolation. A literal banner is bounded by construction and never truncates, so
 * flagging it would be pure noise.
 *
 * `console.log` is included ONLY in its `JSON.stringify` form, and that boundary is deliberate. A single big
 * serialized write truncates DETERMINISTICALLY at the buffer, every time, and three of the eight measured
 * instances were exactly `console.log(JSON.stringify(…)); process.exit(0)`
 * (`we:scripts/propose-readiness.mjs`, `we:scripts/check-readiness.mjs`,
 * `we:scripts/conveyor/learnings-harvest.mjs`) — so excluding `console.log` outright would have missed them. A
 * `console.log` LOOP of small human lines is a different animal: it drains between writes and usually
 * completes, so it truncates RACILY rather than deterministically. Real, but not script-decidable from one
 * line, and flagging every human summary line before an exit would bury the rule. Its fix is remedy (a) below.
 *
 * ── THE FIX, WHICH IS PER-SITE ───────────────────────────────────────────────────────────────────────────────
 *
 *   (a) `process.exitCode = N` and RETURN — no `process.exit` at all; Node exits once stdout drains. Correct
 *       when the exit is the LAST thing that runs, and the ONLY remedy that also repairs a `console.log`-loop
 *       human mode. `exit-wraps-call` always takes this one.
 *   (b) `writeAllSync(1, chunk)` / `writeLineSync(1, line)` from `we:scripts/lib/write-all-sync.mjs`, KEEPING
 *       the `process.exit`. REQUIRED where the exit is a GUARD that must halt in place — swapping such a site
 *       to (a) would let the code after the guard keep running.
 *
 * `process.stderr.write` is already synchronous in Node, so an exit after one needs neither and is not flagged.
 *
 * ── EXEMPTIONS ───────────────────────────────────────────────────────────────────────────────────────────────
 *
 *  - `__tests__/` — a test spawns tiny stub children (a fake `gh`, a two-line fixture CLI) whose whole payload
 *    is a few hundred bytes, and a test file cannot be the runtime home a CLI imports. Same carve-out the
 *    sibling drain-home guard in `we:scripts/__tests__/stdout-flush.test.mjs` takes.
 *  - COMMENT LINES are blanked before scanning. This module and `we:scripts/lib/write-all-sync.mjs` both have
 *    to NAME `process.exit(` to explain the footgun; without this the rule flags its own documentation.
 *
 * There is no per-site opt-out comment, and that is deliberate: unlike a UTC-anchored date, there is no case
 * where the async write is the RIGHT answer before an exit — remedy (b) is byte-transparent, so the "my payload
 * is small" argument buys nothing but the next silent truncation when the payload grows. `we:scripts/conveyor/
 * jury-tree.mjs` sat at 7 865 of 8 192 bytes and would have begun truncating with no code change at all.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** How far after a stdout write a `process.exit` still counts as "right after it". */
export const WINDOW = 10;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '_site', 'coverage', '__tests__']);

/** A stdout write — the raw form. Its ARGUMENT decides whether it is bounded. */
const RAW_WRITE = /process\.stdout\.write\s*\(/;
/** `process.stdout.write('a plain literal')` — bounded by construction, never flagged. */
const LITERAL_ARG = /process\.stdout\.write\s*\(\s*(?:'[^'\\]*'|"[^"\\]*"|`[^`${\\]*`)\s*\)/;
/** The deterministic `console.log` form: one big serialized payload. */
const LOG_JSON = /console\.log\s*\([^)]*JSON\.stringify/;
const EXIT = /process\.exit\s*\(/;
/** `process.exit(someCall(…))` — discards the drain for everything the callee wrote. */
const EXIT_WRAPS_CALL = /process\.exit\s*\(\s*[A-Za-z_$][\w$]*\s*\(/;
/** Declarations whose body may hold a `process.exit` — `function f(`, `const f = (`, `const f = function`. */
const DECL = /(?:^|[^.\w$])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|[^.\w$])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function\b)/;

/**
 * Blank comments and the CONTENTS of every string/template/regex literal, preserving line count and every
 * brace that is real CODE. Brace depth is what bounds a function body, and a lone `{` inside a message string
 * would otherwise throw the whole extent off — the same class of defect as counting `process.exit(` inside a
 * doc comment. Template `${…}` holes stay open, because the expression inside one IS code.
 * @param {string} src
 * @returns {string[]} one entry per source line, code only
 */
/** Keywords after which a `/` opens a regex rather than dividing. */
const REGEX_PRECEDING_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await']);

/**
 * Is the `/` at the write head starting a REGEX (a value position) rather than dividing? Decided from the code
 * emitted so far: after an identifier, a number, `)`, `]` or a closing quote a `/` divides; everywhere else it
 * opens a literal.
 * @param {string} emitted  code produced so far (literals already blanked)
 * @returns {boolean}
 */
function startsRegex(emitted) {
  const t = emitted.replace(/\s+$/, '');
  if (!t) return true;
  const last = t.at(-1);
  if (/[)\]'"`]/.test(last)) return false;
  if (/[\w$]/.test(last)) {
    const word = /[A-Za-z_$][\w$]*$/.exec(t);
    return !!word && REGEX_PRECEDING_KEYWORDS.has(word[0]);
  }
  return true;
}

export function stripLiterals(src) {
  let out = '';
  // Context stack. `'tpl'` = inside template TEXT; `{hole: n}` = inside a `${…}` expression with `n` plain
  // braces still open. The hole's own `}` is only the one that closes it at depth 0 — the first cut popped on
  // the FIRST `}`, so `` `${JSON.stringify({ error: msg })}` `` left one brace permanently open and every
  // function extent after it collapsed (review-runner.mjs's `main` vanished entirely).
  /** @type {Array<'tpl'|{hole: number}>} */ const stack = [];
  let i = 0;
  const n = src.length;
  const keep = (c) => { out += c; };
  const blank = (c) => { out += c === '\n' ? '\n' : ' '; };
  const inTemplateText = () => stack.at(-1) === 'tpl';
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (inTemplateText()) {
      if (c === '`') { stack.pop(); keep(c); i++; continue; }
      if (c === '$' && c2 === '{') { stack.push({ hole: 0 }); keep(src[i++]); keep(src[i++]); continue; }
      if (c === '\\') { blank(src[i++]); if (i < n) blank(src[i++]); continue; }
      blank(src[i++]);
      continue;
    }
    // ── code context (module scope, or inside a `${…}` hole) ──
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') blank(src[i++]); continue; }
    if (c === '/' && c2 === '*') {
      blank(src[i++]); blank(src[i++]);
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) blank(src[i++]);
      if (i < n) { blank(src[i++]); blank(src[i++]); }
      continue;
    }
    if (c === "'" || c === '"') {
      keep(c); i++;
      while (i < n && src[i] !== c) { if (src[i] === '\\') blank(src[i++]); if (i < n) blank(src[i++]); }
      if (i < n) keep(src[i++]);
      continue;
    }
    // A REGEX LITERAL, which must be blanked like any other literal: `.replace(/[&<>"']/g, …)` in
    // progress-board.mjs carries an unpaired `"` and an unpaired `'`, and reading those as string delimiters
    // desynchronised the scanner for the remaining 1 100 lines — the file's `process.exit(main())` was blanked
    // and the rule reported it clean. `/` is a regex only where a VALUE may start; after an identifier, a
    // number, `)` or `]` it is division.
    if (c === '/' && startsRegex(out)) {
      keep(c); i++;
      let inClass = false;
      while (i < n) {
        const d = src[i];
        if (d === '\\') { blank(src[i++]); if (i < n) blank(src[i++]); continue; }
        if (d === '\n') break; // unterminated — bail rather than eat the rest of the file
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { keep(src[i++]); break; }
        blank(src[i++]);
      }
      continue;
    }
    if (c === '`') { stack.push('tpl'); keep(c); i++; continue; }
    const top = stack.at(-1);
    if (top && typeof top === 'object') {
      if (c === '{') { top.hole++; keep(c); i++; continue; }
      if (c === '}') {
        if (top.hole > 0) { top.hole--; keep(c); i++; continue; }
        stack.pop(); keep(c); i++; continue; // the `}` that closes the hole
      }
    }
    keep(c); i++;
  }
  return out.split('\n');
}

/**
 * Every function's extent, by brace depth over the literal-stripped source. Innermost-last, so a scan can pick
 * the closest enclosing one.
 * @param {string[]} lines
 * @returns {Array<{name: string, start: number, end: number}>}
 */
export function functionExtents(lines) {
  const extents = [];
  for (let i = 0; i < lines.length; i++) {
    const m = DECL.exec(lines[i]);
    if (!m) continue;
    const name = m[1] || m[2];
    // Walk to the body's opening brace, then to the matching close. An EXPRESSION-bodied arrow
    // (`const log = (m) => process.stderr.write(m);`) has no brace body, and the first cut kept scanning until
    // it found ANY `{` — which was the next function's, so `log` inherited that function's `process.exit` and
    // every call to `log(` read as an exit. The `;` that ends the statement stops the search.
    let depth = 0, seen = false, end = -1;
    for (let j = i; j < lines.length && !seen; j++) {
      // Only the tail of the declaration line counts; a `;` earlier on it belongs to a previous statement.
      const text = j === i ? lines[j].slice(m.index) : lines[j];
      for (const ch of text) {
        if (ch === '{') { depth++; seen = true; break; }
        if (ch === ';') { j = lines.length; break; } // expression body — no extent
      }
    }
    if (!seen) continue;
    // Re-walk from the declaration counting both directions to find the matching close.
    depth = 0; seen = false;
    for (let j = i; j < lines.length; j++) {
      const text = j === i ? lines[j].slice(m.index) : lines[j];
      for (const ch of text) {
        if (ch === '{') { depth++; seen = true; }
        else if (ch === '}') { depth--; }
      }
      if (seen && depth <= 0) { end = j; break; }
    }
    if (end >= 0) extents.push({ name, start: i, end });
  }
  return extents;
}

/**
 * Names of local functions that exit the process — so `return exit(holding, owner, 0)` is recognised as an
 * exit. Resolved per FILE rather than hardcoded: `fail`, `die`, `emit` and `exit` all appear in this repo under
 * different names, and a hardcoded list is the kind that rots.
 * @param {string[]} lines
 * @param {ReturnType<typeof functionExtents>} [extents]
 * @returns {Set<string>}
 */
export function exitingFunctionNames(lines, extents = functionExtents(lines)) {
  const names = new Set();
  for (const ex of extents) {
    for (let i = ex.start; i <= ex.end; i++) if (EXIT.test(lines[i])) { names.add(ex.name); break; }
  }
  return names;
}

/**
 * Scan one source file for the three shapes. Pure — takes the text, returns findings.
 * @param {string} src
 * @returns {Array<{line: number, kind: string, text: string}>}
 */
export function findStdoutFlushViolations(src) {
  const lines = stripLiterals(src);
  const raw = src.split('\n');
  const extents = functionExtents(lines);
  const exitFns = exitingFunctionNames(lines, extents);
  const out = [];

  /** The innermost function containing `i`, or null at module scope. */
  const enclosing = (i) => {
    let best = null;
    for (const ex of extents) {
      if (ex.start <= i && i <= ex.end && (!best || ex.start > best.start)) best = ex;
    }
    return best;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // Shape 3 — `process.exit(main(argv))`. Reported on its own line; there is no write to point at.
    if (EXIT_WRAPS_CALL.test(l)) {
      out.push({ line: i + 1, kind: 'exit-wraps-call', text: raw[i].trim().slice(0, 120) });
      continue;
    }

    const unbounded = (RAW_WRITE.test(l) && !LITERAL_ARG.test(l)) || LOG_JSON.test(l);
    if (!unbounded) continue;

    // The scan STOPS at the end of the enclosing function. A `process.exit` in the NEXT function is not an
    // exit this write can reach, and a flat window that walks into one reports the neighbour's code as this
    // one's bug (`lane-pool.mjs`'s `cmdList` was flagged for `cmdPath`'s guard six lines later).
    const fn = enclosing(i);
    // A call to the enclosing function itself is the module's own entrypoint invocation, not an exit path
    // reachable AFTER this write (`test-selection.mjs`'s `if (IS_CLI) runCli(argv)` sits below its own writes).
    const callable = [...exitFns].filter((nm) => nm !== fn?.name);
    const exitFnCall = callable.length
      ? new RegExp(`\\b(?:${callable.map((nm) => nm.replace(/[$]/g, '\\$')).join('|')})\\s*\\(`)
      : null;
    const last = Math.min(fn ? fn.end : lines.length - 1, i + WINDOW);

    for (let j = i; j <= last; j++) {
      if (EXIT.test(lines[j])) { out.push({ line: i + 1, kind: 'emit-then-exit', text: raw[i].trim().slice(0, 120) }); break; }
      if (exitFnCall && exitFnCall.test(lines[j])) {
        out.push({ line: i + 1, kind: 'emit-then-exit-fn', text: raw[i].trim().slice(0, 120) });
        break;
      }
    }
  }
  return out;
}

/**
 * Walk `dirs` (relative to `root`) and return every violation, each attributed with its own file + line so the
 * gate can scope it (#952/#1389/#1144 — an unattributed finding reds a session on a file it never touched).
 * @param {string} root
 * @param {string[]} dirs
 * @returns {Array<{file: string, line: number, kind: string, text: string}>}
 */
export function scanStdoutFlush(root, dirs = ['scripts', 'skills-src']) {
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name)) files.push(p);
    }
  };
  for (const d of dirs) {
    const abs = join(root, d);
    try { if (statSync(abs).isDirectory()) walk(abs); } catch { /* absent tree — nothing to scan */ }
  }
  const hits = [];
  for (const f of files.sort()) {
    for (const v of findStdoutFlushViolations(readFileSync(f, 'utf8'))) {
      hits.push({ file: relative(root, f), ...v });
    }
  }
  return hits;
}

/**
 * The operator-facing message. Names the shape AND its remedy, because the two remedies are not
 * interchangeable and picking the wrong one is a second bug (#3061).
 * @param {{file: string, line: number, kind: string, text: string}} hit
 * @returns {string}
 */
export function stdoutFlushMessage(hit) {
  const remedy = hit.kind === 'exit-wraps-call'
    ? 'use `process.exitCode = <call>` instead — `process.exit(<call>)` discards the flush for everything the callee wrote'
    : 'drain it: `writeAllSync(1, chunk)` / `writeLineSync(1, line)` from scripts/lib/write-all-sync.mjs (keeps the exit, for a guard that must halt in place), '
      + 'or drop the `process.exit` for `process.exitCode = N` + return (when the exit is the last thing that runs)';
  return `${hit.file}:${hit.line} — stdout write can be TRUNCATED by the following process.exit [${hit.kind}]: ${remedy}. See scripts/lib/write-all-sync.mjs.`;
}
