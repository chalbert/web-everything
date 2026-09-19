#!/usr/bin/env node
/**
 * Local ops probe: JSON on stdin; default prints only gate status, --preview prints
 * the exact would-be body (no trailing newline). No endpoint, persistence or network
 * send is configured here. Product transport uses sendFeedbackEntry directly.
 * node scripts/conveyor/feedback-capture.mjs [--preview] < entry.json
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { prepareFeedbackPayload, sendFeedbackEntry } from '../lib/feedback-schema.mjs';

export async function main(argv, io = {}) {
  const write = io.write ?? (text => process.stdout.write(text));
  if (argv.length > 1 || argv.some(arg => arg !== '--preview')) {
    write(JSON.stringify({ ok: false, errors: ['usage: feedback-capture.mjs [--preview] < entry.json'] }));
    return 1;
  }
  let entry;
  try { entry = JSON.parse((io.read ?? (() => readFileSync(0, 'utf8')))()); }
  catch {
    write(JSON.stringify({ ok: false, errors: ['stdin must contain a JSON object'] }));
    return 1;
  }
  const preview = argv.includes('--preview');
  const result = preview
    ? await sendFeedbackEntry(entry, { preview: true })
    : prepareFeedbackPayload(entry);
  write(preview && result.ok ? result.payload : JSON.stringify({ ok: result.ok, errors: result.errors }));
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
