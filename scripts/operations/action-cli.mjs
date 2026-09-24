#!/usr/bin/env node
/** #3383 — Inspect, reconcile, or explicitly resolve durable actions; history is never deleted. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActionStore } from './action-store.mjs';
import { defaultGroundTruth } from './action-ground-truth.mjs';
import { reconcileActions } from './action-dispatch.mjs';
import { milliseconds } from './action-record.mjs';
import { writeLineSync } from '../lib/write-all-sync.mjs';

export async function actionCli(argv = [], { actions = createActionStore(), write = (line) => writeLineSync(1, line),
  groundTruth = defaultGroundTruth(), now = Date.now } = {}) {
  try {
    const [command, ...args] = argv;
    const flags = {};
    for (const arg of args) {
      const match = arg.match(/^--([a-z]+)(?:=(.*))?$/s);
      if (!match || Object.hasOwn(flags, match[1])) throw new Error(`Invalid argument: ${arg}`);
      flags[match[1]] = match[2] ?? true;
    }
    const allowed = { list: ['json', 'open'], settle: ['json'], resolve: ['resource', 'attempt', 'outcome', 'reason'] }[command];
    if (!allowed || Object.keys(flags).some((key) => !allowed.includes(key))
      || ['json', 'open'].some((key) => key in flags && flags[key] !== true)) throw new Error('usage: action-cli.mjs list [--json] [--open] | settle [--json] | resolve --resource=<key> --attempt=<n> --outcome=abandoned-absent|settled --reason=<text>');
    const print = (rows) => {
      if (flags.json) write(JSON.stringify(rows));
      else for (const row of rows) {
        const r = row.record ?? row;
        write(`${r.resource} attempt=${r.attempt} ${r.state} ${row.reason ?? r.outcome ?? ''}`.trim());
      }
    };
    if (command === 'list') {
      print(actions.list().filter((r) => !flags.open || r.state !== 'terminal'));
      return 0;
    }
    if (command === 'settle') {
      const results = await reconcileActions({ actions, ...groundTruth, now });
      print(results);
      return results.some((r) => !r.ok) ? 1 : 0;
    }
    if (!['abandoned-absent', 'settled'].includes(flags.outcome)) throw new Error('Unknown resolution outcome');
    if (typeof flags.resource !== 'string' || !/^\d+$/.test(String(flags.attempt ?? ''))
      || !Number.isSafeInteger(Number(flags.attempt)) || Number(flags.attempt) < 1
      || typeof flags.reason !== 'string' || !flags.reason.trim()) throw new Error('resolve requires resource, positive attempt, and a nonempty reason');
    const record = actions.read(flags.resource, Number(flags.attempt));
    if (record.state === 'terminal') throw new Error('Cannot resolve an already-terminal record');
    const result = actions.transition(record.resource, record.attempt, {
      token: record.ownerToken, rev: record.rev, from: record.state, to: 'terminal',
      patch: { outcome: flags.outcome, evidence: { ...record.evidence, operatorResolved: { reason: flags.reason, at: milliseconds(now()) } } },
    });
    if (!result.ok) throw new Error(`Resolution refused: ${result.reason}`);
    print([result]);
    return 0;
  } catch (error) {
    write(`error: ${error.message}`);
    return 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await actionCli(process.argv.slice(2));
}
