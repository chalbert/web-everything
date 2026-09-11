/**
 * Directory/spawn preparation port for dispatchers (#3371), shaped like JudgeProvider in
 * scripts/operations/cli-adapter.mjs. This is tooling, not a WE standard.
 *
 * TWO backends, kept side by side on purpose (#3371 Probe 12), not one replacing the other —
 * they hold materially different guarantees, proven live, not assumed:
 *
 * - `createMacosDeletionIsolationProvider` (Probes 10/11): AGENTS.md is ABSENT from the child's
 *   clone before it ever starts. A tool-bearing agent that later runs `cat AGENTS.md` itself gets
 *   ENOENT — there is nothing on disk to read. Costs a full `git clone` per invocation.
 * - `createConfigOverrideIsolationProvider` (Probe 12): Codex CLI's own `-c
 *   project_doc_max_bytes=0` suppresses its automatic startup read of AGENTS.md into the model's
 *   context. No clone, no filesystem mutation — it operates on `sourceCwd` directly. But the file
 *   is still ON DISK: Probe 12 proved live that a tool-bearing agent told to `cat AGENTS.md`
 *   recovers the full text verbatim, in both `-s read-only` and `-s workspace-write` sandbox
 *   modes. This backend defeats only the CLI's *automatic* injection, not a deliberate read.
 *
 * Probe 9 (2026-09-09) concluded no such override flag existed; Probe 12 (2026-09-11) found and
 * live-verified `project_doc_max_bytes=0` and corrects that conclusion — see #3371 for the
 * verbatim before/after commands and output. Pick the deletion backend when the guarantee needed
 * is "the doctrine cannot be read at all short of `git show HEAD:AGENTS.md`"; pick the
 * config-override backend when "the CLI does not hand the doctrine to the model unasked" is
 * enough and the clone's cost/complexity is not worth paying. Neither backend is read denial,
 * adversarial isolation, resource capping (#3621), or a replacement OS sandbox.
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
 *   Ignored by backends that never clone (e.g. the config-override backend).
 */

/**
 * @typedef {object} IsolationProviderOutcome
 * @property {string} cwd - Directory to launch the child in, only after resolution. For a
 * cloning backend this is an owned, disposable directory; for a non-cloning backend it may be
 * `sourceCwd` itself (realpath'd) — check `excludedPaths`/`guarantee`, not just this field's
 * presence, to know what protection was actually applied.
 * @property {string[]} excludedPaths - Relative paths physically absent from `cwd` at handoff,
 * not enduring read bans. Empty for a backend that suppresses context injection without
 * touching the filesystem.
 * @property {'root-agents-absent-before-start'|'root-agents-doc-suppressed-in-cli-context'} guarantee -
 * Which property actually holds. The first means the file does not exist at `cwd`. The second,
 * weaker one means only the CLI's own automatic startup read was suppressed — the file may still
 * be present and readable by any tool the child runs. Callers must not treat these as
 * interchangeable.
 * @property {string[]} extraCliArgs - CLI arguments the caller MUST splice into the child
 * process's own argv for the guarantee to hold. Empty for a backend whose guarantee is already
 * true by the time its promise resolves (e.g. deletion). Non-empty for a backend whose guarantee
 * is enforced by the CHILD reading a flag (e.g. Codex's `-c project_doc_max_bytes=0`) — no
 * preparation step can substitute for the caller actually passing these through.
 * @property {() => Promise<void>} cleanup - Idempotent release. Call after child exit and result
 * extraction in finally. A no-op for a backend that never allocated anything. Rejects if release
 * fails (safe to retry).
 */

/**
 * @typedef {(request: IsolationProviderRequest) => Promise<IsolationProviderOutcome>} IsolationProvider
 *
 * The function-type contract is backend-neutral, not a claim that preparation is pure.
 * Implementations reject on preparation failure, release partial resources, and return no
 * usable outcome until exclusions/suppressions are applied. Callers must keep an owned directory
 * exclusively owned through child exit, and must always append `extraCliArgs` to the child's
 * invocation. Future Linux/Windows preparation backends use this same contract; process/container
 * execution and stronger guarantees need a separate execution contract.
 */

/** Throws unless every named value is an absolute, NUL-free local path string. Shared by every
 * backend below so path validation stays one rule, not one copy per backend. */
function assertAbsoluteLocalPaths(named) {
  for (const [name, value] of Object.entries(named)) {
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
      throw new TypeError(`isolation: ${name} must be an absolute local path without NUL`);
    }
  }
}

/** Pure argv builder. Paths are single arguments; no shell interpolation or CLI options as paths. */
export function buildIsolationCloneArgv(sourceCwd, destination) {
  assertAbsoluteLocalPaths({ sourceCwd, destination });
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
 * @test-only-export-ok: production wiring is deliberately deferred (see file header) — this is the
 *  first real backend of a new port, proven by #3371 Probes 10/11's direct evidence, not yet wired into
 *  any dispatch call site. isolation-provider.test.mjs is its only consumer until that wiring lands.
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
        cwd,
        excludedPaths: ['AGENTS.md'],
        guarantee: 'root-agents-absent-before-start',
        extraCliArgs: [],
        cleanup,
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

/**
 * Second backend: suppress Codex CLI's own automatic AGENTS.md ("project doc") injection via its
 * `-c project_doc_max_bytes=0` config override — real and live-verified (#3371 Probe 12), not
 * documentation-sourced. Probe 12 ran the exact override in both `-s read-only` and `-s
 * workspace-write` (tool-bearing) modes against a real canary AGENTS.md: the child reported "NOT
 * LOADED" for its automatic context in both, and real tool use (file create, `git status`) kept
 * working normally in workspace-write mode. `project_doc_max_bytes` is a genuine Codex config key
 * (default 32768 bytes; confirmed against the installed 0.153.4 binary), not a guessed flag name.
 *
 * No clone: this backend never mutates or copies anything, so it needs no scratch directory and
 * no cleanup — it operates on `sourceCwd` directly and `scratchParent` is ignored if given.
 *
 * WEAKER guarantee than the deletion backend, on purpose, not by oversight, and this is the one
 * thing this backend must not be trusted to do: AGENTS.md remains ON DISK and fully readable.
 * Probe 12 proved this live too — the same session that reported "NOT LOADED" for its automatic
 * context then ran `cat AGENTS.md` on request and recovered the canary text verbatim. Use this
 * backend only when the goal is "the CLI does not hand the doctrine to the model unasked"; use
 * the deletion backend when the goal is "the doctrine is not recoverable by the child at all
 * short of `git show HEAD:AGENTS.md`."
 *
 * The guarantee is enforced by the CHILD PROCESS reading `extraCliArgs` — unlike the deletion
 * backend, nothing this function does before returning makes the guarantee true. A caller that
 * drops `outcome.extraCliArgs` from the child's invocation silently loses the guarantee entirely;
 * there is no fallback enforcement here.
 *
 * @returns {IsolationProvider}
 * @test-only-export-ok: production wiring is deliberately deferred to #3630, the same open item
 *  that defers createMacosDeletionIsolationProvider's wiring — this is the second backend of the
 *  same not-yet-wired port. isolation-provider.test.mjs is its only consumer until that wiring lands.
 */
export function createConfigOverrideIsolationProvider() {
  return async ({ sourceCwd }) => {
    assertAbsoluteLocalPaths({ sourceCwd });
    const cwd = await realpath(sourceCwd);
    return {
      cwd,
      excludedPaths: [],
      guarantee: 'root-agents-doc-suppressed-in-cli-context',
      extraCliArgs: ['-c', 'project_doc_max_bytes=0'],
      cleanup: async () => {},
    };
  };
}
