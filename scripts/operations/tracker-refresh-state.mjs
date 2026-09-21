#!/usr/bin/env node
/**
 * scripts/operations/tracker-refresh-state.mjs — the two commands the tracker publish worker runs around its one
 * `Artifact` call, so it never computes a hash or writes the state file by hand (brief: `tracker-refresh.mjs#buildPublishBrief`).
 *
 *   node scripts/operations/tracker-refresh-state.mjs verify --html=<page> --hash=<content hash>
 *     Exit 0 when the page's content hash (stamp ignored) is the hash the brief was made for; exit 1 when a newer
 *     render replaced the page since.
 *
 *   node scripts/operations/tracker-refresh-state.mjs record --html=<page> --url=<published url> [--id=<id>] [--state=<path>]
 *     Rewrites the state file (`artifact.json` beside the page by default) with the page's content hash, the time,
 *     the id (from --id, or the end of the url) and the url.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentHash } from '../lib/tracker-page-hash.mjs';
import { recordPublish } from './tracker-refresh-io.mjs';

function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

/** @returns {number} the exit code */
export function main(argv, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s), read: (p) => readFileSync(p, 'utf8'), now: () => new Date().toISOString() }) {
  const [cmd, ...rest] = argv;
  const flags = parseArgs(rest);
  try {
    if (cmd === 'verify') {
      if (typeof flags.html !== 'string' || typeof flags.hash !== 'string') { io.err('tracker-refresh-state: verify needs --html=<page> --hash=<hash>\n'); return 2; }
      const actual = contentHash(io.read(flags.html));
      if (actual === flags.hash) { io.out(`tracker-refresh-state: same content (${actual.slice(0, 12)})\n`); return 0; }
      io.out(`tracker-refresh-state: the page changed since the brief (brief ${flags.hash.slice(0, 12)}, page ${actual.slice(0, 12)})\n`);
      return 1;
    }
    if (cmd === 'record') {
      if (typeof flags.html !== 'string' || typeof flags.url !== 'string') { io.err('tracker-refresh-state: record needs --html=<page> --url=<url>\n'); return 2; }
      const { state, statePath } = recordPublish({ htmlPath: flags.html, url: flags.url, id: typeof flags.id === 'string' ? flags.id : '', ...(typeof flags.state === 'string' ? { statePath: flags.state } : {}), now: io.now, read: io.read });
      io.out(`tracker-refresh-state: recorded ${state.url} (id ${state.id}, content ${state.lastPublishedHash.slice(0, 12)}, ${state.lastPublishedAt}) in ${statePath}\n`);
      return 0;
    }
  } catch (e) {
    io.err(`${String(e.message ?? e)}\n`);
    return 1;
  }
  io.err('usage:\n  tracker-refresh-state.mjs verify --html=<page> --hash=<hash>\n  tracker-refresh-state.mjs record --html=<page> --url=<url> [--id=<id>] [--state=<path>]\n');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
