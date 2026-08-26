#!/usr/bin/env node
/**
 * @file scripts/review-corpus/replay-gates.mjs
 * @description Phase 1 of the review experiment: replay the candidate gates against every mined case and
 * score them against what the real reviews actually found. No juror, no model, no network — the whole
 * run is `git show` reads at pinned revisions, so it is deterministic and free.
 *
 * WHAT IS BEING MEASURED, and what each number can and cannot support:
 *
 *   HIT      a labelled finding that some gate flags at the same file within +/-`--tol` lines.
 *            This is the only sound recall measure in the corpus.
 *   MISS     a labelled finding no gate flags. Sound.
 *   EXTRA    a gate hit with no labelled finding at that place. This is NOT a false-positive count.
 *            The labels are what reviewers happened to notice, not ground truth, so an extra is either
 *            a false positive or a real defect nobody looked for. It is reported as a number to
 *            ADJUDICATE, never as a number to divide by — `--sample-extras` prints a sample to read.
 *
 * CONTAMINATION. The replay reads file contents at the case's own `head` via `git show`, and never
 * looks at a later commit, the PR comments, or the network. A gate therefore cannot see the finding it
 * is being scored against.
 *
 * Usage:
 *   node scripts/review-corpus/replay-gates.mjs [--cases=scripts/review-corpus/cases] [--tol=3]
 *                                               [--sample-extras=10] [--gate=<name>] [--json]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATES, runGates } from './gates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/* ------------------------------------------------------------------ pinned-revision reader */

/**
 * A file reader bound to ONE commit. Everything the gates see comes through here, which is what keeps
 * the replay honest: there is no path from a gate to a later revision or to the review that found the
 * defect. Reads are memoised per revision because several gates read the same card.
 */
export function revisionReader(sha, { cwd = ROOT } = {}) {
  const cache = new Map();
  const read = (path) => {
    if (cache.has(path)) return cache.get(path);
    let out = null;
    try {
      out = execFileSync('git', ['show', `${sha}:${path}`], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    } catch { out = null; }
    cache.set(path, out);
    return out;
  };
  let treeCache = null;
  const tree = () => {
    if (treeCache) return treeCache;
    try {
      treeCache = execFileSync('git', ['ls-tree', '-r', '--name-only', sha], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
    } catch { treeCache = []; }
    return treeCache;
  };
  const list = (prefix) => tree().filter((p) => p.startsWith(prefix));
  list.read = read;

  // Every hash id that resolves at this revision: the `xNNNNNN-` filename form, plus the `bornAs:` a
  // card keeps after it is JIT-numbered. Collected with ONE `git grep` over the revision rather than a
  // `git show` per card — the naive form is ~1000 subprocesses per case and takes the replay from
  // seconds to hours.
  let hashCache = null;
  const knownHashIds = () => {
    if (hashCache) return hashCache;
    const ids = new Set();
    for (const p of list('backlog/')) {
      const m = p.split('/').pop().match(/^(x[0-9a-z]{6,7})-/);
      if (m) ids.add(m[1]);
    }
    try {
      const out = execFileSync('git', ['grep', '-h', '-E', '^bornAs: *x[0-9a-z]{6,7}', sha, '--', 'backlog/'], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      for (const m of out.matchAll(/bornAs:\s*(x[0-9a-z]{6,7})/g)) ids.add(m[1]);
    } catch { /* no matches at this revision */ }
    hashCache = ids;
    return ids;
  };

  return { read, list, knownHashIds, exists: (p) => read(p) != null };
}

/* ------------------------------------------------------------------ scoring */

/**
 * Does a gate hit cover a labelled finding?
 *
 * DEFAULT IS FILE-LEVEL, and that is a finding of this experiment rather than a convenience. Scoring
 * line-proximity first looked obviously right and was wrong: on card #3147 the gate flags the defective
 * criterion at line 138, while the reviewer who found the SAME defect recorded it at line 102 — 36 lines
 * off. The labels' own line numbers are unreliable, which is precisely the defect class being gated, so
 * a line-proximity matcher scores a correct gate as a miss. `--match=line` keeps the strict form for
 * comparison, and the report prints how often the two disagree.
 */
export function covers(hit, label, tol, mode = 'content') {
  if (hit.path !== label.path) return false;
  if (mode === 'file') return true;
  if (mode === 'line') {
    if (label.line == null || label.line === 0) return true;
    return Math.abs(hit.line - label.line) <= tol;
  }
  // CONTENT (default). Neither location matcher is sound on this corpus. Line-proximity under-credits,
  // because the labels' own line numbers are often wrong — on card #3147 the gate flags the defective
  // criterion at line 138 and the reviewer recorded the SAME defect at 102. File-level over-credits far
  // worse: a gate firing anywhere in a long card gets scored as catching a finding it never addressed.
  // So a hit only counts when the thing the gate NAMES — its `subject`, the needle, slug, id, path or
  // locus it fired on — also appears in the reviewer's own description of the finding. That is a claim
  // about the same defect, not merely the same file.
  const subject = String(hit.subject ?? '').trim();
  if (subject.length < 3) return false;
  const hay = normalise(`${label.summary || ''}`);
  return hay.includes(normalise(subject));
}

/** Compare on letters and digits only, case-folded — markdown emphasis and backticks are authoring noise. */
function normalise(s) {
  return String(s).toLowerCase().replace(/[`*_"']/g, '').replace(/\s+/g, ' ').trim();
}

export function scoreCase(kase, { tol = 3, only = null, match = 'content' } = {}) {
  const ctx = revisionReader(kase.head);
  const hits = [];
  for (const path of kase.changedFiles) {
    const text = ctx.read(path);
    if (text == null) continue;
    const found = runGates(text, { path, read: ctx.read, list: ctx.list, knownHashIds: ctx.knownHashIds });
    hits.push(...(only ? found.filter((h) => h.gate === only) : found));
  }
  const labels = kase.findings.filter((f) => f.verdict === 'CONFIRMED');
  const matchedLabels = [];
  const usedHits = new Set();
  for (const label of labels) {
    const i = hits.findIndex((h, idx) => !usedHits.has(idx) && covers(h, label, tol, match));
    if (i !== -1) {
      usedHits.add(i);
      const drift = label.line && hits[i].line ? Math.abs(hits[i].line - label.line) : null;
      matchedLabels.push({ label, hit: hits[i], lineDrift: drift });
    }
  }
  const missed = labels.filter((l) => !matchedLabels.some((m) => m.label === l));
  const extras = hits.filter((_, i) => !usedHits.has(i));
  return { pr: kase.pr, round: kase.round, labels: labels.length, hits: hits.length, matched: matchedLabels, missed, extras };
}

function parseArgs(argv) {
  const o = { cases: 'scripts/review-corpus/cases', tol: 3, sampleExtras: 8, gate: null, json: false, match: 'content' };
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'cases') o.cases = m[2];
    if (m[1] === 'tol') o.tol = Number(m[2]);
    if (m[1] === 'sample-extras') o.sampleExtras = Number(m[2]);
    if (m[1] === 'gate') o.gate = m[2];
    if (m[1] === 'json') o.json = true;
    if (m[1] === 'match') o.match = m[2];
  }
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = resolve(ROOT, opts.cases);
  const files = readdirSync(dir).filter((f) => /^\d+-r\d+\.json$/.test(f)).sort();
  const results = [];
  for (const f of files) {
    const kase = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    results.push(scoreCase(kase, { tol: opts.tol, only: opts.gate, match: opts.match }));
  }

  const totalLabels = results.reduce((a, r) => a + r.labels, 0);
  const totalMatched = results.reduce((a, r) => a + r.matched.length, 0);
  const totalExtras = results.reduce((a, r) => a + r.extras.length, 0);

  // Per-gate: how many labels it caught, and how many places it fired with no label.
  const perGate = new Map(GATES.map((g) => [g.name, { caught: 0, extras: 0 }]));
  for (const r of results) {
    for (const m of r.matched) perGate.get(m.hit.gate).caught += 1;
    for (const e of r.extras) perGate.get(e.gate).extras += 1;
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ totalLabels, totalMatched, totalExtras, results }, null, 2)}\n`);
    return;
  }

  process.stdout.write('\nPhase 1 — deterministic gate replay\n');
  process.stdout.write(`cases ${files.length}   confirmed labels ${totalLabels}   matcher: ${opts.match}${opts.match === 'line' ? ` (+/-${opts.tol} lines)` : opts.match === 'file' ? ' (same file — over-credits)' : ' (gate subject named in the finding)'}\n\n`);
  process.stdout.write(`${'gate'.padEnd(28)}${'labels caught'.padStart(14)}${'fired w/o label'.padStart(18)}\n`);
  process.stdout.write(`${'-'.repeat(60)}\n`);
  for (const [name, s] of perGate) {
    if (opts.gate && name !== opts.gate) continue;
    process.stdout.write(`${name.padEnd(28)}${String(s.caught).padStart(14)}${String(s.extras).padStart(18)}\n`);
  }
  process.stdout.write(`${'-'.repeat(60)}\n`);
  process.stdout.write(`${'TOTAL'.padEnd(28)}${String(totalMatched).padStart(14)}${String(totalExtras).padStart(18)}\n`);
  process.stdout.write(`\nrecall over all confirmed labels: ${totalMatched}/${totalLabels} = ${totalLabels ? ((100 * totalMatched) / totalLabels).toFixed(1) : '0.0'}%\n`);
  process.stdout.write('  (the fired-without-label column is a queue to ADJUDICATE, not a false-positive rate —\n   the labels are what reviewers noticed, not everything that was wrong.)\n');

  const drifts = results.flatMap((r) => r.matched.map((m) => m.lineDrift)).filter((d) => d != null);
  const bigDrift = drifts.filter((d) => d > 3).length;
  const caught = results.flatMap((r) => r.matched.map((m) => `  ✓ PR#${r.pr} r${r.round} ${m.label.path.split('/').pop()}:${m.label.line} — ${m.hit.gate} (gate flagged line ${m.hit.line}${m.lineDrift != null && m.lineDrift > 3 ? `, label off by ${m.lineDrift}` : ''})`));
  if (drifts.length) {
    process.stdout.write(`\nlabel line-number agreement: ${drifts.length - bigDrift}/${drifts.length} within 3 lines of where the gate fired\n`);
    process.stdout.write('  (a large drift is the REVIEWER\'s line citation being wrong — the same defect class these gates exist for.)\n');
  }
  if (caught.length) {
    process.stdout.write('\nlabels a gate would have caught before the review ran:\n');
    process.stdout.write(`${caught.join('\n')}\n`);
  }

  if (opts.sampleExtras > 0 && totalExtras) {
    process.stdout.write(`\nsample of fires with no matching label (${Math.min(opts.sampleExtras, totalExtras)} of ${totalExtras}) — read these to separate real from noise:\n`);
    const flat = results.flatMap((r) => r.extras.map((e) => ({ ...e, pr: r.pr, round: r.round })));
    for (const e of flat.slice(0, opts.sampleExtras)) {
      process.stdout.write(`  ? PR#${e.pr} r${e.round} ${e.gate} ${e.path.split('/').pop()}:${e.line}\n      ${e.message.slice(0, 150)}\n`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
