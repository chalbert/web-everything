/**
 * @file scripts/operations/tracker-refresh-io.mjs
 * @description THE IO SHELL of {@link ./tracker-refresh.mjs} — the reader its `read` step is injected with, the sink
 *   that runs its one declared effect, and the state-file helpers the `tracker-refresh-state.mjs` command line
 *   shares. `tracker-refresh.mjs` reaches none of this.
 *
 * WHAT THE SINK RUNS, in order, each as a child process in the checkout's own directory (so each is the real
 * command, not a re-implementation): `git fetch` (best effort), `run.mjs priority-sync --apply`, `prototype-tracker.mjs
 * check-priority --strict`, `prototype-tracker.mjs render`. It then writes the page and, when the content hash
 * differs from the state file's, the publish worker's brief. It never commits, never pushes and never calls the
 * Artifact tool: the sync edits the tracker card in the checkout and stops, as `priority-sync` always has.
 *
 * A FAILED SYNC OR RENDER THROWS: the effect is `failed`, the run exits 1 and prints no `publish:` line, so the
 * orchestrator cannot mistake a broken refresh for "current". A failed `check-priority --strict` does NOT throw:
 * drift is a fact about the card, the page is still a true picture of it, and the result says so.
 *
 * IMPURE by construction: `fs`, `git`, child `node`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultGit } from '../lib/priority-order.mjs';
import { findTrackerPath } from '../lib/prototype-tracker-data.mjs';
import { contentHash } from '../lib/tracker-page-hash.mjs';
import { queueRoots } from '../lib/prototype-tracker-compact-io.mjs';
import { findRoot } from './wip-report-io.mjs';
import {
  BRIEF_FILE, PAGE_FILE, RESULT_FILE, STATE_FILE, TRACKER_DIR_NAME, TRACKER_REFRESH_EFFECT,
  buildPublishBrief, decidePublish, formatState, idFromUrl, parseState,
} from './tracker-refresh.mjs';

/** The repo the OPERATION lives in (script location, never the cwd): the scripts it runs. They are run with the
 *  checkout being refreshed as the working directory, exactly as `priority-sync` reads that checkout's card. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The operator's operations directory (`WIP`'s own `~/workspace/.operations`). */
export const defaultOperationsDir = (home = homedir()) => join(home, 'workspace', '.operations');

/** `{operationsDir, htmlPath, statePath, briefPath, resultPath}` for an operations directory. */
export function refreshPaths(operationsDir) {
  const tracker = join(operationsDir, TRACKER_DIR_NAME);
  const jobs = join(operationsDir, 'jobs');
  return {
    operationsDir,
    htmlPath: join(tracker, PAGE_FILE),
    statePath: join(tracker, STATE_FILE),
    briefPath: join(jobs, BRIEF_FILE),
    resultPath: join(jobs, RESULT_FILE),
  };
}

/** Read and parse a state file; `null` when it is absent or unreadable. */
export function readState(path, { read = (p) => readFileSync(p, 'utf8') } = {}) {
  try { return parseState(read(path)); } catch { return null; }
}

/** Write a file atomically (tmp + rename), creating its directory. */
export function writeAtomic(path, text, { mkdir = (d) => mkdirSync(d, { recursive: true }), write = (p, s) => writeFileSync(p, s, 'utf8'), rename = renameSync } = {}) {
  mkdir(dirname(path));
  const tmp = `${path}.${process.pid}.tmp`;
  write(tmp, text);
  rename(tmp, path);
}

/** Write the state file: the four fields, fixed order. */
export function writeState(path, state, ports = {}) {
  writeAtomic(path, formatState(state), ports);
}

/** Default child-process runner: `{status, stdout, stderr}`. */
export function defaultExec(program, args, { cwd, env } = {}) {
  const r = spawnSync(program, args, { cwd, env: env ?? process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });
  return { status: r.status ?? (r.error ? 1 : 0), stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? r.error?.message ?? '') };
}

const firstLine = (s) => String(s ?? '').split('\n').find((l) => l.trim())?.trim() ?? '';

/**
 * THE REAL `readFacts`. Every seam is injectable.
 * @param {object} [o]
 * @param {() => string} [o.cwd]
 * @param {Function} [o.git]
 * @param {string} [o.home]
 * @param {() => string} [o.now] an ISO instant
 * @param {(path: string) => string} [o.read]
 */
export function createTrackerRefreshReader({
  cwd = () => process.cwd(), git = defaultGit, home = homedir(), now = () => new Date().toISOString(), read = (p) => readFileSync(p, 'utf8'),
} = {}) {
  return ({ operationsDir = '' } = {}) => {
    const here = cwd();
    let root;
    try { root = git(['rev-parse', '--show-toplevel'], { cwd: here }).toString('utf8').trim(); } catch { root = here; }
    const trackerPath = findTrackerPath({ backlogDir: join(root, 'backlog') });
    if (!trackerPath) throw new Error(`tracker-refresh: no backlog/3383-*.md in ${root} — run it from the prototype checkout`);
    const paths = refreshPaths(operationsDir || defaultOperationsDir(home));
    return { root, trackerPath, ...paths, state: readState(paths.statePath, { read }), now: now() };
  };
}

/** The lines of a `check-priority` run worth showing: its drift findings, at most `max`. */
function checkDetails(stdout, max = 8) {
  const findings = String(stdout).split('\n').filter((l) => /^ {2}[a-z-]+: /.test(l)).map((l) => l.trim());
  return findings.length > max ? [...findings.slice(0, max), `… and ${findings.length - max} more`] : findings;
}

/**
 * BUILD THE SINK MAP for the one effect. See the file header for the sequence.
 * @param {object} [o]
 * @param {(program: string, args: string[], opts?: object) => {status: number, stdout: string, stderr: string}} [o.exec]
 * @param {() => (string|null)} [o.findQueueRoot] the checkout holding `operator-queue.mjs`, or `null`
 * @param {{read?: Function, write?: Function, mkdir?: Function, rename?: Function}} [o.fs]
 */
export function createTrackerRefreshSinks({
  exec = defaultExec,
  findQueueRoot = () => findRoot('scripts/operations/operator-queue.mjs', { roots: queueRoots(), exists: existsSync }),
  fs = {},
} = {}) {
  return {
    [TRACKER_REFRESH_EFFECT]: async (payload) => {
      const { root, ref } = payload;
      const node = process.execPath;
      const run = (program, args) => exec(program, args, { cwd: root });

      // (a) fetch (best effort), then the mechanical sync, then the strict check.
      let fetched = 'not fetched';
      const slash = String(ref).indexOf('/');
      if (payload.fetch && slash > 0) {
        const f = run('git', ['fetch', '--quiet', ref.slice(0, slash), ref.slice(slash + 1)]);
        fetched = f.status === 0 ? `fetched ${ref}` : `fetch of ${ref} failed (${firstLine(f.stderr) || `exit ${f.status}`}); used the refs as they were`;
      }
      const sync = run(node, [join(REPO_ROOT, 'scripts/operations/run.mjs'), 'priority-sync', '--apply', `--ref=${ref}`]);
      if (sync.status !== 0) throw new Error(`priority-sync failed (exit ${sync.status}): ${firstLine(sync.stdout) || firstLine(sync.stderr)}`);
      const syncLine = sync.stdout.split('\n').find((l) => l.startsWith('priority-sync:')) ?? firstLine(sync.stdout);
      const check = run(node, [join(REPO_ROOT, 'scripts/prototype-tracker.mjs'), 'check-priority', `--ref=${ref}`, '--strict']);
      const checkSummary = check.stdout.split('\n').find((l) => /priority order (OK|DRIFT)/.test(l))?.replace(/^prototype-tracker:\s*/, '') ?? firstLine(check.stdout);

      // (b) the compact page, written where the publish worker reads it.
      const render = run(node, [join(REPO_ROOT, 'scripts/prototype-tracker.mjs'), 'render', `--ref=${ref}`]);
      if (render.status !== 0) throw new Error(`render failed (exit ${render.status}): ${firstLine(render.stderr) || firstLine(render.stdout)}`);
      const html = render.stdout;
      if (!html.includes('id="up-next"')) throw new Error('render printed something that is not the compact tracker page');
      writeAtomic(payload.htmlPath, html, fs);

      // (c) the content hash against the state file, (d) the brief when the page changed.
      const hash = contentHash(html);
      const decision = decidePublish({ hash, state: payload.state, now: payload.now });
      let briefPath = null;
      if (decision.publish === 'needed') {
        const queueRoot = findQueueRoot();
        writeAtomic(payload.briefPath, buildPublishBrief({
          htmlPath: payload.htmlPath, statePath: payload.statePath, resultPath: payload.resultPath, hash, state: payload.state,
          stateScript: join(REPO_ROOT, 'scripts', 'operations', 'tracker-refresh-state.mjs'), trackerPath: payload.trackerPath,
          queueScript: queueRoot ? join(queueRoot, 'scripts', 'operations', 'operator-queue.mjs') : null, queueRoot, renderedAt: payload.now,
        }), fs);
        briefPath = payload.briefPath;
      }
      return {
        fetched,
        sync: syncLine,
        check: { ok: check.status === 0, summary: checkSummary, details: checkDetails(check.stdout) },
        htmlPath: payload.htmlPath,
        statePath: payload.statePath,
        bytes: Buffer.byteLength(html),
        hash,
        publish: decision.publish,
        dispatchDue: decision.dispatchDue,
        ageMinutes: decision.ageMinutes,
        reason: decision.reason,
        lastPublishedAt: payload.state?.lastPublishedAt ?? null,
        briefPath,
        resultPath: payload.resultPath,
      };
    },
  };
}

/**
 * `record` for the state command line: the page at `htmlPath` has just been published at `url`. Rewrites the state
 * file with the page's content hash, the time, the id and the url. PURE over its ports.
 * @returns {{state: object, statePath: string}}
 */
export function recordPublish({ htmlPath, url, id = '', statePath = join(dirname(htmlPath), STATE_FILE), now = () => new Date().toISOString(), read = (p) => readFileSync(p, 'utf8'), ports = {} } = {}) {
  const resolvedId = String(id || '').trim() || idFromUrl(url);
  if (!resolvedId) throw new Error(`tracker-refresh-state: no artifact id: pass --id, or a url that ends /artifact/<id> (got ${JSON.stringify(url)})`);
  const state = { url: String(url), id: resolvedId, lastPublishedHash: contentHash(read(htmlPath)), lastPublishedAt: now() };
  writeState(statePath, state, ports);
  return { state, statePath };
}
