#!/usr/bin/env node
/**
 * @file check-memory.mjs — memory-management gate (backlog #1517, policy: docs/agent/memory-management.md).
 *
 * Enforces the budget on the agent's always-loaded memory index (`MEMORY.md`): it is injected into every
 * session and the harness SILENTLY TRUNCATES it over the size limit, so a bloated index drops load-bearing
 * rules with no warning. Detail belongs in the on-demand topic files; the index stays a bounded set of
 * one-line pointers.
 *
 * Two modes (mirrors lint-locus-prefix.mjs):
 *   • default (SWEEP) — `npm run check:memory`: read the memory dir, check the budget table + pointer
 *     integrity, exit 2 on any violation. Folded into close-out.
 *   • `--pre` — the PreToolUse(Edit|Write) GATE: reconstruct the PROPOSED post-edit MEMORY.md from the hook
 *     event JSON on stdin and exit 2 (deny the write) if it would breach the size / per-line budget BEFORE
 *     it lands. Fails open on a non-MEMORY.md target or an unparseable event.
 *
 * Memory dir is derived from the repo root (the per-project key is the abs path with '/' → '-'); if it
 * doesn't exist (different machine / layout) the gate is a no-op rather than a failure.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Budget — keep in sync with docs/agent/memory-management.md.
const MAX_BYTES = 22 * 1024;   // hard ceiling, headroom under the ~24.4 KB harness truncation limit
const WARN_BYTES = 20 * 1024;  // advisory
const MAX_LINE = 200;          // per index line: title + one short hook

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const PROJECT_KEY = ROOT.replace(/\//g, '-');
const MEM_DIR = join(HOME, '.claude', 'projects', PROJECT_KEY, 'memory');
const INDEX = join(MEM_DIR, 'MEMORY.md');

/** Size + per-line checks on a MEMORY.md string. Returns an array of violation strings. */
function checkBudget(content) {
  const v = [];
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_BYTES) v.push(`index is ${(bytes / 1024).toFixed(1)} KB — over the ${(MAX_BYTES / 1024)} KB budget (trim lines / right-home to platform-decisions.md / consolidate a cluster)`);
  const lines = content.split('\n');
  lines.forEach((ln, i) => {
    if (ln.length > MAX_LINE) v.push(`line ${i + 1} is ${ln.length} chars (> ${MAX_LINE}) — shorten the hook, move detail to the topic file: ${ln.slice(0, 60)}…`);
  });
  return { v, bytes };
}

// ── --pre: write-time gate on the hook event ────────────────────────────────────────────────
if (process.argv.includes('--pre')) {
  let ev;
  try { ev = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const file = ev?.tool_input?.file_path;
  if (!file || !/\/memory\/MEMORY\.md$/.test(file)) process.exit(0); // not the memory index
  const ti = ev.tool_input ?? {};
  const onDisk = existsSync(file) ? readFileSync(file, 'utf8') : '';
  let proposed;
  if (ev.tool_name === 'Write' || typeof ti.content === 'string') {
    proposed = ti.content ?? '';
  } else if (ev.tool_name === 'Edit' && typeof ti.old_string === 'string') {
    proposed = onDisk.includes(ti.old_string)
      ? (ti.replace_all ? onDisk.split(ti.old_string).join(ti.new_string ?? '') : onDisk.replace(ti.old_string, ti.new_string ?? ''))
      : (ti.new_string ?? onDisk);
  } else {
    proposed = ti.content ?? ti.new_string ?? onDisk;
  }
  const { v } = checkBudget(proposed);
  if (!v.length) process.exit(0);
  console.error(`memory-budget: this edit would breach the MEMORY.md budget (#1517; docs/agent/memory-management.md):\n  - ${v.join('\n  - ')}\nFix before saving — merge/prune an entry or move detail to the topic file.`);
  process.exit(2);
}

// ── default: full sweep ─────────────────────────────────────────────────────────────────────
if (!existsSync(MEM_DIR) || !existsSync(INDEX)) {
  console.log(`check:memory — no memory dir at ${MEM_DIR} (n/a); skipping.`);
  process.exit(0);
}

const content = readFileSync(INDEX, 'utf8');
const { v, bytes } = checkBudget(content);

// Pointer integrity: every index line → existing file; every topic file → one index line.
const linkRe = /\]\(([^)]+\.md)\)/;
const indexedFiles = new Set();
content.split('\n').forEach((ln, i) => {
  const m = ln.match(linkRe);
  if (!m) return;
  indexedFiles.add(m[1]);
  if (!existsSync(join(MEM_DIR, m[1]))) v.push(`line ${i + 1} points to a missing file: ${m[1]}`);
});
const topicFiles = readdirSync(MEM_DIR).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
const orphans = topicFiles.filter((f) => !indexedFiles.has(f));
for (const f of orphans) v.push(`topic file has no index line: ${f} (add one ≤ ${MAX_LINE} chars, or it's unreachable by recall context)`);

const lineCount = content.split('\n').filter((l) => l.trim()).length;

// Front-A watch metrics (#1880, model-usage watch #1855): corpus skew by type — a redundancy-likelihood
// signal (a type bucket far larger than the others is where dedup/right-home pressure lives).
const TYPES = ['feedback', 'project', 'user', 'reference'];
const skew = Object.fromEntries(TYPES.map((t) => [t, topicFiles.filter((f) => f.startsWith(`${t}_`) || f === `${t}.md`).length]));
const metrics = {
  indexBytes: bytes,
  indexKB: +(bytes / 1024).toFixed(1),
  budgetKB: MAX_BYTES / 1024,
  headroomBytes: MAX_BYTES - bytes,
  lineCount,
  topicFiles: topicFiles.length,
  orphanCount: orphans.length,
  orphans,
  corpusSkew: skew,
  violations: v.length,
  ok: v.length === 0,
};

// `--json` (#1880): emit the front-A metrics as one object for the watch to consume, instead of a
// sequence of greps. Still exits non-zero on a violation so it stays a usable gate.
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(v.length ? 2 : 0);
}

console.log(`check:memory — index ${(bytes / 1024).toFixed(1)} KB / ${lineCount} lines / ${topicFiles.length} topic files (budget ${MAX_BYTES / 1024} KB, ≤ ${MAX_LINE} chars/line)`);
console.log(`  corpus: ${TYPES.map((t) => `${skew[t]} ${t}`).join(' · ')}${orphans.length ? ` · ${orphans.length} orphan(s)` : ''}`);

if (v.length) {
  console.error(`\n✗ ${v.length} memory-budget violation(s) (#1517; docs/agent/memory-management.md):\n  - ${v.join('\n  - ')}`);
  process.exit(2);
}
if (bytes > WARN_BYTES) console.warn(`  ⚠ ${(bytes / 1024).toFixed(1)} KB — within budget but past the ${WARN_BYTES / 1024} KB warn line; consider right-homing a project rule.`);
console.log('✓ memory index within budget.');
process.exit(0);
