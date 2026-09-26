#!/usr/bin/env node
// Gap checker over the conveyor flow descriptions (#4075 step 1). Describe-only: reads *.flow.json, runs
// nothing. Rules and file shape: README.md.
//
//   node scripts/conveyor/flows/check.mjs [--dir=<dir>] [--json] [--ci] [--flow=<id>]
//
// --ci exits 1 when any finding is NOT acknowledged by a card (`ack` on the state/step). Without --ci it
// always exits 0 (a report). The CI gate itself is __tests__/real-flows.test.mjs.

import { pathToFileURL } from 'node:url';
import { loadFlows, checkFlows, FLOWS_DIR } from './flow-model.mjs';

export function runCheck({ dir = FLOWS_DIR, flow: only = null } = {}) {
  let flows = loadFlows(dir);
  const all = checkFlows(flows);
  const findings = only ? all.filter((f) => f.flow === only) : all;
  if (only) flows = flows.filter((f) => f.id === only);
  const open = findings.filter((f) => !f.acknowledged);
  return { flows: flows.map((f) => f.id), findings, open, acknowledged: findings.length - open.length };
}

export function formatReport(res) {
  const lines = [`flows: ${res.flows.join(', ')}`, `findings: ${res.findings.length} (${res.open.length} open, ${res.acknowledged} acknowledged)`, ''];
  const byFlow = new Map();
  for (const f of res.findings) {
    if (!byFlow.has(f.flow)) byFlow.set(f.flow, []);
    byFlow.get(f.flow).push(f);
  }
  for (const [flow, fs] of byFlow) {
    lines.push(`## ${flow}`);
    for (const f of fs) lines.push(`  ${f.acknowledged ? `[ack ${f.acknowledged}]` : '[OPEN]'} ${f.rule.padEnd(22)} ${f.where} — ${f.message}`);
    lines.push('');
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
  const has = (k) => process.argv.includes(`--${k}`);
  const res = runCheck({ dir: arg('dir') ?? FLOWS_DIR, flow: arg('flow') ?? null });
  process.stdout.write(has('json') ? `${JSON.stringify(res, null, 2)}\n` : `${formatReport(res)}\n`);
  if (has('ci') && res.open.length) process.exitCode = 1; // exitCode, not exit(): lets stdout drain
}
