#!/usr/bin/env node
/**
 * check-axis-vacancy.mjs — proactive coverage-gap alerter for the reference corpus (slice #863 of the
 * reference-health epic #583). Each corpus `category` is an AXIS the benchmark deliberately spans
 * (mature-design-system, headless-primitive, web-component-system, …). When retirements (#584 markers)
 * or a liveness sweep (#585) thin an axis below a minimum count of LIVE sources, the comparison loses
 * its footing on that axis — a vacancy that should surface *before* someone notices the gap, not after.
 *
 * A source counts as NOT live if it carries a #584 `retired:true` marker, or (when a sweep report is
 * supplied via `--with-sweep`) if its `docsUrl`/`repoUrl` was classified `gone` / `unreachable` /
 * `superseded`. Everything else counts as live.
 *
 * Run: `npm run check:axis-vacancy`                          (markers only, threshold 2)
 *      `npm run check:axis-vacancy -- --threshold=3`         (stricter floor)
 *      `npm run check:axis-vacancy -- --with-sweep=reports/reference-liveness-latest.json`
 *
 * Exits non-zero when any axis is vacant, so it can gate CI or a scheduled refresh (#367).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'src/_data/benchmarkCorpus.json');

/** Classes from the #585 sweep that mean a corpus source is effectively dead for coverage purposes. */
export const DEAD_CLASSES = ['gone', 'unreachable', 'superseded'];

/**
 * Pure core: per-axis live/retired/dead tallies and a `vacant` flag. No I/O.
 *
 * @param {Array} categories  corpus `categories` ({ id, label, axis }).
 * @param {Array} sources     corpus `sources` ({ category, retired?, docsUrl?, repoUrl? }).
 * @param {object} [opts]     { threshold=2, deadUrls=Set } — deadUrls are URLs a sweep marked dead.
 * @returns {{ threshold:number, axes:Array, vacancies:Array }}
 */
export function computeAxisVacancy(categories, sources, { threshold = 2, deadUrls = new Set() } = {}) {
  const isDeadBySweep = (s) => deadUrls.has(s.docsUrl) || deadUrls.has(s.repoUrl);
  const axes = categories.map((cat) => {
    const inCat = sources.filter((s) => s.category === cat.id);
    let live = 0, retired = 0, dead = 0;
    for (const s of inCat) {
      if (s.retired === true) retired++;
      else if (isDeadBySweep(s)) dead++;
      else live++;
    }
    return { id: cat.id, label: cat.label, total: inCat.length, live, retired, dead, vacant: live < threshold };
  });
  // An axis with sources in the corpus but no category definition is itself a (schema) gap — surface it.
  const definedIds = new Set(categories.map((c) => c.id));
  const orphanCats = [...new Set(sources.map((s) => s.category).filter((c) => c && !definedIds.has(c)))];
  for (const id of orphanCats) {
    const inCat = sources.filter((s) => s.category === id);
    axes.push({ id, label: `(undefined category "${id}")`, total: inCat.length,
      live: inCat.filter((s) => !s.retired && !isDeadBySweep(s)).length, retired: 0, dead: 0, vacant: true });
  }
  return { threshold, axes, vacancies: axes.filter((a) => a.vacant) };
}

/** Collect the set of URLs a sweep report classified into a DEAD_CLASSES bucket. */
export function deadUrlsFromSweep(report) {
  const set = new Set();
  for (const r of report?.results || []) if (DEAD_CLASSES.includes(r.class)) set.add(r.url);
  return set;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
  const threshold = args.threshold ? parseInt(args.threshold, 10) : 2;

  let deadUrls = new Set();
  if (args['with-sweep']) {
    const p = join(ROOT, String(args['with-sweep']));
    if (!existsSync(p)) { console.error(`no sweep report at ${args['with-sweep']}`); process.exit(2); }
    deadUrls = deadUrlsFromSweep(JSON.parse(readFileSync(p, 'utf8')));
  }

  const { axes, vacancies } = computeAxisVacancy(corpus.categories, corpus.sources, { threshold, deadUrls });
  console.log(`axis vacancy — corpus coverage by category (floor: ${threshold} live source(s)${deadUrls.size ? ', sweep-aware' : ''})\n`);
  for (const a of axes) {
    const tag = a.vacant ? 'VACANT ' : 'ok     ';
    const extra = [a.retired ? `${a.retired} retired` : '', a.dead ? `${a.dead} dead` : ''].filter(Boolean).join(', ');
    console.log(`  ${tag} ${a.live}/${a.total} live  ${a.id}${extra ? `  (${extra})` : ''}`);
  }
  if (vacancies.length) {
    console.log(`\n⚠ ${vacancies.length} vacant axis/axes below the ${threshold}-source floor: ${vacancies.map((v) => v.id).join(', ')}`);
    console.log('Restock the corpus (add a live source in that category) or re-confirm the retirements.');
    process.exit(1);
  }
  console.log('\n✓ no axis vacancy — every category meets the live-source floor.');
}
