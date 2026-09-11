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
 *
 * SECOND BACKEND (below): Probe 14 found the above is actively counterproductive on its own —
 * `git status` prints a ` D <path>` line naming exactly what was removed, and a real tool-bearing
 * Codex session followed that signpost to `git show HEAD:AGENTS.md` on an ordinary,
 * non-adversarial task (14a). `createNativeDenyWithHistoryStripIsolationProvider` is the
 * evidence-backed fix: real git-history surgery (14e, verified against all 8252 objects in a real
 * repo) so there is no signpost and no recoverable blob, PLUS the argv fragment for Codex's
 * undocumented native filesystem-deny permission (14f/14h) so a direct read of the live path is
 * denied everywhere on the host, not just inside one clone. Neither half alone is a general
 * adversarial-isolation guarantee — see that function's own header for the residual gap (any OTHER
 * readable git repo on disk, e.g. this repo's own lane clones, still leaks the same way; closing
 * that is #3621's read-allowlist territory, not this port's).
 */
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
 * @property {'root-agents-absent-before-start'|'history-stripped-before-start'} guarantee - No
 * broader context-exclusion promise than the named value describes.
 * @property {string[]} [codexConfigArgs] - Backend-specific: present only on backends that also
 * hand back a Codex argv fragment for the CALLER to splice into its own `codex exec` invocation
 * (this module prepares directories; it never launches a child — see file header). Its own
 * guarantee is separate from `guarantee` above, which describes only what this function did
 * before returning.
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

/**
 * Pure argv builder for the history-surgery clone (#3371 Probe 14e). `--depth 1` collapses the
 * clone to a single grafted root commit — the fact that makes `buildHistorySurgeryCommands`'s
 * `commit --amend` below rewrite the ENTIRE history in one step, instead of needing a
 * filter-repo-style rewrite across many commits. `file://` (a URL, not a bare filesystem path)
 * forces a real object transfer rather than git's `--local` hardlink fast-path, matching exactly
 * what Probe 14e measured (2s wall, then 0 hits across all 8252 objects after surgery).
 */
export function buildHistorySurgeryCloneArgv(sourceCwd, destination) {
  for (const [name, value] of Object.entries({ sourceCwd, destination })) {
    if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
      throw new TypeError(`isolation: ${name} must be an absolute local path without NUL`);
    }
  }
  return ['clone', '--quiet', '--depth', '1', '--no-hardlinks', '--', pathToFileURL(sourceCwd).href, destination];
}

/**
 * Pure builder for the ordered git-surgery command sequence (#3371 Probe 14e). Every returned argv
 * runs with `cwd` set to the clone directory produced by `buildHistorySurgeryCloneArgv`, in the
 * returned order — order is load-bearing, and both traps Probe 14e hit by getting it wrong are
 * baked in structurally rather than left for a caller to remember:
 * - `remote remove origin` runs BEFORE the amend. Skipping it leaves `refs/remotes/origin/main`
 *   pointing at the pre-amend commit, and `git show origin/main:<path>` walks straight around the
 *   surgery.
 * - `repack -a -d -f` (not `git gc --prune=now`) is the step that actually evicts the unreachable
 *   object. Probe 14e's own first attempt used plain `gc --prune=now`, passed `git show`, and still
 *   printed the file via `git cat-file -p <known-hash>` — gc does not evict an object that is
 *   already sitting unreachable inside an existing packfile; only a forced repack rewrites it away.
 * Commit identity is passed via `-c user.name=…/user.email=…` on the amend invocation itself, not
 * written into the clone's own config, so this works with no ambient git identity configured
 * anywhere (a bare CI box, a from-scratch scratch parent) without mutating global state.
 */
export function buildHistorySurgeryCommands(targetPaths) {
  if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
    throw new TypeError('isolation: targetPaths must be a non-empty array of repo-relative paths');
  }
  for (const path of targetPaths) {
    if (typeof path !== 'string' || path.length === 0 || isAbsolute(path) || path.includes('\0')) {
      throw new TypeError('isolation: each targetPath must be a non-empty repo-relative path without NUL');
    }
  }
  return [
    ['remote', 'remove', 'origin'],
    ['rm', '--quiet', '--', ...targetPaths],
    ['-c', 'user.name=we-isolation', '-c', 'user.email=isolation@localhost',
      'commit', '--quiet', '--amend', '--no-edit'],
    ['reflog', 'expire', '--expire=now', '--all'],
    ['repack', '-a', '-d', '-f', '-q'],
    ['prune'],
  ];
}

/**
 * Pure argv builder for Codex's native per-profile filesystem-deny permission (#3371 Probe 14f/14h)
 * — undocumented: absent from the public config-reference page, recovered by exhaustive search of
 * the CLI binary's own serde config tables (14h). This module never launches Codex itself (see file
 * header — preparation is this port's whole job); the returned flags are for the CALLER to splice
 * into its own `codex exec` argv.
 *
 * `project_doc_max_bytes=0` is INCLUDED UNCONDITIONALLY and is not an optional extra: the deny map
 * also denies Codex's own AGENTS.md auto-loader, and without the byte cap at 0 that loader trips its
 * own denial and kills session startup before the model ever runs — Probe 14f's own words for the
 * failure this prevents: "Fatal error: Failed to initialize session: failed to load AGENTS.md
 * instructions ... Operation not permitted". `--strict-config` is included so a mistyped or
 * no-longer-valid key fails LOUD instead of being silently ignored — Probe 14h found plain `-c` keys
 * are NOT validated without it, which makes "no effect" and "key does not exist" indistinguishable
 * otherwise.
 *
 * Deny-BY-PATH ONLY — this is Gap 1's residual, stated here rather than only in the provider below.
 * It closes every DIRECT filesystem read of `denyPaths`, on this host and inside any clone at those
 * paths (14f), but does nothing about `git show`/`git cat-file` reading the identical bytes out of
 * `.git/objects` at a DIFFERENT path (14d, proved live: a session under a Seatbelt path-deny still
 * recovered the file through `git show HEAD:AGENTS.md`). Always pair this with real history surgery
 * (`buildHistorySurgeryCommands`) against every git repo the child can reach; this function alone is
 * a read denial, not history isolation.
 *
 * DO NOT ALSO PASS `-s <mode>` to `codex exec` alongside these flags — measured live on codex-cli
 * 0.153.4 (this backend's own real end-to-end re-verification, not carried over from Probe 14's
 * text): `-s workspace-write` and, separately, `-s danger-full-access` each made the deny map have
 * ZERO effect — a live agentic run under either flag read a denied path's content successfully. Omit
 * `-s` entirely and `default_permissions=locked` governs the sandbox on its own (its `extends
 * ":workspace"` already grants the same write access `-s workspace-write` would have), and the same
 * live run then genuinely declined every denied read. The mechanism most consistent with this: `-s`
 * is CODEX'S OWN selector for one of its three built-in named profiles, and it silently wins over a
 * custom `default_permissions` selection for the same underlying setting rather than composing with
 * it — so the two are alternatives, not flags meant to be combined.
 *
 * One more measured, honest limit from that same re-verification, not a new finding but a direct
 * reproduction of Probe 14g's own: a cooperative `codex exec` session that is TOLD about the active
 * deny (Codex surfaces it in the model's own context) self-declines a denied read without attempting
 * it at all — a real, useful protective behavior, but a MODEL-COOPERATION signal, not an OS-syscall
 * guarantee for that path. Forcing an actual attempt (direct instruction, obfuscating the path via
 * shell indirection/base64, framing it as authorized security testing) failed every way tried, same
 * as Probe 14g's own two red-team attempts. The genuinely OS-enforced half of this same permission
 * profile is independently verified via the separate `codex sandbox -P <name>` subcommand (a raw
 * command wrapper with no model involved) — confirmed live: `Operation not permitted`, real Seatbelt
 * denial, on the identical profile. `codex exec`'s own internal application of that same profile to
 * its model-issued shell calls was not independently forced past the model's cooperation in this
 * verification; treat the `codex exec` protection as strong-in-practice-against-a-cooperative-model,
 * and `codex sandbox` as the harder, OS-level guarantee when that distinction matters.
 */
export function buildNativeDenyCodexArgs(denyPaths) {
  if (!Array.isArray(denyPaths) || denyPaths.length === 0) {
    throw new TypeError('isolation: denyPaths must be a non-empty array of absolute paths or globs');
  }
  const entries = denyPaths.map((path) => {
    if (typeof path !== 'string' || path.length === 0 || path.includes('\0') || path.includes('"')) {
      throw new TypeError('isolation: each denyPath must be a non-empty string without NUL or a double quote');
    }
    return `"${path}"="deny"`;
  });
  const permissions = `permissions={locked={extends=":workspace",filesystem={${entries.join(',')}}}}`;
  return ['--strict-config', '-c', permissions, '-c', 'default_permissions=locked', '-c', 'project_doc_max_bytes=0'];
}

/**
 * Second backend (#3371 Probe 14): real git-history surgery on a scratch clone, plus the Codex
 * native-deny argv fragment — the combined, evidence-backed fix Probe 14's verdict recommends over
 * `createMacosDeletionIsolationProvider` above. Deletion alone is actively counterproductive: `git
 * status` prints a ` D <path>` signpost naming exactly what was removed, and a real tool-bearing
 * Codex session followed that signpost to `git show HEAD:AGENTS.md` unprompted, on an ordinary
 * non-adversarial task that never mentioned git, history, or recovery (14a). This backend leaves no
 * such signpost: `targetPaths` are amended out of the clone's own single grafted root commit, so
 * `git status` stays clean and `git show`/`git cat-file` on every object in the resulting packfile
 * come back empty — verified in Probe 14e against all 8252 objects in a real repository, and by this
 * module's own real-git integration test.
 *
 * What this backend does NOT do: launch Codex, or apply the deny config to anything. Per the file
 * header, this port prepares a directory; it never owns child argv, sandbox policy, or launch. The
 * returned `codexConfigArgs` is `buildNativeDenyCodexArgs`'s output, ready for the CALLER to splice
 * into its OWN `codex exec` invocation — the `guarantee` field describes only the history-surgery
 * half this function actually performs before returning; the filesystem-deny half only takes effect
 * once the caller actually launches Codex with `codexConfigArgs` included.
 *
 * RESIDUAL GAP — stated plainly, do not read this backend as closing more than it does (14g/14h):
 * 1. **Any OTHER readable git repo on disk holding the same file still leaks.** Proved live, not
 *    hypothesised — under the full recipe, `git show` inside a SIBLING clone still printed the file
 *    (14b/14g). This repo's own `workspace/.lanes/<repo>/lane-*` clones are exactly that shape.
 *    Closing that needs a read-ALLOWLIST profile rather than a deny-list, which is #3621's territory,
 *    not a fix this port can express — a directory-preparation contract has no view of every other
 *    repo on the host.
 * 2. **Another tracked file that merely QUOTES the stripped file's content is untouched** (14g notes
 *    `we:backlog/2561-…` quotes `we:AGENTS.md`). "Exclude/strip one path" is never total content
 *    exclusion of that path's text.
 * 3. **No agent-driven adversarial confirmation that the combined recipe is sealed** (14g): two
 *    attempts to have an agent red-team it both refused to run anything, even reframed as authorized
 *    testing of the repo's own sandbox. The evidence behind this backend is mechanism-level (the
 *    direct command matrix in 14e/14f) plus one realistic non-adversarial live run (14g) — a real,
 *    useful bar, but not an adversarial-isolation guarantee, and this header does not claim one.
 *
 * @param {object} [options]
 * @param {(file: string, argv: string[], options: object) => Promise<unknown>} [options.execFn]
 *   execFile-compatible promise function; must reject on nonzero exit. Injected for tests.
 * @param {string[]} [options.targetPaths] - Repo-relative paths to strip from history. Defaults to
 *   `['AGENTS.md']` (the root doctrine file Probe 14 targets).
 * @param {string[]} [options.extraDenyPaths] - Additional absolute paths/globs folded into the
 *   returned `codexConfigArgs`, beyond `targetPaths` (as `/**\/<path>` globs) and the source tree
 *   itself (both the exact path and a `/**` glob under it).
 * @returns {IsolationProvider}
 */
export function createNativeDenyWithHistoryStripIsolationProvider({
  execFn = promisify(execFile), targetPaths = ['AGENTS.md'], extraDenyPaths = [],
} = {}) {
  return async ({ sourceCwd, scratchParent = tmpdir() }) => {
    // Validate before allocating or executing anything, even with an injected execFn.
    buildHistorySurgeryCloneArgv(sourceCwd, scratchParent);
    buildHistorySurgeryCommands(targetPaths);
    const source = await realpath(sourceCwd);
    const parent = await realpath(scratchParent);
    const ownedRoot = await mkdtemp(join(parent, 'we-isolation-native-'));
    const cwd = join(ownedRoot, 'clone');
    const cleanup = async () => { await rm(ownedRoot, { recursive: true, force: true }); };
    try {
      await execFn('git', buildHistorySurgeryCloneArgv(source, cwd), {
        cwd: parent, encoding: 'utf8', shell: false,
      });
      // Confirm the clone exists even if a broken injected executor reports success.
      await realpath(cwd);
      for (const argv of buildHistorySurgeryCommands(targetPaths)) {
        await execFn('git', argv, { cwd, encoding: 'utf8', shell: false });
      }
      const codexConfigArgs = buildNativeDenyCodexArgs([
        ...targetPaths.map((path) => `/**/${path}`),
        source,
        `${source}/**`,
        ...extraDenyPaths,
      ]);
      return {
        cwd,
        excludedPaths: [...targetPaths],
        guarantee: 'history-stripped-before-start',
        codexConfigArgs,
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
