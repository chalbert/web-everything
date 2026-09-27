#!/usr/bin/env node
/**
 * @file scripts/daemon-edge.mjs
 * @description CLI for the `daemon-edge` integration branch (slice 1, epic we:backlog/x59tqsg). The logic lives in
 *   `scripts/lib/daemon-edge.mjs`; this file only parses flags and prints.
 *
 * USAGE:
 *   node scripts/daemon-edge.mjs register --pr=N --ref=<branch> [--remote=<url>] [--force] [--dry-run] [--reason=..] [--by=..] [--json]
 *   node scripts/daemon-edge.mjs tick     [--remote=<url>] [--dry-run] [--json]
 *   node scripts/daemon-edge.mjs status   [--json]
 *
 * `register` and `tick` need `WE_DAEMON_EDGE=1` unless `--dry-run` (flag OFF by default: nothing is written or
 * pushed). `--remote` defaults to this checkout's `origin` url. Exit codes: 2 bad usage; 1 refused/failed; 0 ok.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerPr, runEdgeTick, readEdgeLedger, edgeEnabled, edgeLedgerPath, EDGE_FLAG_ENV,
} from './lib/daemon-edge.mjs';

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

function defaultRemote() {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', timeout: 10_000 });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const asJson = !!flags.json;
  const print = (obj, line) => process.stdout.write(asJson ? `${JSON.stringify(obj)}\n` : `${line}\n`);
  const env = process.env;

  if (cmd === 'status') {
    const l = readEdgeLedger(env);
    print({ flag: edgeEnabled(env), ledger: edgeLedgerPath(env), ...l },
      `daemon-edge: flag ${EDGE_FLAG_ENV}=${edgeEnabled(env) ? 'on' : 'off'}; ${l.entries.length} entr(ies), ${l.owed.length} owed resolution(s)${l.corrupt ? ' — LEDGER CORRUPT' : ''}`);
    if (l.corrupt) process.exitCode = 1;
    return;
  }
  if (cmd !== 'register' && cmd !== 'tick') {
    process.stderr.write(`daemon-edge: expected register|tick|status, got ${JSON.stringify(cmd ?? null)}\n`);
    process.exitCode = 2;
    return;
  }
  const remoteUrl = typeof flags.remote === 'string' ? flags.remote : defaultRemote();
  if (!remoteUrl) { process.stderr.write('daemon-edge: no --remote and no origin url\n'); process.exitCode = 2; return; }
  const dryRun = !!flags['dry-run'];

  let res;
  if (cmd === 'register') {
    const pr = Number(flags.pr);
    if (!Number.isInteger(pr) || typeof flags.ref !== 'string') {
      process.stderr.write('daemon-edge: register needs --pr=<int> --ref=<branch>\n');
      process.exitCode = 2;
      return;
    }
    res = registerPr({
      pr, ref: flags.ref, remoteUrl, env, dryRun, force: !!flags.force,
      by: typeof flags.by === 'string' ? flags.by : (env.USER || null),
      reason: typeof flags.reason === 'string' ? flags.reason : null,
    });
    print(res, res.ok
      ? `daemon-edge: ${dryRun ? 'would register' : 'registered'} PR #${pr} (main: ${res.admission.main.status}, edge: ${res.admission.edge.status})`
      : `daemon-edge: register refused — ${res.reason}${res.admission ? ` (main: ${res.admission.main.status} ${JSON.stringify(res.admission.main.paths || [])})` : ''}`);
  } else {
    res = await runEdgeTick({ remoteUrl, env, dryRun, log: (m) => process.stderr.write(`${m}\n`) });
    print(res, res.ok
      ? `daemon-edge: tick ${dryRun ? '(dry run) ' : ''}edge ${String(res.startEdge).slice(0, 9)} → ${String(res.finalSha).slice(0, 9)}; ${res.decisions.filter((d) => d.action !== 'noop').length} change(s), ${res.owed.length} owed`
      : `daemon-edge: tick refused — ${res.reason}`);
  }
  if (!res.ok) process.exitCode = 1;
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  main().catch((e) => {
    process.stderr.write(`daemon-edge: fatal: ${String((e && e.message) || e)}\n`);
    process.exitCode = 1;
  });
}
