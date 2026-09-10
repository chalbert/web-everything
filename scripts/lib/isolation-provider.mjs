/**
 * Directory preparation port for dispatchers (#3371), shaped like JudgeProvider in
 * scripts/operations/cli-adapter.mjs. This is tooling, not a WE standard.
 *
 * Evidence: #3371 Probe 11 records the dispatching session's UNSANDBOXED macOS tests:
 * baseline quoted the real rule; deletion before startup yielded NOT LOADED; a separate
 * stripped-clone child created/read a file and ran Git status, independently verified.
 * Those supplied observations justify this technique; this module was not itself run
 * through a live Codex session. Probe 10's nested sandbox failure remains inconclusive.
 *
 * Only the root AGENTS.md is removed. Git history, ancestor/global/nested instructions,
 * overrides/fallbacks and explicit prompt context remain accessible. This is NOT read
 * denial, adversarial isolation, resource capping (#3621), or a replacement OS sandbox.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

/**
 * @typedef {object} IsolationProviderRequest
 * @property {string} sourceCwd - Absolute local repository path; clone committed HEAD only.
 * @property {string} [scratchParent] - Absolute existing temporary parent; defaults to OS temp.
 */

/**
 * @typedef {object} IsolationProviderOutcome
 * @property {string} cwd - Owned prepared directory; launch the child here only after resolution.
 * @property {string[]} excludedPaths - Relative paths absent at handoff, not enduring read bans.
 * @property {'root-agents-absent-before-start'} guarantee - No broader context-exclusion promise.
 * @property {() => Promise<void>} cleanup - Idempotent release. Call after child exit and result
 * extraction in finally; deletes all clone edits too. Rejects if release fails (safe to retry).
 */

/**
 * @typedef {(request: IsolationProviderRequest) => Promise<IsolationProviderOutcome>} IsolationProvider
 *
 * The function-type contract is backend-neutral, not a claim that preparation is pure.
 * Implementations reject on preparation failure, release partial resources, and return no
 * usable outcome until exclusions are applied. Callers must keep the directory exclusively
 * owned through child exit. Future Linux/Windows preparation backends use this same contract;
 * process/container execution and stronger guarantees need a separate execution contract.
 */

/** Pure argv builder. Paths are single arguments; no shell interpolation or CLI options as paths. */
export function buildIsolationCloneArgv(sourceCwd, destination) {
  for (const [name, value] of Object.entries({ sourceCwd, destination })) {
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
      throw new TypeError(`isolation: ${name} must be an absolute local path without NUL`);
    }
  }
  return ['clone', '--quiet', '--no-hardlinks', '--', sourceCwd, destination];
}

/**
 * First backend: deletion before launch, evidenced on macOS. No platform auto-selection:
 * portable Node/Git mechanics do not imply a live Linux/Windows context-loading proof.
 * Never mutates the source. Git clone excludes uncommitted/ignored files and dependencies.
 * The returned cwd is not a pooled lane; existing judge lane validation is not bypassed.
 *
 * @param {object} [options]
 * @param {(file: string, argv: string[], options: object) => Promise<unknown>} [options.execFn]
 *   execFile-compatible promise function; must reject on nonzero exit. Injected for tests.
 * @returns {IsolationProvider}
 */
export function createMacosDeletionIsolationProvider({ execFn = promisify(execFile) } = {}) {
  return async ({ sourceCwd, scratchParent = tmpdir() }) => {
    // Validate before allocating or executing anything, even with an injected execFn.
    buildIsolationCloneArgv(sourceCwd, scratchParent);
    const source = await realpath(sourceCwd);
    const parent = await realpath(scratchParent);
    const ownedRoot = await mkdtemp(join(parent, 'we-isolation-'));
    const cwd = join(ownedRoot, 'clone');
    const cleanup = async () => { await rm(ownedRoot, { recursive: true, force: true }); };
    try {
      await execFn('git', buildIsolationCloneArgv(source, cwd), {
        cwd: parent, encoding: 'utf8', shell: false,
      });
      // Unlink a symlink itself, never its target. A directory/error fails closed.
      try { await unlink(join(cwd, 'AGENTS.md')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      // Confirm the clone exists even if a broken injected executor reports success.
      await realpath(cwd);
      return {
        cwd, excludedPaths: ['AGENTS.md'], guarantee: 'root-agents-absent-before-start', cleanup,
      };
    } catch (error) {
      try { await cleanup(); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'isolation: preparation and cleanup failed');
      }
      throw error;
    }
  };
}
