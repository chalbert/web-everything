#!/usr/bin/env node
// Graph generator for the conveyor flow descriptions (#4075 step 1). Describe-only.
//
//   node scripts/conveyor/flows/graph.mjs [--dir=<dir>] [--flow=<id>] [--json] [--out=<dir>]
//
// Default: prints a Mermaid block per flow plus one combined graph to stdout.
// --json   prints { flows: [{ id, mermaid, model }], combined } instead.
// --out    writes <id>.mmd per flow + combined.mmd + flows.json into <dir> (no stdout graph).
// Red = no owner, dashed orange = wait with no bound, grey = failure end-state.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadFlows, flowToMermaid, combinedMermaid, FLOWS_DIR } from './flow-model.mjs';

export function renderGraphs({ dir = FLOWS_DIR, flow: only = null } = {}) {
  const all = loadFlows(dir);
  const flows = only ? all.filter((f) => f.id === only) : all;
  return {
    flows: flows.map(({ _file, ...model }) => ({ id: model.id, mermaid: flowToMermaid(model), model })),
    combined: combinedMermaid(all.map(({ _file, ...m }) => m)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
  const res = renderGraphs({ dir: arg('dir') ?? FLOWS_DIR, flow: arg('flow') ?? null });
  const out = arg('out');
  if (out) {
    mkdirSync(out, { recursive: true });
    for (const f of res.flows) writeFileSync(join(out, `${f.id}.mmd`), `${f.mermaid}\n`);
    writeFileSync(join(out, 'combined.mmd'), `${res.combined}\n`);
    writeFileSync(join(out, 'flows.json'), `${JSON.stringify(res.flows.map((f) => f.model), null, 2)}\n`);
    process.stdout.write(`wrote ${res.flows.length} flow graphs + combined.mmd + flows.json to ${out}\n`);
  } else if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  } else {
    for (const f of res.flows) process.stdout.write(`### ${f.id}\n\n\`\`\`mermaid\n${f.mermaid}\n\`\`\`\n\n`);
    process.stdout.write(`### combined\n\n\`\`\`mermaid\n${res.combined}\n\`\`\`\n`);
  }
}
