#!/usr/bin/env node
/**
 * cli.mjs — ingest an incumbent component from a file (or stdin) into the neutral CEM
 * contract and a WE block draft (#851). The interactive paste workbench is #753's concern
 * (locus:frontierui); this is the headless substrate it round-trips through.
 *
 *   node scripts/ingest-adapter/cli.mjs <file.tsx> [--name=Button] [--prefix=we] \
 *        [--source="MUI Button"] [--emit=block|cem|surface|all]
 *   cat Button.tsx | node scripts/ingest-adapter/cli.mjs --emit=block
 */
import { readFileSync } from 'node:fs';
import { ingest } from './ingestComponent.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const file = args.find((a) => !a.startsWith('--'));
const emit = flag('emit', 'all');

let source;
try {
  source = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
} catch (err) {
  process.stderr.write(`ingest: cannot read ${file || 'stdin'} — ${err.message}\n`);
  process.exit(2);
}

let result;
try {
  result = ingest(source, {
    componentName: flag('name'),
    tagPrefix: flag('prefix', 'we'),
    source: flag('source'),
  });
} catch (err) {
  process.stderr.write(`ingest: ${err.message}\n`);
  process.exit(1);
}

const out =
  emit === 'block' ? result.block : emit === 'cem' ? result.cem : emit === 'surface' ? result.surface : result;
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

if (result.surface.dropped.length) {
  process.stderr.write(
    `\nLossy ingest — ${result.surface.dropped.length} prop(s) dropped (lossiness is the value):\n` +
      result.surface.dropped.map((d) => `  · ${d.name}: ${d.reason}`).join('\n') +
      '\n',
  );
}
