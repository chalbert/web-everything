#!/usr/bin/env node
/**
 * @file memory-reflect.mjs — repo-local close-out reflection pass (backlog #1878, under model-usage
 * watch #1855; policy: docs/agent/memory-management.md).
 *
 * The close-out cadence beat for the memory/instruction self-improvement loop. PROPOSE-ONLY: it reads
 * the memory corpus and surfaces a consolidation checklist (skew, orphans, near-duplicate topic files,
 * index headroom) for the human/agent to act on — it NEVER writes, prunes, or edits a memory. The
 * actual reflection (capture this session's durable learnings as candidate memories) is the agent's
 * job at close; this script gives that step its metrics + dedup candidates so it isn't done blind.
 *
 * Repo-local by design (#1878 fork → option b): wired into this repo's close flow via
 * `.claude/commands/close-session.md`, so it changes only THIS project's close — never the global
 * closing-session skill (no cross-project blast radius). Reuses the #1880 metrics surface.
 *
 * Advisory only — always exits 0 (a no-op when there's no memory dir). Run: `npm run reflect`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 22 * 1024; // keep in sync with check-memory.mjs / memory-management.md
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const MEM_DIR = join(HOME, '.claude', 'projects', ROOT.replace(/\//g, '-'), 'memory');
const INDEX = join(MEM_DIR, 'MEMORY.md');

if (!existsSync(MEM_DIR) || !existsSync(INDEX)) {
  console.log(`memory-reflect — no memory dir at ${MEM_DIR} (n/a); skipping.`);
  process.exit(0);
}

const index = readFileSync(INDEX, 'utf8');
const indexBytes = Buffer.byteLength(index, 'utf8');
const indexedFiles = new Set([...index.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));
const topicFiles = readdirSync(MEM_DIR).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
const orphans = topicFiles.filter((f) => !indexedFiles.has(f));

// Per-file description (frontmatter `description:`) — the recall-relevance line; the natural dedup key.
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'not', 'no', 'by', 'as', 'at', 'be', 'it', 'its', 'via', 'vs', 'with', 'into', 'from', 'that', 'this', 'over', 'per']);
const tokenize = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)));
const descs = topicFiles.map((f) => {
  const body = readFileSync(join(MEM_DIR, f), 'utf8');
  const m = body.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return { f, toks: tokenize(m ? m[1] : f) };
});

// Near-duplicate candidates — description-token Jaccard ≥ threshold (a redundancy/consolidation signal,
// rule 3: one canonical memory per idea). Heuristic only — the human confirms a real duplicate.
const JACCARD = 0.5;
const dups = [];
for (let i = 0; i < descs.length; i++) {
  for (let j = i + 1; j < descs.length; j++) {
    const a = descs[i].toks, b = descs[j].toks;
    if (!a.size || !b.size) continue;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    const jac = inter / (a.size + b.size - inter);
    if (jac >= JACCARD) dups.push({ pair: [descs[i].f, descs[j].f], jac: +jac.toFixed(2) });
  }
}
dups.sort((x, y) => y.jac - x.jac);

const TYPES = ['feedback', 'project', 'user', 'reference'];
const skew = TYPES.map((t) => `${topicFiles.filter((f) => f.startsWith(`${t}_`) || f === `${t}.md`).length} ${t}`).join(' · ');

const ln = (s = '') => console.log(s);
ln('memory-reflect — close-out consolidation pass (#1878, propose-only — nothing is written)');
ln(`  index ${(indexBytes / 1024).toFixed(1)} KB / budget ${MAX_BYTES / 1024} KB (${((MAX_BYTES - indexBytes) / 1024).toFixed(1)} KB headroom) · ${topicFiles.length} topic files · ${skew}`);
ln();
ln('Reflect on THIS session, then propose (human disposes — apply nothing without a go):');
ln('  1. Learnings → memory: durable insight worth a feedback_/project_ memory, or a right-home into');
ln('     docs/agent/platform-decisions.md (rule 1)? Prune any memory this session disproved (rule 3).');
if (orphans.length) {
  ln(`  2. Orphans (${orphans.length}) — topic file with no index line (gate-red; recall-reachability is #1868):`);
  for (const o of orphans) ln(`       - ${o}`);
} else {
  ln('  2. Orphans: none.');
}
if (dups.length) {
  ln(`  3. Near-duplicate candidates (description overlap ≥ ${JACCARD} — verify, then consolidate per rule 3):`);
  for (const d of dups.slice(0, 12)) ln(`       - [${d.jac}] ${d.pair[0]}  ↔  ${d.pair[1]}`);
  if (dups.length > 12) ln(`       … +${dups.length - 12} more`);
} else {
  ln('  3. Near-duplicate candidates: none above threshold.');
}
ln(`  4. Index pressure: ${indexBytes > MAX_BYTES - 1024 ? 'near/at budget — right-home a project rule before adding (rule 1/4)' : 'headroom OK'}.`);
ln();
ln('  (Full metrics: `npm run check:memory -- --json`. Templates: .claude/skills/review-program/templates.md)');
process.exit(0);
