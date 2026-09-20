/**
 * @file wip-report-io.mjs
 * @description Thin IO shell for `wip-report.mjs`. Gathers every fact the pure core needs and returns them as ONE raw
 * snapshot (`readRaw()`); the core composes and renders. The only write anywhere is `stampLastWip()`, called by the
 * CLI for `--stamp` and nowhere else. Every source is best effort and isolated: a failed source is recorded in
 * `errors` and its field left `null`, so the report says "unknown" rather than printing an empty section.
 *
 * Two sources live on `main` but not yet on the prototype branch (`operator-queue.mjs`, `runner-activity`); they are
 * read from the first of: this checkout, `WIP_MAIN_ROOT`, `~/workspace/.lanes/web-everything/lane-54`. If none has
 * them, the field is `unknown`, never assumed.
 *
 * All ports are injectable so tests never touch gh, claude, the network or the home directory.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir, loadavg, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLandAdvanceReader } from './land-advance-io.mjs';
import { createWipAgentsReader } from './wip-agents-io.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const run = (program, args, opts = {}) => String(execFileSync(program, args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], ...opts }));

/** Where the operator's `last-wip` stamp lives (override with `WIP_STATE_DIR`). */
export const stateDir = (home = homedir(), env = process.env) => env.WIP_STATE_DIR || join(home, 'workspace/.operations/state');
export const lastWipPath = (home, env) => join(stateDir(home, env), 'last-wip.json');

export function readLastWip(path) {
  try { const at = JSON.parse(readFileSync(path, 'utf8'))?.at; return Number.isFinite(Date.parse(at)) ? at : null; } catch { return null; }
}
/** THE ONLY WRITE: persist the ISO time of this run. Atomic (tmp + rename). */
export function stampLastWip(path, iso) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ at: iso })}\n`);
  renameSync(tmp, path);
}

/** First checkout root that has `rel`; `null` when none does. */
export function findRoot(rel, { roots, exists = existsSync } = {}) {
  return (roots ?? []).find((r) => r && exists(join(r, rel))) ?? null;
}
export const defaultRoots = (home = homedir(), env = process.env) => [ROOT, env.WIP_MAIN_ROOT, join(home, 'workspace/.lanes/web-everything/lane-54'), join(home, 'workspace/web-everything')];

/** Completion sidecars with `status: done` (the dispatched agents' own outcome records). */
export function readCompletions(dir, { readdir = readdirSync, read = readFileSync } = {}) {
  const out = [];
  for (const name of readdir(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const c = JSON.parse(read(join(dir, name), 'utf8'));
      if (c && c.session) out.push({ session: c.session, kind: c.kind ?? null, pr: c.pr ?? null, item: c.item ?? null, status: c.status, outcome: c.outcome ?? null, updatedAt: c.updatedAt ?? c.startedAt ?? null });
    } catch { /* one torn record must not hide the others */ }
  }
  return out;
}

export function createWipReportReader(ports = {}) {
  const { home = homedir(), env = process.env, now = Date.now, exec = run, sweptReposPath = join(ROOT, 'scripts/lib/swept-repos.json'),
    roots = defaultRoots(home, env), mergedLimit = 50,
    readLand = () => createLandAdvanceReader({ // the prototype-branch count needs origin/main, absent from a single-branch clone; unknown is fine (nothing here reads it)
      readPrototype: () => { try { const [behind, ahead] = exec('git', ['rev-list', '--left-right', '--count', 'origin/main...origin/lane/mechanical-dispatcher'], { cwd: ROOT }).trim().split(/\s+/).map(Number); return { ahead, behind, refreshed: false, reason: 'cached refs' }; } catch { return { status: 'unknown' }; } },
    })(), readWip = () => createWipAgentsReader()(),
    readLoad = () => ({ load: loadavg()[0], cores: cpus().length }),
    readRunner = async () => {
      const root = findRoot('scripts/operations/runner-activity-io.mjs', { roots });
      if (!root) return { state: 'unknown', stalledReason: 'runner-activity is not on any checkout found' };
      const io = await import(pathToFileURL(join(root, 'scripts/operations/runner-activity-io.mjs')).href);
      const core = await import(pathToFileURL(join(root, 'scripts/operations/runner-activity.mjs')).href);
      return core.assessRunnerActivity(io.collectRunnerActivity({ limit: 0 }));
    },
    readQueue = () => {
      const root = findRoot('scripts/operations/operator-queue.mjs', { roots });
      if (!root) throw new Error('operator-queue.mjs is not on any checkout found');
      return exec('node', [join(root, 'scripts/operations/operator-queue.mjs')], { cwd: root });
    },
    readMerged = (slug) => JSON.parse(exec('gh', ['pr', 'list', '--repo', slug, '--state', 'merged', '--limit', String(mergedLimit), '--json', 'number,title,mergedAt'])).map((p) => ({ ...p, slug })),
    completionsDir = env.OPERATION_COMPLETIONS_DIR || join(findRoot('.operations/completions', { roots }) ?? ROOT, '.operations/completions'),
    readDone = () => readCompletions(completionsDir),
    readDocket = () => {
      const root = findRoot('reports/decision-docket-data.json', { roots });
      return root ? JSON.parse(readFileSync(join(root, 'reports/decision-docket-data.json'), 'utf8')) : null;
    },
    readStamp = () => readLastWip(lastWipPath(home, env)) } = ports;
  return async function readRaw() {
    const errors = [], get = async (source, fn, fallback = null) => { try { return await fn(); } catch (e) { errors.push({ source, message: String(e.message ?? e).split('\n')[0] }); return fallback; } };
    // The completion store resolves its directory from this env var at call time; point the verdict evidence at the same one.
    if (!env.OPERATION_COMPLETIONS_DIR) process.env.OPERATION_COMPLETIONS_DIR = completionsDir;
    const captured = Number(now());
    const landInputs = await get('land-advance', readLand);
    const wipData = await get('sessions', readWip);
    for (const e of landInputs?.errors ?? []) errors.push({ source: `land-advance:${e.source}`, message: String(e.message).split('\n')[0] });
    const merged = await get('merged-prs', () => JSON.parse(readFileSync(sweptReposPath, 'utf8')).flatMap((slug) => readMerged(slug)));
    const { load = null, cores = null } = await get('load', readLoad, {}) ?? {};
    return { now: captured, load, cores, runner: await get('runner', readRunner, { state: 'unknown' }), wipData, landInputs, merged,
      operatorQueueText: await get('operator-queue', readQueue), completions: await get('completions', readDone), lastWip: readStamp(),
      docket: await get('docket', readDocket), errors };
  };
}
