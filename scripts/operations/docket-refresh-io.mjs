/**
 * @file scripts/operations/docket-refresh-io.mjs
 * @description THE IO SHELL of {@link ./docket-refresh.mjs} (#3723): the reader its `read` step is injected with and
 *   the sink that runs its one declared effect. See that file's header for the sequence.
 *
 * WHICH GENERATOR RUNS: the CHECKOUT's own `scripts/gen-decision-docket.mjs`, with that checkout as cwd, never this
 * file's repo. The generator ranks off its own working tree, so the version and the tree must be the same checkout.
 *
 * WHERE IT WRITES: only under `<coordination root>/docket/` (`WE_COORDINATION_ROOT`, default
 * `~/workspace/.operations/coordination`, the same root `./run-store.mjs` resolves). Nothing inside any checkout,
 * nothing committed. The generator's `--out`/`--data` are passed RELATIVE to the checkout so the same file is
 * meant under both a `join` and a `resolve` reading.
 *
 * THE ARTIFACT URL: read once, off the checkout's own tracked `skills-src/decision-docket/artifact.json`
 * (`{"url": "...", "title": "..."}`) — never hand-typed into a run, never listed via an `Artifact` call. Absent
 * or unparseable is not fatal: the reader hands `read` a `null` artifact rather than throwing, and the hand-off
 * record/stdout say so plainly (`docket-refresh.mjs#finishDocketOutcome`) instead of inventing a URL.
 *
 * A FAILED GENERATOR THROWS: the effect is `failed`, the run exits 1 and prints no `publish:` line.
 *
 * IMPURE by construction: `fs`, `git`, child `node`, `node:crypto`.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCoordinationRoot } from './coordination-root.mjs';
import { laneGuardDecision, workspaceRootOf } from '../guard-lane.mjs';
import {
  DATA_FILE, DOCKET_DIR_NAME, DOCKET_REFRESH_EFFECT, OWED_FILE, PAGE_FILE, STATE_FILE,
  buildPublishOwed, countItems, decideHandoff, formatState, parseState, stableDocketData,
} from './docket-refresh.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The sha-256 (hex) of the data with its clock fields removed. */
export const docketDataHash = (data) => createHash('sha256').update(stableDocketData(data)).digest('hex');

/** `{dir, dataPath, htmlPath, statePath, owedPath}` under a state root. */
export function docketPaths(stateRoot = resolveCoordinationRoot()) {
  const dir = join(stateRoot, DOCKET_DIR_NAME);
  return { dir, dataPath: join(dir, DATA_FILE), htmlPath: join(dir, PAGE_FILE), statePath: join(dir, STATE_FILE), owedPath: join(dir, OWED_FILE) };
}

/**
 * Is `root` a constellation PRIMARY checkout? The same rule `we:scripts/guard-lane.mjs` enforces for edits
 * (a path under `<workspace>/<primary repo>/` and not under `.lanes/`), asked of a file at the checkout's root.
 */
export function isPrimaryCheckout(root, { workspace = workspaceRootOf(REPO_ROOT) } = {}) {
  // Both sides real paths: `git rev-parse --show-toplevel` answers with one (`/private/var/…` on macOS for `/var/…`).
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  return laneGuardDecision(join(real(root), 'package.json'), join(real(workspace), '_')) !== null;
}

/** Default child-process runner: `{status, stdout, stderr}`. */
export function defaultExec(program, args, { cwd } = {}) {
  const r = spawnSync(program, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });
  return { status: r.status ?? (r.error ? 1 : 0), stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? r.error?.message ?? '') };
}

/** Write a file atomically (tmp + rename), creating its directory. */
function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

const firstLine = (s) => String(s ?? '').split('\n').find((l) => l.trim())?.trim() ?? '';

/**
 * Read the checkout's own tracked `skills-src/decision-docket/artifact.json` — `{ url, title }`. Returns `null`
 * on ANY failure (missing file, bad JSON, no `url` field): never fabricates a URL a session would publish to.
 * @param {string} root the checkout's root
 */
export function readDocketArtifact(root) {
  try {
    const raw = JSON.parse(readFileSync(join(root, 'skills-src', 'decision-docket', 'artifact.json'), 'utf8'));
    const url = typeof raw?.url === 'string' && raw.url.trim() ? raw.url.trim() : null;
    if (!url) return null;
    return { url, title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : null };
  } catch {
    return null;
  }
}

/**
 * THE REAL `readFacts`. Every seam is injectable.
 * @param {object} [o]
 * @param {() => string} [o.cwd]
 * @param {() => string} [o.stateRoot]
 * @param {(root: string) => boolean} [o.isPrimary]
 * @param {(root: string) => ({url: string, title: string}|null)} [o.readArtifact]
 * @param {() => string} [o.now]
 * @param {typeof defaultExec} [o.exec]
 */
export function createDocketRefreshReader({
  cwd = () => process.cwd(), stateRoot = () => resolveCoordinationRoot(), isPrimary = (root) => isPrimaryCheckout(root),
  readArtifact = readDocketArtifact, now = () => new Date().toISOString(), exec = defaultExec,
} = {}) {
  return ({ checkout = '' } = {}) => {
    const here = checkout ? resolve(checkout) : cwd();
    const top = exec('git', ['rev-parse', '--show-toplevel'], { cwd: here });
    if (top.status !== 0) throw new Error(`docket-refresh: ${here} is not a git checkout`);
    const root = top.stdout.trim();
    const paths = docketPaths(stateRoot());
    let state = null;
    try { state = parseState(readFileSync(paths.statePath, 'utf8')); } catch { state = null; }
    return { root, primary: isPrimary(root), ...paths, state, artifact: readArtifact(root), now: now() };
  };
}

/**
 * BUILD THE SINK MAP for the one effect.
 * @param {{exec?: typeof defaultExec}} [o]
 */
export function createDocketRefreshSinks({ exec = defaultExec } = {}) {
  return {
    [DOCKET_REFRESH_EFFECT]: async (payload) => {
      const { root, ref } = payload;
      const run = (program, args) => exec(program, args, { cwd: root });

      // (a) fetch (best effort), then refuse a checkout whose HEAD is not the ref.
      let fetched = 'not fetched';
      const slash = String(ref).indexOf('/');
      if (payload.fetch && slash > 0) {
        const f = run('git', ['fetch', '--quiet', ref.slice(0, slash), ref.slice(slash + 1)]);
        fetched = f.status === 0 ? `fetched ${ref}` : `fetch of ${ref} failed (${firstLine(f.stderr) || `exit ${f.status}`}); used the refs as they were`;
      }
      const sha = (rev) => {
        const r = run('git', ['rev-parse', '--verify', `${rev}^{commit}`]);
        if (r.status !== 0) throw new Error(`git rev-parse ${rev} failed: ${firstLine(r.stderr)}`);
        return r.stdout.trim();
      };
      const headSha = sha('HEAD');
      const refSha = sha(ref);
      if (headSha !== refSha) return { status: 'checkout-behind', fetched, headSha, refSha };

      // (b) the checkout's own generator, writing only under the state root.
      const gen = join(root, 'scripts', 'gen-decision-docket.mjs');
      const rel = (p) => relative(root, p);
      mkdirSync(payload.dir, { recursive: true });
      // `--ref` is the SHA just checked, not the ref name: older generators' `check-readiness` fetches on its own, which
      // would move `origin/main` past the HEAD that was checked (seen replaying 2026-09-19's main).
      const data = run(process.execPath, [gen, 'data', `--ref=${refSha}`, '--allow-stale', '--no-fetch', `--out=${rel(payload.dataPath)}`]);
      if (data.status !== 0) throw new Error(`gen-decision-docket data failed (exit ${data.status}): ${firstLine(data.stderr) || firstLine(data.stdout)}`);
      const parsed = JSON.parse(readFileSync(payload.dataPath, 'utf8'));

      // (c) the content hash against the state (skipped when `--force`), (d) only on a change: page, state, one hand-off.
      const hash = docketDataHash(parsed);
      const counts = countItems(parsed);
      const decision = decideHandoff({ hash, state: payload.state, force: payload.force });
      let owedPath = null;
      let artifactUrl = payload.artifact?.url ?? null;
      if (decision.changed) {
        const render = run(process.execPath, [gen, 'render', `--data=${rel(payload.dataPath)}`, `--out=${rel(payload.htmlPath)}`]);
        if (render.status !== 0) throw new Error(`gen-decision-docket render failed (exit ${render.status}): ${firstLine(render.stderr) || firstLine(render.stdout)}`);
        writeAtomic(payload.owedPath, `${JSON.stringify(buildPublishOwed({
          hash, ref, headSha, dataPath: payload.dataPath, htmlPath: payload.htmlPath, now: payload.now, counts,
          artifact: payload.artifact,
        }), null, 2)}\n`);
        writeAtomic(payload.statePath, formatState({ lastHash: hash, lastChangedAt: payload.now }));
        owedPath = payload.owedPath;
      }
      return {
        status: 'refreshed', fetched, headSha, refSha, hash, counts, reason: decision.reason,
        dataPath: payload.dataPath, htmlPath: decision.changed ? payload.htmlPath : null, owedPath, artifactUrl,
      };
    },
  };
}
