#!/usr/bin/env node
/**
 * scripts/prototype-tracker.mjs — the `prototype-tracker` skill's CLI: append a session-update note to epic
 * #3383's own tracker card, or render its current state to the HTML fragment the skill publishes as an
 * Artifact. Mirrors the decision-docket precedent's intended shape (`we:skills-src/decision-docket/`,
 * `we:backlog/3562`) — a pure parser (`lib/prototype-tracker-data.mjs`) + a pure renderer
 * (`lib/prototype-tracker-render.mjs`) + this thin CLI — so a session never hand-authors either the note's
 * placement or the page's markup.
 *
 * WHAT IS MECHANICAL HERE, WHAT ISN'T. Per the "hookable vs judgment" rule (#51): the note's PLACEMENT
 * (chronological append, exact heading format, one trailing newline) and the RENDER (frontmatter → badges,
 * `## Done when` → a checklist, `## Session update` entries → cards) are fully mechanical and live here. What
 * happened this session — the summary line, the body prose — is judgment and is supplied by the caller, never
 * fabricated by this script.
 *
 * Usage:
 *   node scripts/prototype-tracker.mjs append-note --summary="<one line>" [--qualifier="continued"] \
 *     [--body-file=<path>] [--date=YYYY-MM-DD]
 *     Body comes from --body-file, or stdin when that flag is omitted. Writes the tracker file in place.
 *
 *   node scripts/prototype-tracker.mjs render [--out=<path>] [--json]
 *     Renders the current tracker to an HTML fragment (stdout, or --out). --json prints the parsed struct
 *     instead (debugging / a caller that wants the data without the markup).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readTracker, appendSessionUpdate, findTrackerPath,
} from './lib/prototype-tracker-data.mjs';
import { renderTrackerHtml } from './lib/prototype-tracker-render.mjs';
import { localToday } from './lib/local-date.mjs';

function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function cmdAppendNote(flags, io) {
  const path = findTrackerPath({ backlogDir: flags['backlog-dir'] });
  if (!path) {
    io.err('prototype-tracker: no backlog/3383-*.md found — is this the web-everything repo root?\n');
    return 1;
  }
  const summary = typeof flags.summary === 'string' ? flags.summary.trim() : '';
  if (!summary) { io.err('prototype-tracker: --summary="<one line>" is required\n'); return 1; }
  const body = typeof flags['body-file'] === 'string'
    ? io.read(flags['body-file'])
    : io.stdin();
  if (!body || !body.trim()) {
    io.err('prototype-tracker: no body given — pass --body-file=<path> or pipe the note body on stdin\n');
    return 1;
  }
  const date = typeof flags.date === 'string' ? flags.date : localToday();
  const qualifier = typeof flags.qualifier === 'string' ? flags.qualifier : null;
  const before = io.read(path);
  const after = appendSessionUpdate(before, { date, qualifier, summary, body });
  io.write(path, after);
  const heading = `## Session update (${date}${qualifier ? `, ${qualifier}` : ''}) — ${summary}`;
  io.out(`prototype-tracker: appended to ${path}\n  ${heading}\n`);
  return 0;
}

function cmdRender(flags, io) {
  const found = readTracker({ backlogDir: flags['backlog-dir'] });
  if (!found) {
    io.err('prototype-tracker: no backlog/3383-*.md found — is this the web-everything repo root?\n');
    return 1;
  }
  if (flags.json) {
    io.out(`${JSON.stringify(found.data, null, 2)}\n`);
    return 0;
  }
  const html = renderTrackerHtml(found.data, {
    generatedAt: `${localToday()} (mechanically rendered)`,
    itemNumber: '3383',
    sourcePath: found.path,
  });
  if (typeof flags.out === 'string') {
    io.write(flags.out, html);
    io.out(`prototype-tracker: wrote ${flags.out} (${html.length} bytes) — publish it with the Artifact tool\n`);
  } else {
    io.out(html);
  }
  return 0;
}

export function main(argv, io = defaultIo()) {
  const [cmd, ...rest] = argv;
  const flags = parseArgs(rest);
  if (cmd === 'append-note') return cmdAppendNote(flags, io);
  if (cmd === 'render') return cmdRender(flags, io);
  io.err([
    'usage:',
    '  node scripts/prototype-tracker.mjs append-note --summary="<one line>" [--qualifier="continued"] [--body-file=<path>] [--date=YYYY-MM-DD]',
    '  node scripts/prototype-tracker.mjs render [--out=<path>] [--json]',
    '',
  ].join('\n'));
  return 1;
}

function defaultIo() {
  return {
    read: (p) => readFileSync(p, 'utf8'),
    write: (p, s) => writeFileSync(p, s, 'utf8'),
    stdin: readStdin,
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
