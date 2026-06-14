#!/usr/bin/env node
/*
 * audit-backlog-health.mjs — the deterministic half of the pre-flight audit.
 *
 * Catches what `check:standards` does NOT: decision-governance gaps and reference
 * drift. It is READ-ONLY — it writes one markdown report and changes no backlog item.
 * The judgment half (guiding-principle conformance, fork-existence, premise-drift)
 * is done by reading agents on top of these flags.
 *
 * Checks (per backlog item):
 *   G1  edge-gap            prose prereq ("per #N", "ruled by #N", "gated on #N", …)
 *                           that is NOT in blockedBy. Severity↑ if #N is a decision,
 *                           highest if that decision is still open.
 *   G2  ruling-after-build  a resolved idea/issue cites a `type: decision` #N that
 *                           resolved AFTER this item — built ahead of its ruling.
 *   G3  ungoverned-arch     a resolved idea/issue that graduated to an entity but
 *                           has no decision anywhere in its lineage (the plugs class:
 *                           an architectural call with no governing decision).
 *   D1  dead-file-ref       a backticked code path (…/x.ts[:NN]) that doesn't exist.
 *   D2  dangling-item-ref   a #N referenced in the body with no backlog/N-*.md.
 *   D3  stale-project       relatedProject absent from projects.json, or `concept`.
 *
 * Usage: node scripts/audit-backlog-health.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BL = join(ROOT, 'backlog');
const REPORT = join(ROOT, 'audits', 'backlog-health-audit.md');  // outside reports/ — regenerable tool output, not a /research/ deliverable
const SIBLINGS = { 'frontierui/': '../frontierui/', 'plateau-app/': '../plateau-app/' };
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|json|njk|css|html|md)(:\d+)?$/;

// ---- parse ---------------------------------------------------------------
function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {}; if (!m) return { fm, body: src };
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.*)$/); if (!mm) continue;
    let [, k, v] = mm; v = v.trim();
    if (v.startsWith('[')) fm[k] = [...v.matchAll(/"?(\d+)"?/g)].map(x => x[1]);
    else fm[k] = v.replace(/^["']|["']$/g, '');
  }
  return { fm, body: src.slice(m[0].length) };
}
const norm = s => (s == null ? s : String(parseInt(s, 10)));      // strip leading zeros: "064" -> "64"
const num = f => norm((f.match(/^(\d+)/) || [])[1]);

const files = readdirSync(BL).filter(f => /^\d+-.*\.md$/.test(f));
const items = new Map();          // id -> {id, file, type, status, fm, body}
for (const f of files) {
  const src = readFileSync(join(BL, f), 'utf8');
  const { fm, body } = parseFrontmatter(src);
  items.set(num(f), { id: num(f), file: f, fm, body, type: fm.type, status: fm.status });
}

// ---- ref extractors ------------------------------------------------------
const PROSE_PREREQ = /\b(?:per|ruled by|gated on|blocked on|blocked by|depends on|after|once|needs|requires|premise[d]? on|consumed via|builds on)\s+#?(\d{1,3})\b/gi;
const ANY_REF = /(?:#|\/backlog\/)(\d{1,3})\b/g;
const BACKTICK = /`([^`]+)`/g;

// shorthand prefixes cards use for SoT include dirs
const SHORTHAND = ['block-descriptions/', 'plug-descriptions/', 'intent-descriptions/', 'adapter-descriptions/', 'research-descriptions/', 'protocol-descriptions/'];
function fileRefs(body) {
  const out = new Set();
  for (const [, tok] of body.matchAll(BACKTICK)) {
    const t = tok.trim().split(/\s+/)[0];
    if (!t.includes('/') || !CODE_EXT.test(t)) continue;
    if (t.includes('{') || t.includes('}') || t.includes('*') || t.includes('<')) continue; // placeholders/globs
    out.add(t);
  }
  return [...out];
}
function resolveRef(p) {
  const path = p.replace(/:\d+$/, '');
  const tries = [join(ROOT, path)];
  if (path.startsWith('../')) return existsSync(join(ROOT, path));
  for (const [pre, sib] of Object.entries(SIBLINGS))
    if (path.startsWith(pre)) tries.push(join(ROOT, sib, path.slice(pre.length)));
  for (const sh of SHORTHAND) if (path.startsWith(sh)) tries.push(join(ROOT, 'src/_includes', path));
  // bare blocks//plugs//demos/ may live in the FUI reference impl
  if (/^(blocks|plugs|demos)\//.test(path)) tries.push(join(ROOT, '../frontierui', path));
  return tries.some(existsSync);
}
const isDecision = id => items.get(id)?.type === 'decision';
const resolvedBefore = (a, b) => a?.fm?.dateResolved && b?.fm?.dateResolved && a.fm.dateResolved <= b.fm.dateResolved;

// ---- project liveness ----------------------------------------------------
let projects = new Map();
try {
  const pj = JSON.parse(readFileSync(join(ROOT, 'src/_data/projects.json'), 'utf8'));
  const arr = Array.isArray(pj) ? pj : (pj.projects || Object.values(pj));
  for (const p of arr) if (p && p.id) projects.set(p.id, p.status || '?');
} catch { /* ignore */ }

// ---- run checks ----------------------------------------------------------
const flags = { G1: [], G2: [], G3: [], D1: [], D2: [], D3: [] };
for (const it of items.values()) {
  const blocked = new Set((it.fm.blockedBy || []).map(norm));
  const isExec = it.type === 'idea' || it.type === 'issue';

  // G1 edge-gap
  const prereqs = new Set([...it.body.matchAll(PROSE_PREREQ)].map(m => norm(m[1])));
  for (const p of prereqs) {
    if (p === it.id || blocked.has(p) || !items.has(p)) continue;
    const dec = isDecision(p), open = items.get(p)?.status !== 'resolved';
    flags.G1.push({ id: it.id, ref: p, decision: dec, refOpen: open,
      sev: dec && open ? 'HIGH' : dec ? 'med' : 'low', title: title(it) });
  }
  // G2 ruling-after-build — only decisions in the GOVERNING lineage (blockedBy/parent), not passing mentions
  const lineage = [...new Set([...(it.fm.blockedBy || []).map(norm), norm(it.fm.parent)].filter(Boolean))];
  if (isExec && it.status === 'resolved') {
    for (const p of lineage) {
      if (!isDecision(p)) continue;
      const d = items.get(p);
      if (d.status !== 'resolved') flags.G2.push({ id: it.id, ref: p, why: 'governing decision still open', title: title(it) });
      else if (!resolvedBefore(d, it)) flags.G2.push({ id: it.id, ref: p, why: `decision resolved ${d.fm.dateResolved} > item ${it.fm.dateResolved}`, title: title(it) });
    }
  }
  // G3 ungoverned-arch — CANDIDATE POOL (judgment confirms): graduated build with no decision in lineage
  if (isExec && it.status === 'resolved' && it.fm.graduatedTo && it.fm.graduatedTo !== 'none' && !lineage.some(isDecision))
    flags.G3.push({ id: it.id, graduatedTo: it.fm.graduatedTo, title: title(it) });
  // D1 dead-file-ref — OPEN items only (resolved items' refs are historical by design)
  if (it.status !== 'resolved')
    for (const r of fileRefs(it.body)) if (!resolveRef(r)) flags.D1.push({ id: it.id, ref: r, title: title(it) });
  // D2 dangling-item-ref — OPEN items only
  if (it.status !== 'resolved')
    for (const [, p] of it.body.matchAll(ANY_REF)) if (!items.has(norm(p))) { flags.D2.push({ id: it.id, ref: norm(p), title: title(it) }); break; }
  // D3 stale-project
  if (it.fm.relatedProject) {
    const st = projects.get(it.fm.relatedProject);
    if (st === undefined) flags.D3.push({ id: it.id, project: it.fm.relatedProject, why: 'not in projects.json', title: title(it) });
    else if (st === 'concept' && it.status !== 'resolved') flags.D3.push({ id: it.id, project: it.fm.relatedProject, why: 'project still `concept`', title: title(it) });
  }
}
function title(it) { return (it.body.match(/^#\s+(.+)$/m) || [, it.file])[1].slice(0, 70); }

// ---- report --------------------------------------------------------------
const open = [...items.values()].filter(i => i.status !== 'resolved').length;
const L = [];
L.push('# Backlog health audit — deterministic sweep', '');
L.push(`> Generated by \`scripts/audit-backlog-health.mjs\` (read-only). ${items.size} items (${open} open). The judgment layer (guiding-principle conformance) reads on top of these flags.`, '');
L.push('## Summary', '', '| Check | What it catches | Hits |', '|---|---|---|');
const desc = { G1: 'prose prereq not lifted into `blockedBy`', G2: 'resolved build cites a decision that was open/later', G3: 'graduated entity with no governing decision in lineage', D1: 'backticked code path that no longer exists', D2: 'referenced #N item that does not exist', D3: 'relatedProject missing or still `concept`' };
for (const k of Object.keys(flags)) L.push(`| **${k}** | ${desc[k]} | ${flags[k].length} |`);
L.push('');
const HI = flags.G1.filter(f => f.sev === 'HIGH');
L.push(`**Highest-priority (G1 HIGH — build references an _open decision_ with no edge): ${HI.length}**`, '');

function section(k, head, fmt) {
  L.push(`## ${k} — ${head} (${flags[k].length})`, '');
  if (!flags[k].length) { L.push('_none._', ''); return; }
  for (const f of flags[k].sort((a, b) => (a.sev === 'HIGH' ? -1 : 1) - (b.sev === 'HIGH' ? -1 : 1)).slice(0, 200))
    L.push(`- ${fmt(f)}`);
  if (flags[k].length > 200) L.push(`- …and ${flags[k].length - 200} more`);
  L.push('');
}
section('G1', 'Edge-gaps (prose prereq not in blockedBy)', f => `**#${f.id}** → #${f.ref} ${f.decision ? `(decision${f.refOpen ? ', **OPEN**' : ''})` : ''} \`${f.sev}\` — ${f.title}`);
section('G2', 'Built ahead of its ruling', f => `**#${f.id}** cites decision #${f.ref} — ${f.why} — ${f.title}`);
section('G3', 'Graduated with no governing decision', f => `**#${f.id}** → \`${f.graduatedTo}\` — ${f.title}`);
section('D1', 'Dead file references', f => `**#${f.id}** \`${f.ref}\` — ${f.title}`);
section('D2', 'Dangling item references', f => `**#${f.id}** → #${f.ref} (no such item) — ${f.title}`);
section('D3', 'Stale project references', f => `**#${f.id}** \`${f.project}\` — ${f.why} — ${f.title}`);

writeFileSync(REPORT, L.join('\n'));
if (process.argv.includes('--json')) console.log(JSON.stringify(flags, null, 2));
const tot = Object.values(flags).reduce((a, b) => a + b.length, 0);
console.log(`audit: ${items.size} items, ${tot} flags (G1=${flags.G1.length} [${HI.length} HIGH], G2=${flags.G2.length}, G3=${flags.G3.length}, D1=${flags.D1.length}, D2=${flags.D2.length}, D3=${flags.D3.length})`);
console.log(`report → ${REPORT.replace(ROOT + '/', '')}`);
