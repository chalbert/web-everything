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
 *   G1  edge-gap            a real prose prerequisite ("gated on #N", "depends on #N",
 *                           "requires #N", "builds on #N", guarded "blocked on/by #N")
 *                           that is NOT in blockedBy. Lineage ("per"/"ruled by") and
 *                           temporal ("after"/"once") verbs are excluded — they aren't
 *                           gates. Severity↑ if #N is a decision, highest if that decision
 *                           is still open; both-ends-resolved demotes to INFO.
 *   G2  ruling-after-build  a resolved idea/issue GATED ON (blockedBy) a `type: decision`
 *                           that resolved AFTER this item — built ahead of its ruling.
 *                           Build order is read from git (the commit flipping
 *                           `status: resolved`), NOT the backfillable `dateResolved`
 *                           frontmatter; items born resolved at their import commit are
 *                           undatable and skipped. `parent` (epic membership) is NOT a
 *                           gating edge, so it does not count here.
 *   G3  ungoverned-arch     a resolved idea/issue that graduated to an entity but has no
 *                           governing decision reachable — neither in its TRANSITIVE
 *                           parent/blockedBy lineage (an epic-hop up) nor cited in its
 *                           prose (a `#N` resolving to a resolved `type: decision`). The
 *                           plugs class: an architectural call with no governing decision.
 *   G4  false-prepared-fork a `type: decision` carrying `preparedDate` whose `## Fork` sections
 *                           contain prioritization/effort tells ("premature", "no second consumer",
 *                           "not broken … but", "more to build/maintain", "cheaper/expensive") — the
 *                           fork-existence test was skipped at prep, so the stamp is false. CANDIDATE:
 *                           the claim-time re-run confirms; collapsing to the #088 shape clears it.
 *   D1  dead-file-ref       a backticked code path (…/x.ts[:NN]) that doesn't exist — after
 *                           resolving slash-joined enumerations + bare suffixes against a dir
 *                           named in the same section, and suppressing paths prose marks as
 *                           absent ("no `x`"), planned ("a page at `x`"), or generated ("writes `x`").
 *   D2  dangling-item-ref   a #N referenced in the body with no backlog/N-*.md.
 *   D3  stale-project       PER PROJECT: a relatedProject absent from projects.json, or one still
 *                           `concept` despite substantial shipped work (intentionally-pending
 *                           concept projects with little resolved work are excluded).
 *
 * Usage: node scripts/audit-backlog-health.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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
// Keep only verbs that assert a real build prerequisite. Dropped (per #613): `per`/`ruled by`
// (lineage citation, not a gate) and `after`/`once` (temporal/prioritization ordering, not a
// dependency). `blocked on/by` is kept but guarded below (an adjacent #M to its left = an
// enumeration/citation, not a fresh edge). Group 1 is the verb (for the guard), group 2 the id.
const PROSE_PREREQ = /\b(gated on|blocked on|blocked by|depends on|needs|requires|premise[d]? on|consumed via|builds on)\s+#?(\d{1,3})\b/gi;
const ANY_REF = /(?:#|\/backlog\/)(\d{1,3})\b/g;
const BACKTICK = /`([^`]+)`/g;

// G4 false-prepared-fork — prioritization/effort smuggled into a `## Fork` section of a *prepared*
// decision. The checklist (backlog-workflow.md → fork-is-not-prioritization / fork-existence test)
// forbids cost/sequencing as a branch; these phrases are the tells that a "fork" is really
// "support all + a prioritization call" and the `preparedDate` stamp skipped the fork-existence test.
// CANDIDATE class (like G3): a hit is a card to re-run the test on at claim time, not a verdict.
const FORK_TELLS = [
  /\bpremature(ly)?\b/i,
  /\bsequencing,?\s+not\s+exclusion\b/i,
  /\bno\s+(?:second|other)\s+consumer\b/i,
  /\b(?:more|extra|a\s+second|another)\s+(?:to\s+)?(?:build|maintain|entry|entries|schema|feed)\b/i,
  /\bnot\s+broken\b[^.]*\bbut\b/i,        // "Not broken — … but premature/expensive"
  /\b(?:too\s+)?expensive\b/i,
  /\bcheaper\b/i,
  /\b(?:defer|deferring|carve)\b[^.]*\b(?:now|v1|for now|until)\b/i,
];

// shorthand prefixes cards use for SoT include dirs
const SHORTHAND = ['block-descriptions/', 'plug-descriptions/', 'intent-descriptions/', 'adapter-descriptions/', 'research-descriptions/', 'protocol-descriptions/'];
// a backticked token that looks like a usable code path (has a dir + known extension, no glob/placeholder)
function isPathToken(t) {
  if (!t.includes('/') || !CODE_EXT.test(t)) return false;
  if (t.includes('{') || t.includes('}') || t.includes('*') || t.includes('<')) return false;
  return true;
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

// ---- D1 precision (per #613): resolution gaps + prose suppression ---------
// A backticked path that doesn't resolve verbatim is only a *dead* ref if it also (a) isn't a
// slash-joined enumeration of real files, (b) isn't a bare suffix of a dir named in its own
// section, and (c) isn't governed by prose that marks it absent / planned / generated.

// (resolution gap 1) a slash-joined name enumeration — `blocks/intents/plugs/protocols/projects.json`
// is five real `src/_data/*.json`, not one path. True only if every segment names an existing file.
function resolvesAsEnumeration(p) {
  const segs = p.replace(/:\d+$/, '').split('/');
  if (segs.length < 3) return false;                       // need a real enumeration, not a 2-deep path
  const last = segs[segs.length - 1];
  const dot = last.lastIndexOf('.'); if (dot < 0) return false;
  const ext = last.slice(dot);                             // ".json"
  const names = [...segs.slice(0, -1), last.slice(0, dot)];
  if (names.some(n => !/^[a-z][\w-]*$/i.test(n))) return false;   // each segment a bare identifier
  return names.every(n => existsSync(join(ROOT, 'src/_data', n + ext)));
}
// (resolution gap 2) a bare suffix resolved against a directory named in the same section —
// `adapters/eslint.mjs` under a section that says `scripts/validation-normalize/knowledge.mjs`.
function resolvesAgainstDir(p, dirSet) {
  for (const d of dirSet) {
    if (p.startsWith(d)) continue;                         // already rooted there → no synthetic join
    if (resolveRef(d + p)) return true;
  }
  return false;
}
// directory prefixes named (as backticked paths or bare `dir/` tokens) inside a chunk of prose
function dirsIn(text) {
  const out = new Set();
  for (const [, tok] of text.matchAll(BACKTICK)) {
    let t = tok.trim().split(/\s+/)[0].replace(/^\.\//, '');
    if (t.includes('{') || t.includes('*') || t.includes('<')) continue;
    if (/\/$/.test(t)) { out.add(t); continue; }           // bare dir token, e.g. `frontierui/plugs/`
    if (t.includes('/') && CODE_EXT.test(t)) { const dir = t.replace(/[^/]+$/, ''); if (dir) out.add(dir); }
  }
  return out;
}
// split the body into heading-delimited sections, each carrying the dir prefixes named within it
function sectionRanges(body) {
  const heads = [0];
  for (const m of body.matchAll(/^#{1,6}\s.*$/gm)) heads.push(m.index);
  heads.push(body.length);
  const bounds = [...new Set(heads)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < bounds.length - 1; i++)
    out.push({ start: bounds[i], end: bounds[i + 1], dirs: dirsIn(body.slice(bounds[i], bounds[i + 1])) });
  return out;
}
const dirsAtOffset = (ranges, idx) => (ranges.find(r => idx >= r.start && idx < r.end) || { dirs: new Set() }).dirs;
// prose immediately to the left of the path governs it as absent / planned / generated, not claimed-existing
function suppressionReason(lead) {
  const t = lead.toLowerCase().replace(/[^\w]+$/, '');     // drop trailing whitespace/emphasis (`**`, etc.)
  if (/(?:^|\W)(?:no|not|never|without|absent|lacks?|missing|none)$/.test(t)) return 'absence';
  if (/(?:^|\W)(?:writes?|wrote|written|emits?|emitted|generates?|generated|produces?|produced|outputs?|output|renders?|rendered|dumps?)$/.test(t)) return 'generated';
  if (/(?:^|\W)(?:page|file|module|script|demo|playground|report|stylesheet|template|doc|fixture|entry|component|route)s?\s+(?:at|in|under)$/.test(t)) return 'planned';
  if (/(?:^|\W)(?:creates?|authors?|scaffolds?|builds?|adds?|introduces?|stands? up|lives? at)$/.test(t)) return 'planned';
  return null;
}
// the dead backticked code refs in an item's body, after resolution gaps + prose suppression
function deadFileRefs(it) {
  const ranges = sectionRanges(it.body);
  const dead = new Set();
  for (const m of it.body.matchAll(BACKTICK)) {
    const t = m[1].trim().split(/\s+/)[0];
    if (!isPathToken(t)) continue;
    if (resolveRef(t) || resolvesAsEnumeration(t) || resolvesAgainstDir(t, dirsAtOffset(ranges, m.index))) continue;
    if (suppressionReason(it.body.slice(Math.max(0, m.index - 60), m.index))) continue;
    dead.add(t);
  }
  return [...dead];
}

// ---- git-derived resolution dates (G2 must not trust backfilled frontmatter) ----
// `dateResolved` is hand-stamped and was bulk-backfilled for early-era items, so two
// such dates can't establish build order. Instead read *when* an item actually flipped
// to `status: resolved` from git, and treat items that were born resolved (added already
// resolved — no flip commit distinct from the add) as undatable: their date is an import
// artifact, never a real ruling timeline.
let REPO_FIRST_COMMIT = null;
try { REPO_FIRST_COMMIT = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: ROOT }).toString().trim().split('\n').pop(); } catch { /* no git */ }
const gitCache = new Map();
function gitResolvedAt(file) {            // -> { date: ISO|null, undatable: bool }
  if (gitCache.has(file)) return gitCache.get(file);
  let res = { date: null, undatable: true };
  try {
    const rel = `backlog/${file}`;
    const flip = execFileSync('git', ['log', '-1', '--format=%H|%cI', '-G', '^status:.*resolved', '--', rel], { cwd: ROOT }).toString().trim();
    const addLog = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '--', rel], { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
    const add = addLog.pop();            // earliest add commit
    if (flip) {
      const [hash, iso] = flip.split('|');
      const bornResolved = hash === add;             // added already resolved → no real flip
      const imported = add && add === REPO_FIRST_COMMIT;
      res = { date: iso, undatable: bornResolved || imported };
    }
  } catch { /* leave undatable */ }
  gitCache.set(file, res);
  return res;
}

// G3: the full governing lineage is the transitive closure over parent + blockedBy edges
// (a decision may sit an epic-hop up), not just the item's own two fields.
function transitiveLineage(it) {
  const seen = new Set();
  const stack = [...(it.fm.blockedBy || []).map(norm), norm(it.fm.parent)].filter(Boolean);
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !items.has(id)) continue;
    seen.add(id);
    const anc = items.get(id);
    for (const e of [...(anc.fm.blockedBy || []).map(norm), norm(anc.fm.parent)]) if (e) stack.push(e);
  }
  return seen;
}
// a body `#N` / `/backlog/N` that resolves to a *resolved* type:decision = a governing ruling cited in prose
function citesResolvedDecision(it) {
  for (const [, p] of it.body.matchAll(ANY_REF)) {
    const d = items.get(norm(p));
    if (d && d.type === 'decision' && d.status === 'resolved' && norm(p) !== it.id) return true;
  }
  return false;
}

// ---- project liveness ----------------------------------------------------
let projects = new Map();
try {
  const pj = JSON.parse(readFileSync(join(ROOT, 'src/_data/projects.json'), 'utf8'));
  const arr = Array.isArray(pj) ? pj : (pj.projects || Object.values(pj));
  for (const p of arr) if (p && p.id) projects.set(p.id, p.status || '?');
} catch { /* ignore */ }

// ---- run checks ----------------------------------------------------------
const flags = { G1: [], G2: [], G3: [], G4: [], D1: [], D2: [], D3: [] };
for (const it of items.values()) {
  const blocked = new Set((it.fm.blockedBy || []).map(norm));
  const isExec = it.type === 'idea' || it.type === 'issue';

  // G1 edge-gap — a real prose prerequisite (filtered verb set) not lifted into blockedBy.
  const g1seen = new Set();
  for (const m of it.body.matchAll(PROSE_PREREQ)) {
    const kw = m[1].toLowerCase(), p = norm(m[2]);
    if (p === it.id || blocked.has(p) || !items.has(p) || g1seen.has(p)) continue;
    // `blocked on/by` guard: another #M within ~40 chars to its left = a citation/enumeration
    // ("blocked by #M, #N"), already-anchored — not a fresh ungoverned edge.
    if (kw.startsWith('blocked') && /#\d{1,3}\b/.test(it.body.slice(Math.max(0, m.index - 40), m.index))) continue;
    g1seen.add(p);
    const dec = isDecision(p), open = items.get(p)?.status !== 'resolved';
    // both ends resolved → historical lineage, not a live gap: demote to INFO (suppressed from the count).
    const sev = (it.status === 'resolved' && !open) ? 'INFO' : dec && open ? 'HIGH' : dec ? 'med' : 'low';
    flags.G1.push({ id: it.id, ref: p, decision: dec, refOpen: open, sev, title: title(it) });
  }
  // G2 ruling-after-build — a resolved build GATED ON (blockedBy) a decision that resolved
  // after it. `parent` is epic membership, not a gating edge, so it is excluded. Build order
  // comes from git (the resolve-flip commit), and undatable (import-born) endpoints are skipped.
  const gatingEdges = [...new Set((it.fm.blockedBy || []).map(norm).filter(Boolean))];
  if (isExec && it.status === 'resolved') {
    for (const p of gatingEdges) {
      if (!isDecision(p)) continue;
      const d = items.get(p);
      if (d.status !== 'resolved') { flags.G2.push({ id: it.id, ref: p, why: 'governing decision still open', title: title(it) }); continue; }
      const di = gitResolvedAt(d.file), ii = gitResolvedAt(it.file);
      if (di.undatable || ii.undatable) continue;                  // import artifact — order unknowable
      if (di.date > ii.date) flags.G2.push({ id: it.id, ref: p, why: `decision resolved ${di.date.slice(0, 10)} (git) > item ${ii.date.slice(0, 10)}`, title: title(it) });
    }
  }
  // G3 ungoverned-arch — CANDIDATE POOL (judgment confirms): graduated build with no governing
  // decision reachable transitively (parent/blockedBy closure) AND none cited in its prose.
  if (isExec && it.status === 'resolved' && it.fm.graduatedTo && it.fm.graduatedTo !== 'none'
      && ![...transitiveLineage(it)].some(isDecision) && !citesResolvedDecision(it))
    flags.G3.push({ id: it.id, graduatedTo: it.fm.graduatedTo, title: title(it) });
  // G4 false-prepared-fork — a PREPARED, still-open decision whose `## Fork` sections carry
  // prioritization/effort tells (forbidden as branches). CANDIDATE: the claim-time fork-existence
  // re-run confirms; collapsing the fork to the #088 shape (invariant + supported/deferred list)
  // clears it. Resolved decisions are historical — skipped.
  if (it.type === 'decision' && it.fm.preparedDate && it.status !== 'resolved') {
    const hits = new Set();
    for (const r of sectionRanges(it.body)) {
      const head = it.body.slice(r.start, r.end).match(/^#{1,6}\s+(.*)$/m)?.[1] || '';
      if (!/^fork\b/i.test(head.trim())) continue;
      const sec = it.body.slice(r.start, r.end);
      for (const re of FORK_TELLS) { const m = sec.match(re); if (m) hits.add(m[0].replace(/[*`_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50).toLowerCase()); }
    }
    if (hits.size) flags.G4.push({ id: it.id, tells: [...hits].slice(0, 4), title: title(it) });
  }
  // D1 dead-file-ref — OPEN items only (resolved items' refs are historical by design).
  // deadFileRefs applies the #613 resolution gaps + prose suppression (absence / planned / generated).
  if (it.status !== 'resolved')
    for (const r of deadFileRefs(it)) flags.D1.push({ id: it.id, ref: r, title: title(it) });
  // D2 dangling-item-ref — OPEN items only
  if (it.status !== 'resolved')
    for (const [, p] of it.body.matchAll(ANY_REF)) if (!items.has(norm(p))) { flags.D2.push({ id: it.id, ref: norm(p), title: title(it) }); break; }
  // D3 is aggregated PER PROJECT after the loop (per #613), not per item.
}

// D3 stale-project — aggregated PER PROJECT, not per item (per #613). A `relatedProject` that is
// absent from projects.json is a dangling ref; a project still `status: concept` despite substantial
// shipped work (≥ STALE_RESOLVED_MIN resolved items) is stale drift whose status should advance. A
// concept project with little/no resolved work is *intentionally pending* (e.g. `webplugs` pending
// the #606 ruling, `webcases` too thin to graduate) and is NOT flagged — the false-positive class the
// old per-item check produced 18 of.
const STALE_RESOLVED_MIN = 5;
const projAgg = new Map();              // relatedProject -> {resolved, graduated, total}
for (const it of items.values()) {
  const rp = it.fm.relatedProject; if (!rp) continue;
  const a = projAgg.get(rp) || { resolved: 0, graduated: 0, total: 0 };
  a.total++;
  if (it.status === 'resolved') a.resolved++;
  if (it.fm.graduatedTo && it.fm.graduatedTo !== 'none') a.graduated++;
  projAgg.set(rp, a);
}
for (const [rp, a] of [...projAgg].sort((x, y) => y[1].resolved - x[1].resolved)) {
  const st = projects.get(rp);
  if (st === undefined) { flags.D3.push({ project: rp, why: 'not in projects.json (dangling project ref)', resolved: a.resolved, graduated: a.graduated }); continue; }
  if (st === 'concept' && a.resolved >= STALE_RESOLVED_MIN)
    flags.D3.push({ project: rp, why: `\`concept\` but ${a.resolved} resolved / ${a.graduated} graduated — shipped work warrants a status bump`, resolved: a.resolved, graduated: a.graduated });
}
function title(it) { return (it.body.match(/^#\s+(.+)$/m) || [, it.file])[1].slice(0, 70); }

// ---- report --------------------------------------------------------------
const open = [...items.values()].filter(i => i.status !== 'resolved').length;
const L = [];
L.push('# Backlog health audit — deterministic sweep', '');
L.push(`> Generated by \`scripts/audit-backlog-health.mjs\` (read-only). ${items.size} items (${open} open). The judgment layer (guiding-principle conformance) reads on top of these flags.`, '');
L.push('## Summary', '', '| Check | What it catches | Hits |', '|---|---|---|');
const desc = { G1: 'prose prereq not lifted into `blockedBy` (INFO = both ends resolved)', G2: 'resolved build gated on a decision that was open/later (git-dated)', G3: 'graduated entity with no governing decision (transitive lineage + prose)', G4: 'prepared decision with prioritization/effort tells in a `## Fork` (fork-existence test skipped)', D1: 'backticked code path that no longer exists', D2: 'referenced #N item that does not exist', D3: 'project missing from projects.json, or `concept` despite shipped work' };
const G1_INFO = flags.G1.filter(f => f.sev === 'INFO').length;
for (const k of Object.keys(flags)) {
  const n = flags[k].length, note = k === 'G1' && G1_INFO ? ` (${n - G1_INFO} active + ${G1_INFO} INFO)` : '';
  L.push(`| **${k}** | ${desc[k]} | ${n}${note} |`);
}
L.push('');
const HI = flags.G1.filter(f => f.sev === 'HIGH');
L.push(`**Highest-priority (G1 HIGH — build references an _open decision_ with no edge): ${HI.length}**`, '');

const SEV = { HIGH: 0, med: 1, low: 2, INFO: 3 };           // INFO sinks to the bottom
function section(k, head, fmt) {
  L.push(`## ${k} — ${head} (${flags[k].length})`, '');
  if (!flags[k].length) { L.push('_none._', ''); return; }
  for (const f of flags[k].slice().sort((a, b) => (SEV[a.sev] ?? 1) - (SEV[b.sev] ?? 1)).slice(0, 200))
    L.push(`- ${fmt(f)}`);
  if (flags[k].length > 200) L.push(`- …and ${flags[k].length - 200} more`);
  L.push('');
}
section('G1', 'Edge-gaps (prose prereq not in blockedBy)', f => `**#${f.id}** → #${f.ref} ${f.decision ? `(decision${f.refOpen ? ', **OPEN**' : ''})` : ''} \`${f.sev}\` — ${f.title}`);
section('G2', 'Built ahead of its ruling (gated on a later-ruled decision, git-dated)', f => `**#${f.id}** gated on decision #${f.ref} — ${f.why} — ${f.title}`);
section('G3', 'Graduated with no governing decision (transitive lineage + prose checked)', f => `**#${f.id}** → \`${f.graduatedTo}\` — ${f.title}`);
section('G4', 'Prepared decision with prioritization tells in a `## Fork` (re-run the fork-existence test at claim)', f => `**#${f.id}** — tells: ${f.tells.map(t => `_${t}_`).join(', ')} — ${f.title}`);
section('D1', 'Dead file references', f => `**#${f.id}** \`${f.ref}\` — ${f.title}`);
section('D2', 'Dangling item references', f => `**#${f.id}** → #${f.ref} (no such item) — ${f.title}`);
section('D3', 'Stale project references (per project)', f => `**\`${f.project}\`** — ${f.why}`);

writeFileSync(REPORT, L.join('\n'));
if (process.argv.includes('--json')) console.log(JSON.stringify(flags, null, 2));
const tot = Object.values(flags).reduce((a, b) => a + b.length, 0);
console.log(`audit: ${items.size} items, ${tot} flags (G1=${flags.G1.length} [${HI.length} HIGH, ${G1_INFO} INFO], G2=${flags.G2.length}, G3=${flags.G3.length}, G4=${flags.G4.length}, D1=${flags.D1.length}, D2=${flags.D2.length}, D3=${flags.D3.length})`);
console.log(`report → ${REPORT.replace(ROOT + '/', '')}`);
