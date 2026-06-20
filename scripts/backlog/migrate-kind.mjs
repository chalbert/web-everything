#!/usr/bin/env node
/**
 * migrate-kind.mjs — one-pass, idempotent converter for the #466 ruling (#487).
 *
 * Collapses the two correlated nature axes (`type ∈ idea|issue|decision` + `workItem ∈ story|epic|task`)
 * into ONE `kind ∈ story|epic|task|decision` field, dropping both old fields. The merge rule:
 *
 *   kind = (type === 'decision') ? 'decision' : workItem
 *
 * — `decision` is the only load-bearing `type` value, so it wins; otherwise the hierarchy/sizing role
 * (`workItem`) carries the kind. `idea`/`issue` dissolve (a build is just its workItem); the old
 * fix-vs-feature signal, if ever wanted, becomes an optional `tags: [fix]` (NOT a field — #466 sub-call).
 * `size` stays a separate orthogonal field, untouched.
 *
 * IDEMPOTENT + re-runnable (the #466 Fork-2 "stop-the-world" self-defence): a file already carrying
 * `kind:` with no `type:`/`workItem:` is skipped, so a straggler born mid-window is swept by a re-run,
 * never corrupted. The new `kind:` line takes `type:`'s former position; the `workItem:` line is removed.
 *
 * Usage:  node scripts/backlog/migrate-kind.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'backlog');
const dry = process.argv.includes('--dry');

const unquote = (v) => v.trim().replace(/^['"]|['"]$/g, '').trim();

let converted = 0;
let skipped = 0;
const problems = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(DIR, file);
  const raw = readFileSync(path, 'utf8');
  if (!raw.startsWith('---\n')) { problems.push(`${file}: no frontmatter`); continue; }

  const lines = raw.split('\n');
  // Frontmatter block is lines[1 .. closing fence).
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '---\r') { close = i; break; }
  }
  if (close === -1) { problems.push(`${file}: unterminated frontmatter`); continue; }

  let typeIdx = -1;
  let workItemIdx = -1;
  let kindIdx = -1;
  for (let i = 1; i < close; i++) {
    if (/^type:\s/.test(lines[i])) typeIdx = i;
    else if (/^workItem:\s/.test(lines[i])) workItemIdx = i;
    else if (/^kind:\s/.test(lines[i])) kindIdx = i;
  }

  // Already migrated (kind present, neither old field) → skip.
  if (kindIdx !== -1 && typeIdx === -1 && workItemIdx === -1) { skipped++; continue; }
  // Nothing to migrate and no kind → malformed, leave for the gate to catch.
  if (typeIdx === -1 && workItemIdx === -1) { problems.push(`${file}: no type/workItem/kind`); continue; }

  const type = typeIdx !== -1 ? unquote(lines[typeIdx].slice(lines[typeIdx].indexOf(':') + 1)) : undefined;
  const workItem = workItemIdx !== -1 ? unquote(lines[workItemIdx].slice(lines[workItemIdx].indexOf(':') + 1)) : undefined;
  const kind = type === 'decision' ? 'decision' : workItem;
  if (!kind || !['story', 'epic', 'task', 'decision'].includes(kind)) {
    problems.push(`${file}: cannot derive kind (type=${type}, workItem=${workItem})`);
    continue;
  }

  // Write `kind:` at type's old slot (or workItem's, if no type line); drop the other old line(s).
  const anchor = typeIdx !== -1 ? typeIdx : workItemIdx;
  const drop = new Set([typeIdx, workItemIdx].filter((i) => i !== -1 && i !== anchor));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (drop.has(i)) continue;
    if (i === anchor) out.push(`kind: ${kind}`);
    else out.push(lines[i]);
  }
  const next = out.join('\n');
  if (next !== raw) {
    if (!dry) writeFileSync(path, next);
    converted++;
  }
}

console.log(`${dry ? '[dry] ' : ''}migrate-kind: ${converted} converted, ${skipped} already-migrated`);
if (problems.length) {
  console.error(`\n${problems.length} problem file(s):`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exitCode = 1;
}
