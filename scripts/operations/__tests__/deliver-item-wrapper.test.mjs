/**
 * @file deliver-item-wrapper.test.mjs — argv-contract coverage for the #3627 minimal-delivery wrapper
 * PROTOTYPE (`we:scripts/operations/deliver-item-wrapper.mjs`). The file is still NOT wired into
 * `dispatch-lane.mjs` and NOT imported by production code — this test exists so the one thing that is a real,
 * load-bearing contract (the `claude` argv `CLAUDE_RESTRICTED_PROVIDER` constructs) cannot silently drift.
 *
 * Mirrors the reasoning `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` is tested for: "the argv
 * IS the contract with the CLI and a test that asserts it is the only thing standing between a flag rename
 * and a silent non-dispatch." `buildRestrictedProviderArgv` is the pure seam extracted from
 * `CLAUDE_RESTRICTED_PROVIDER.spawn` for exactly this reason.
 *
 * This provider replaces an earlier `--bare`-based draft; see the file's own docblock for the real (not
 * assumed) verification trail behind the swap — a `--safe-mode` swap was tried FIRST and independently
 * REJECTED after a real smoke test showed a `--settings=<hooks file>` layered on top of it never fires.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SPAWN_TIMEOUT_MS } from '../dispatch-lane-io.mjs';
import {
  DELIVERY_AGENT_PROVIDERS, DELIVERY_AGENT_SPAWN_TIMEOUT_MS, buildRestrictedProviderArgv,
  resolveItemSpecPathBasename, fillMinimalBrief,
  buildPrBody, writePrBody, openPr,
  runConverge, parseConvergeEditResult, buildConvergeEditorArgv, runConvergeEdit,
  decideParkMode, computeLaneDiffStats,
  resolveLanePath, runGateWithOneRetry, claimItem, runAgentToCompletion,
  buildDeliveryAgentEnv, DELIVERY_HOOKS_SETTINGS, ensureDeliveryHooksSettingsFile,
} from '../deliver-item-wrapper.mjs';

// A real UUID, hardcoded for deterministic assertions (mirrors `crypto.randomUUID()`'s own output shape). Tests
// that need "some UUID, any UUID" instead assert against this regex.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('buildRestrictedProviderArgv', () => {
  it('fresh spawn: uses --restricted (never --bare), an explicit --tools allowlist, --strict-mcp-config, '
    + '--disable-slash-commands, the given --settings file, and -p/--session-id', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).toEqual([
      '--restricted', '--tools', 'Bash,Edit,Write,Read,Glob,Grep', '--strict-mcp-config',
      '--disable-slash-commands', '--settings', '/repo/.operations/hooks.json',
      '-p', '--session-id', 'session-1', 'build item #1234',
    ]);
  });

  it('never emits --bare — the flag this provider replaced (it requires ANTHROPIC_API_KEY/apiKeyHelper and '
    + 'cannot use the operator\'s OAuth/subscription auth)', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).not.toContain('--bare');
  });

  it('never emits --safe-mode — independently smoke-tested and rejected: a --settings-supplied hook layered '
    + 'on top of --safe-mode does not fire (confirmed by running a guard-bash.mjs-denied command through it '
    + 'and observing it execute for real, permission_denials: [])', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'build item #1234', settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).not.toContain('--safe-mode');
  });

  it('resume: drops -p/--session-id, adds --resume <id>, but KEEPS every other flag identical to a fresh '
    + 'spawn (--resume was verified, not assumed, to preserve both auth-without-a-key and hooks-firing)', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 'session-1', prompt: 'fix the gate failure', resumeSessionId: 'session-1',
      settingsFile: '/repo/.operations/hooks.json',
    });
    expect(argv).toEqual([
      '--restricted', '--tools', 'Bash,Edit,Write,Read,Glob,Grep', '--strict-mcp-config',
      '--disable-slash-commands', '--settings', '/repo/.operations/hooks.json',
      '--resume', 'session-1', 'fix the gate failure',
    ]);
    expect(argv).not.toContain('-p');
    expect(argv).not.toContain('--session-id');
  });

  it('--tools is always the explicit allowlist, never "default" — verified: --tools=default does not '
    + 'restore what --restricted removes (a real probe asking for a Bash call under --tools=default came '
    + 'back "no shell tool available")', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 's', prompt: 'p', settingsFile: '/f.json',
    });
    const toolsIdx = argv.indexOf('--tools');
    expect(toolsIdx).toBeGreaterThanOrEqual(0);
    expect(argv[toolsIdx + 1]).toBe('Bash,Edit,Write,Read,Glob,Grep');
    expect(argv[toolsIdx + 1]).not.toBe('default');
  });

  it('--settings always carries the caller-provided hooks-file path verbatim, not a hardcoded default', () => {
    const argv = buildRestrictedProviderArgv({
      sessionId: 's', prompt: 'p', settingsFile: '/some/other/path/hooks.json',
    });
    const settingsIdx = argv.indexOf('--settings');
    expect(argv[settingsIdx + 1]).toBe('/some/other/path/hooks.json');
  });
});

describe('DELIVERY_AGENT_PROVIDERS registry', () => {
  it('registers the real provider under the renamed key "claude-restricted" (was "claude-bare")', () => {
    expect(DELIVERY_AGENT_PROVIDERS['claude-bare']).toBeUndefined();
    expect(DELIVERY_AGENT_PROVIDERS['claude-restricted']).toBeDefined();
    expect(DELIVERY_AGENT_PROVIDERS['claude-restricted'].name).toBe('claude-restricted');
  });

  it('keeps the codex seam a named, deliberately-throwing placeholder (provider parity, #3627 requirement 6)', () => {
    expect(DELIVERY_AGENT_PROVIDERS.codex).toBeDefined();
    expect(() => DELIVERY_AGENT_PROVIDERS.codex.spawn()).toThrow(/no real implementation/);
  });
});

// ================================================================================================
// #3627 bug 6 (live #3371 attempt, confirmed 2026-09-09) — `CLAUDE_RESTRICTED_PROVIDER.spawn` passed only
// `env` to `defaultSpawnAgent`, so it silently inherited `dispatch-lane-io.mjs`'s `SPAWN_TIMEOUT_MS` (60s) —
// correct for that file's OTHER, fire-and-forget caller (`defaultClaudeProvider`'s `claude --bg`), but fatal
// here: this spawn is a BLOCKING call for the delivery agent's entire build+gate+converge turn (this file's
// own "BLOCKS — the only 'wait'" comment). Two real attempts died at ~60-64s (`ETIMEDOUT`/SIGKILL) before any
// build work could finish. This suite asserts the fix at the one place a mock generically covering the spawn
// call (as every other test in this file does via a stubbed `provider.spawn`) would silently miss it: the
// actual options object `CLAUDE_RESTRICTED_PROVIDER.spawn` hands to its underlying spawn call — exercised via
// the `spawn`/`ensureSettingsFile` `io` seam this fix added (mirrors this file's existing `{ run: runFn = run }`
// injection pattern, e.g. `runGateWithOneRetry`), so the real code path runs with no real filesystem write and
// no real `claude` process.
// ================================================================================================
describe('CLAUDE_RESTRICTED_PROVIDER.spawn timeout (#3627 bug 6)', () => {
  // #3627 bug 7 — `spawn` now also resolves the real lane path (via the injectable `resolveLane` seam) before
  // it can build `cwd`/`env`, so every fake `io` in this describe block needs a `resolveLane` stub too (never
  // the real `resolveLanePath`, which would shell a real `lane-pool.mjs status --json` this suite's sandboxed
  // environment cannot run).
  const fakeIo = () => ({
    ensureSettingsFile: vi.fn(() => '/fake/.operations/delivery-agent-hooks-settings.json'),
    spawnAgent: vi.fn(),
    resolveLane: vi.fn(() => '/fake/pool/lane-3'),
  });

  it('passes an explicit `timeout` to the underlying spawn call, distinct from and far larger than '
    + 'SPAWN_TIMEOUT_MS (the 60s budget correct only for defaultClaudeProvider\'s fire-and-forget '
    + '`claude --bg` caller)', () => {
    const io = fakeIo();
    DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: '55555555-5555-4555-8555-555555555555', prompt: 'build item #3371', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: '' },
      io,
    );

    expect(io.spawnAgent).toHaveBeenCalledTimes(1);
    const [, opts] = io.spawnAgent.mock.calls[0];
    expect(opts.timeout).toBeDefined();
    expect(opts.timeout).not.toBe(SPAWN_TIMEOUT_MS);
    expect(opts.timeout).toBeGreaterThan(SPAWN_TIMEOUT_MS);
    expect(opts.timeout).toBe(DELIVERY_AGENT_SPAWN_TIMEOUT_MS);
  });

  it('DELIVERY_AGENT_SPAWN_TIMEOUT_MS itself is a generous-but-bounded budget (at least 30 real minutes, '
    + 'never Infinity/unlimited — a genuinely wedged agent must still be reclaimed)', () => {
    expect(DELIVERY_AGENT_SPAWN_TIMEOUT_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(Number.isFinite(DELIVERY_AGENT_SPAWN_TIMEOUT_MS)).toBe(true);
  });

  it('still forwards the WE_DISPATCH_KIND=delivery env stamp alongside the timeout override (#3627 hardening, '
    + 'unaffected by the timeout fix)', () => {
    const io = fakeIo();
    DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: '66666666-6666-4666-8666-666666666666', prompt: 'build item #3371', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: '' },
      io,
    );
    const [, opts] = io.spawnAgent.mock.calls[0];
    expect(opts.env.WE_DISPATCH_KIND).toBe('delivery');
  });

  it('the un-overridden `io` defaults name the REAL `ensureDeliveryHooksSettingsFile`/`defaultSpawnAgent`/'
    + '`resolveLanePath`/`run` — a source-level check (rather than a real fs/process call, which this suite\'s '
    + 'environment cannot make reliably against this file\'s `import.meta.url`-derived REPO_ROOT) that every '
    + 'injected seam is opt-in for tests only, never a second code path production takes', () => {
    const spawnSource = DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn.toString();
    expect(spawnSource).toContain('ensureSettingsFile = ensureDeliveryHooksSettingsFile');
    // The test transform rewrites imported references to a namespaced `__vite_ssr_import_N__.<name>` —
    // assert on the stable suffix, not the whole identifier.
    expect(spawnSource).toMatch(/spawnAgent = [\w.]*\bdefaultSpawnAgent\b/);
    expect(spawnSource).toMatch(/resolveLane = [\w.]*\bresolveLanePath\b/);
    expect(spawnSource).toMatch(/run: runFn = [\w.]*\brun\b/);
  });
});

// ================================================================================================
// #3627 bug 7 (live #3371 attempt, confirmed 2026-09-09) — `CLAUDE_RESTRICTED_PROVIDER.spawn` (and
// `runConvergeEdit`'s own `claude` spawn) never passed a `cwd`, so the spawned agent inherited whatever
// directory the WRAPPER's own node process happened to run from — never the lane clone — and `--restricted`
// confines its file tools to the process's own working directories, so the agent was sandboxed into the wrong
// repo entirely. Separately, the brief's `$LANE`/`$DELIVERY_SESSION`/`$DELIVERY_ITEM` env vars
// (`skills-src/conveyor/delivery-agent-brief-v2.md` uses them directly, e.g. `--session=$DELIVERY_SESSION`)
// were only ever appended as literal TEXT at the end of the prompt, never set as real process env. This suite
// asserts both fixes at the one place a stubbed `provider.spawn` (every OTHER describe block in this file)
// would silently miss them: the real options object handed to the underlying spawn call.
// ================================================================================================
describe('CLAUDE_RESTRICTED_PROVIDER.spawn real cwd + env (#3627 bug 7)', () => {
  const fakeIo = (overrides = {}) => ({
    ensureSettingsFile: vi.fn(() => '/fake/.operations/delivery-agent-hooks-settings.json'),
    spawnAgent: vi.fn(),
    resolveLane: vi.fn(() => '/real/pool/lane-3'),
    ...overrides,
  });

  it('resolves the real lane path via the injected `resolveLane` (mirrors `resolveLanePath`\'s own `run` '
    + 'seam) and passes it as `cwd` to the underlying spawn call — never the wrapper\'s own REPO_ROOT', () => {
    const io = fakeIo();
    DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: '77777777-7777-4777-8777-777777777777', prompt: 'build item #3371', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: '' },
      io,
    );
    expect(io.resolveLane).toHaveBeenCalledWith(3, expect.objectContaining({ run: expect.any(Function) }));
    const [, opts] = io.spawnAgent.mock.calls[0];
    expect(opts.cwd).toBe('/real/pool/lane-3');
  });

  it('the spawn\'s `env` carries all four real DELIVERY_SESSION/DELIVERY_ITEM/LANE/ATTEMPT_TAG values — real '
    + 'process env vars, never only the old text-appended `[env: ...]` prompt footer', () => {
    const io = fakeIo();
    DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: '88888888-8888-4888-8888-888888888888', prompt: 'build item #3371', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: 'b' },
      io,
    );
    const [, opts] = io.spawnAgent.mock.calls[0];
    expect(opts.env.DELIVERY_SESSION).toBe('conveyor-3371');
    expect(opts.env.DELIVERY_ITEM).toBe('3371');
    expect(opts.env.LANE).toBe('/real/pool/lane-3'); // the RESOLVED path, never the bare lane number
    expect(opts.env.ATTEMPT_TAG).toBe('b');
  });

  it('ATTEMPT_TAG falls back to the empty string, matching the old footer\'s `attemptTag ?? \'\'` behavior', () => {
    const io = fakeIo();
    DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: '99999999-9999-4999-8999-999999999999', prompt: 'p', lane: 3, sessionSlug: 's', item: '1' },
      io,
    );
    const [, opts] = io.spawnAgent.mock.calls[0];
    expect(opts.env.ATTEMPT_TAG).toBe('');
  });

  it('captures the spawned child\'s stdout/stderr and persists them via the injected `persistFailure` seam '
    + 'when the underlying spawn throws — the observability fix, so a future failure does not require hunting '
    + 'down the agent\'s own transcript by UUID', () => {
    const failure = Object.assign(new Error('spawnSync claude ETIMEDOUT'), {
      stdout: 'partial agent output before the timeout\n',
      stderr: 'some stderr line\n',
      status: null,
      signal: 'SIGKILL',
    });
    const io = fakeIo({ spawnAgent: vi.fn(() => { throw failure; }) });
    const persistFailure = vi.fn();

    expect(() => DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', prompt: 'p', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: '' },
      { ...io, persistFailure },
    )).toThrow('spawnSync claude ETIMEDOUT');

    expect(persistFailure).toHaveBeenCalledTimes(1);
    const [sessionSlugArg, errorArg, optsArg] = persistFailure.mock.calls[0];
    expect(sessionSlugArg).toBe('conveyor-3371');
    expect(errorArg).toBe(failure);
    expect(errorArg.stdout).toContain('partial agent output');
    expect(errorArg.stderr).toContain('some stderr line');
    expect(optsArg.resumeSessionId).toBe(null);
  });

  it('still throws the original error after capturing it — the capture is observability, never a swallow', () => {
    const io = fakeIo({ spawnAgent: vi.fn(() => { throw new Error('boom'); }) });
    expect(() => DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      { sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', prompt: 'p', lane: 3, sessionSlug: 's', item: '1', attemptTag: '' },
      { ...io, persistFailure: vi.fn() },
    )).toThrow('boom');
  });

  it('a resume\'s captured failure is tagged with the resumeSessionId (so it never clobbers the fresh spawn\'s '
    + 'own capture, which uses the same sessionSlug)', () => {
    const io = fakeIo({ spawnAgent: vi.fn(() => { throw new Error('resume boom'); }) });
    const persistFailure = vi.fn();
    expect(() => DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn(
      {
        sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', resumeSessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        prompt: 'fix the gate failure', lane: 3, sessionSlug: 'conveyor-3371', item: '3371', attemptTag: '',
      },
      { ...io, persistFailure },
    )).toThrow('resume boom');
    const [, , optsArg] = persistFailure.mock.calls[0];
    expect(optsArg.resumeSessionId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });
});

// `persistDeliverySpawnFailure`'s actual real-fs behavior (what it writes, and that it never throws) is
// exercised end-to-end above via the injectable `persistFailure` seam (`CLAUDE_RESTRICTED_PROVIDER.spawn real
// cwd + env` describe block) — the SAME "assert the seam is invoked correctly, never the real REPO_ROOT-backed
// fs write" convention this suite already established for `ensureSettingsFile`/`spawnAgent`/`resolveLane`
// (their own real defaults are checked at the SOURCE level just below, not by actually calling them: this
// file's `import.meta.url`-derived `REPO_ROOT` does not resolve reliably inside vitest's SSR transform — see
// the pre-existing "un-overridden `io` defaults" test's own comment for why). This block asserts the same
// thing for `persistDeliverySpawnFailure`'s un-overridden default and for the removed stale-file guard.
describe('persistDeliverySpawnFailure / ensureDeliveryHooksSettingsFile un-overridden defaults (#3627 bug 7/8, '
  + 'source-level — see the comment above for why this suite checks these at the source level)', () => {
  it('CLAUDE_RESTRICTED_PROVIDER.spawn\'s un-overridden `persistFailure` default names the REAL '
    + '`persistDeliverySpawnFailure`, not a second, untested code path', () => {
    const spawnSource = DELIVERY_AGENT_PROVIDERS['claude-restricted'].spawn.toString();
    expect(spawnSource).toMatch(/persistFailure = [\w.]*\bpersistDeliverySpawnFailure\b/);
  });

  it('ensureDeliveryHooksSettingsFile no longer guards the write behind `if (!existsSync(path))` — the bug 8 '
    + 'correctness fix: a stale pre-fix file (no permissions.allow) must never survive a later call', () => {
    const source = ensureDeliveryHooksSettingsFile.toString();
    expect(source).not.toContain('existsSync');
    expect(source).toContain('writeFileSync');
    expect(source).toContain('mkdirSync');
  });
});

// ================================================================================================
// Gap 1 — fillMinimalBrief was a PLACEHOLDER that left `{{ITEM_SPEC_PATH_BASENAME}}`'s literal token-name
// text in the agent's prompt. It now reuses `dispatch-lane.mjs#fillBrief` for real substitution, resolving the
// item's actual backlog filename through the SAME `findItem` every other launch kind uses.
// ================================================================================================
describe('fillMinimalBrief / resolveItemSpecPathBasename (#3627 gap 1)', () => {
  const fakeLoadItems = () => [
    { num: '1234', slug: 'do-the-thing', scope: ['we:scripts/lib/foo.mjs'] },
  ];

  it('resolveItemSpecPathBasename resolves the REAL backlog filename basename via findItem, not a guess', () => {
    expect(resolveItemSpecPathBasename('1234', fakeLoadItems)).toBe('1234-do-the-thing.md');
  });

  it('resolveItemSpecPathBasename throws a named error when the item cannot be found — never substitutes a placeholder', () => {
    expect(() => resolveItemSpecPathBasename('9999', fakeLoadItems)).toThrow(/could not resolve a backlog filename for item #9999/);
  });

  it('fillMinimalBrief substitutes the REAL filename into the brief — never the literal placeholder-name string the sketch left behind', () => {
    const template = 'Read your spec at backlog/{{ITEM_SPEC_PATH_BASENAME}}. Build exactly that.';
    const prompt = fillMinimalBrief(
      template,
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '' },
      { loadItems: fakeLoadItems },
    );
    expect(prompt).toContain('backlog/1234-do-the-thing.md');
    expect(prompt).not.toContain('{{ITEM_SPEC_PATH_BASENAME}}');
    expect(prompt).not.toContain("item's actual backlog filename for #1234");
  });

  it('fillMinimalBrief still appends the env footer after the real fillBrief substitution', () => {
    const prompt = fillMinimalBrief(
      '{{ITEM_SPEC_PATH_BASENAME}}',
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: 'b' },
      { loadItems: fakeLoadItems },
    );
    expect(prompt).toMatch(/\[env: DELIVERY_SESSION=conveyor-1234 DELIVERY_ITEM=1234 LANE=7 ATTEMPT_TAG=b\]$/);
  });

  it('fillMinimalBrief refuses (via the real fillBrief) rather than substituting a value with unsafe characters', () => {
    const unsafeLoadItems = () => [{ num: '1234', slug: 'x`echo pwned`y', scope: [] }];
    expect(() => fillMinimalBrief(
      '{{ITEM_SPEC_PATH_BASENAME}}',
      { item: '1234', sessionSlug: 's', lane: 1, attemptTag: '' },
      { loadItems: unsafeLoadItems },
    )).toThrow(/characters the brief cannot carry safely/);
  });
});

// ================================================================================================
// Gap 2 — openPr read `${lane}/.pr-body.md`, a file nothing ever wrote (ENOENT the moment a real run reached
// PR-open). `buildPrBody`/`writePrBody` now generate and write a real, minimal body first.
// ================================================================================================
describe('buildPrBody / writePrBody (#3627 gap 2)', () => {
  it('pulls the one-line summary from the delivery agent\'s own report reason, and names the item', () => {
    const body = buildPrBody({ item: '1234', report: { reason: 'Implements the missing FooBar validator.', filesTouched: [] } });
    expect(body).toContain('#1234');
    expect(body).toContain('Implements the missing FooBar validator.');
  });

  it('falls back to a generic, still-accurate summary when the report carries no reason (allowed on a `done` outcome)', () => {
    const body = buildPrBody({ item: '5678', report: { outcome: 'done', reason: null, filesTouched: [] } });
    expect(body).toContain('#5678');
    expect(body).toMatch(/Delivers item #5678/);
  });

  it('lists filesTouched when the report carries them', () => {
    const body = buildPrBody({ item: '1234', report: { reason: null, filesTouched: ['scripts/lib/foo.mjs', 'scripts/lib/__tests__/foo.test.mjs'] } });
    expect(body).toContain('scripts/lib/foo.mjs');
    expect(body).toContain('scripts/lib/__tests__/foo.test.mjs');
  });

  it('carries a standard footer identifying the mechanical pipeline', () => {
    const body = buildPrBody({ item: '1234', report: { reason: 'x', filesTouched: [] } });
    expect(body).toMatch(/#3627 minimal delivery-agent pipeline/);
  });

  it('writePrBody writes buildPrBody\'s exact content to `${lane}/.pr-body.md` and returns that path', () => {
    const writeFile = vi.fn();
    const report = { reason: 'Implements the thing.', filesTouched: [] };
    const path = writePrBody({ item: '1234', lane: '/lanes/lane-1', report }, { writeFile });
    expect(path).toBe('/lanes/lane-1/.pr-body.md');
    expect(writeFile).toHaveBeenCalledWith('/lanes/lane-1/.pr-body.md', buildPrBody({ item: '1234', report }));
  });
});

// ================================================================================================
// Gap 3 — runConverge called `converge-cli.mjs step` exactly once and returned it as if that were the whole
// loop. It now calls `init`, then loops `step` — executing whatever action is printed (`read`/`panel`/
// `edit`/`red-team`/`invite`) — until the action is genuinely `land` or `escalate`.
// ================================================================================================
describe('runConverge (#3627 gap 3 — the real loop)', () => {
  let lane;

  beforeEach(() => {
    lane = mkdtempSync(join(tmpdir(), 'deliver-item-wrapper-converge-'));
  });

  afterEach(() => {
    rmSync(lane, { recursive: true, force: true });
  });

  /** A scripted fake `run` — routes on argv shape, never on call order, so it stays correct regardless of how
   *  many times any one action's sub-driver calls it internally. `steps` is consumed in order for `step` calls
   *  only (the ONE sequence genuinely order-dependent: each `step` answers "what happens after the observation
   *  I was just fed"). */
  function fakeRun({ init, read = 'diff --git a/x b/x\n+hi\n', panel, redTeamPanel, editor, steps }) {
    let stepIdx = 0;
    const calls = [];
    const fn = vi.fn((cmd, args = [], opts) => {
      calls.push({ cmd, args, opts });
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'init') return init;
      if (cmd === 'bash') return read;
      if (cmd === 'node' && args[0] === 'skills-src/jury/panel-fanout.mjs') {
        const isRedTeam = args.some((a) => String(a).includes('-redteam'));
        return isRedTeam ? redTeamPanel : panel;
      }
      if (cmd === 'claude') return editor;
      if (cmd === 'node' && args[0] === 'scripts/converge-cli.mjs' && args[1] === 'step') {
        if (stepIdx >= steps.length) throw new Error(`fakeRun: no scripted step left for call #${stepIdx + 1}`);
        return steps[stepIdx++];
      }
      throw new Error(`fakeRun: unexpected run(${cmd}, ${JSON.stringify(args)})`);
    });
    fn.calls = calls;
    return fn;
  }

  it('loops through read → panel → edit → red-team → land, calling `step` MORE THAN ONCE (the actual gap)', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: ['correctness'], seatableLenses: ['correctness'], mandatoryLenses: ['correctness'],
      read: { command: 'git diff', cwd: lane },
    });
    const panelStep = JSON.stringify({
      action: 'panel', round: 1, roundCap: 5,
      panel: [{ lens: 'correctness', jurors: 1, mandatory: true, mandate: 'judge it' }],
    });
    const editStep = JSON.stringify({
      action: 'edit', round: 1, roundCap: 5, edit: { prompt: 'fix the findings' },
    });
    const redTeamStep = JSON.stringify({
      action: 'red-team', round: 2, roundCap: 5,
      redTeam: { jury: [{ lens: 'correctness', prompt: 'try to break it' }] },
    });
    const landStep = JSON.stringify({ action: 'land', round: 2, roundCap: 5, verdict: 'land', dismissed: [] });

    const run = fakeRun({
      init,
      panel: JSON.stringify({ seats: [{ lens: 'correctness', ok: true, findings: [] }] }),
      redTeamPanel: JSON.stringify({ seats: [{ lens: 'correctness', ok: true, findings: [] }] }),
      editor: JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }),
      steps: [panelStep, editStep, redTeamStep, landStep],
    });

    const result = runConverge(
      { lane, item: '1234', goal: 'ship the thing' },
      { run, ensureSettingsFile: () => '/fake/hooks-settings.json' },
    );

    expect(result.action).toBe('land');
    expect(result.verdict).toBe('land');

    const stepCalls = run.calls.filter((c) => c.cmd === 'node' && c.args[1] === 'step');
    expect(stepCalls.length).toBe(4); // proves the loop, not a single call mistaken for the whole thing
    const initCalls = run.calls.filter((c) => c.cmd === 'node' && c.args[1] === 'init');
    expect(initCalls.length).toBe(1);
    expect(run.calls.some((c) => c.cmd === 'claude')).toBe(true); // the editor round actually ran
    expect(run.calls.filter((c) => c.cmd === 'node' && c.args[0] === 'skills-src/jury/panel-fanout.mjs').length).toBe(2); // panel + red-team
  });

  it('stops on `escalate` without ever needing an edit/panel round', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: ['correctness'], seatableLenses: ['correctness'], mandatoryLenses: ['correctness'],
      read: { command: 'git diff', cwd: lane },
    });
    const escalateStep = JSON.stringify({
      action: 'escalate', round: 1, roundCap: 5, verdict: null,
      reason: 'mandatory-lens-absent', dismissed: [],
    });
    const run = fakeRun({ init, steps: [escalateStep] });

    const result = runConverge({ lane, item: '1234' }, { run, ensureSettingsFile: () => '/fake/hooks.json' });

    expect(result.action).toBe('escalate');
    expect(result.reason).toBe('mandatory-lens-absent');
  });

  it('throws a named error if converge-cli reports an action this loop does not recognize (fails loud, not silently)', () => {
    const init = JSON.stringify({
      action: 'read', round: 1, careLevel: 'elevated', jurorsPerLens: 1, roundCap: 5,
      lenses: [], seatableLenses: [], mandatoryLenses: [],
      read: { command: 'git diff', cwd: lane },
    });
    const weirdStep = JSON.stringify({ action: 'teleport', round: 1, roundCap: 5 });
    const run = fakeRun({ init, steps: [weirdStep] });

    expect(() => runConverge({ lane, item: '1234' }, { run, ensureSettingsFile: () => '/fake/hooks.json' }))
      .toThrow(/action this loop does not know how to run.*teleport/s);
  });
});

describe('parseConvergeEditResult (#3627 gap 3 helper)', () => {
  it('parses the two JSON layers of a real --output-format json editor reply', () => {
    const raw = JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [{ summary: 'x', reason: 'not real' }] }) });
    expect(parseConvergeEditResult(raw)).toEqual({ advanced: true, dismissed: [{ summary: 'x', reason: 'not real' }] });
  });

  it('degrades to {advanced:false, dismissed:[]} on unparseable output — fail-closed, matches an editor-stall escalation, never throws', () => {
    expect(parseConvergeEditResult('not json at all')).toEqual({ advanced: false, dismissed: [] });
  });
});

describe('buildConvergeEditorArgv (#3627 gap 3 helper)', () => {
  it('is a FRESH restricted spawn (never --resume) carrying --output-format json for a parseable reply', () => {
    const argv = buildConvergeEditorArgv({ sessionId: 'item-converge-editor-r1', prompt: 'fix it', settingsFile: '/f.json' });
    expect(argv).toContain('--restricted');
    expect(argv).not.toContain('--safe-mode');
    expect(argv).not.toContain('--resume');
    expect(argv).toEqual(expect.arrayContaining(['--output-format', 'json']));
    expect(argv[argv.length - 1]).toBe('fix it');
  });
});

// ================================================================================================
// Bug 5 — a live #3371 attempt failed with `Error: Invalid session ID. Must be a valid UUID.` because the
// Claude CLI's own `--session-id`/`--resume` flag was fed the human-readable dispatch id (`sessionSlug`, e.g.
// `conveyor-3371`) instead of a real UUID. Fixed by minting a UUID once per delivery attempt and threading it
// through as `claudeSessionId`, kept entirely separate from `sessionSlug` (which keeps its existing job
// everywhere else — claim/release, the delivery-report lookup, the brief's own env footer, lane-pool's
// `--session=`).
// ================================================================================================
describe('runAgentToCompletion (#3627 bug 5 — real UUID session id, never sessionSlug)', () => {
  const fakeLoadItems = () => [{ num: '1234', slug: 'do-the-thing', scope: [] }];

  it('passes claudeSessionId — a real UUID — as `sessionId` to provider.spawn, never sessionSlug', async () => {
    const claudeSessionId = '11111111-1111-4111-8111-111111111111';
    const provider = { spawn: vi.fn() };
    const readReport = vi.fn(() => ({ status: 'done', outcome: 'done', filesTouched: ['a.mjs'] }));

    await runAgentToCompletion(
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '', provider, claudeSessionId },
      { readBrief: () => 'Read backlog/{{ITEM_SPEC_PATH_BASENAME}}.', readReport, loadItems: fakeLoadItems },
    );

    expect(provider.spawn).toHaveBeenCalledTimes(1);
    const call = provider.spawn.mock.calls[0][0];
    expect(call.sessionId).toBe(claudeSessionId);
    expect(call.sessionId).toMatch(UUID_RE);
    expect(call.sessionId).not.toBe('conveyor-1234');
  });

  it('still looks up the delivery report by sessionSlug, not by claudeSessionId — the report sidecar is keyed '
    + 'by the human-readable dispatch id', async () => {
    const readReport = vi.fn(() => ({ status: 'done', outcome: 'done', filesTouched: [] }));
    await runAgentToCompletion(
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '', provider: { spawn: vi.fn() }, claudeSessionId: 'ignored-in-this-assertion' },
      { readBrief: () => 'x', readReport, loadItems: fakeLoadItems },
    );
    expect(readReport).toHaveBeenCalledWith('conveyor-1234');
  });

  it('the brief env footer still carries sessionSlug (DELIVERY_SESSION), never claudeSessionId', async () => {
    const provider = { spawn: vi.fn() };
    await runAgentToCompletion(
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '', provider, claudeSessionId: '22222222-2222-4222-8222-222222222222' },
      { readBrief: () => '{{ITEM_SPEC_PATH_BASENAME}}', readReport: () => ({ status: 'done', outcome: 'done', filesTouched: [] }), loadItems: fakeLoadItems },
    );
    const { prompt } = provider.spawn.mock.calls[0][0];
    expect(prompt).toMatch(/\[env: DELIVERY_SESSION=conveyor-1234 /);
    expect(prompt).not.toContain('22222222-2222-4222-8222-222222222222');
  });

  it('throws when no done report comes back, unchanged from before this fix', async () => {
    await expect(runAgentToCompletion(
      { item: '1234', sessionSlug: 'conveyor-1234', lane: 7, attemptTag: '', provider: { spawn: vi.fn() }, claudeSessionId: 'x' },
      { readBrief: () => 'x', readReport: () => null, loadItems: fakeLoadItems },
    )).rejects.toThrow(/exited with no done report/);
  });
});

describe('runConvergeEdit (#3627 bug 5 — real UUID session id, not the old readable per-round string)', () => {
  it('spawns with a real-UUID --session-id, never the old `${item}-converge-editor-r${round}` literal', () => {
    const run = vi.fn(() => JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }));
    runConvergeEdit(
      { prompt: 'fix it' },
      { item: '1234', round: 1, run, ensureSettingsFile: () => '/fake/hooks.json' },
    );
    expect(run).toHaveBeenCalledTimes(1);
    const [cmd, argv] = run.mock.calls[0];
    expect(cmd).toBe('claude');
    const idIdx = argv.indexOf('--session-id');
    expect(idIdx).toBeGreaterThanOrEqual(0);
    expect(argv[idIdx + 1]).toMatch(UUID_RE);
    expect(argv[idIdx + 1]).not.toBe('1234-converge-editor-r1');
  });

  it('mints a fresh UUID per call (each converge round is its own, never-resumed session)', () => {
    const run = vi.fn(() => JSON.stringify({ result: JSON.stringify({ advanced: false, dismissed: [] }) }));
    const deps = { item: '1234', round: 1, run, ensureSettingsFile: () => '/fake/hooks.json' };
    runConvergeEdit({ prompt: 'a' }, deps);
    runConvergeEdit({ prompt: 'b' }, deps);
    const id1 = run.mock.calls[0][1][run.mock.calls[0][1].indexOf('--session-id') + 1];
    const id2 = run.mock.calls[1][1][run.mock.calls[1][1].indexOf('--session-id') + 1];
    expect(id1).not.toBe(id2);
  });

  it('accepts an injected newSessionId for a deterministic assertion', () => {
    const run = vi.fn(() => JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }));
    runConvergeEdit(
      { prompt: 'fix it' },
      { item: '1234', round: 2, run, ensureSettingsFile: () => '/fake/hooks.json', newSessionId: () => 'fixed-uuid-for-test' },
    );
    const argv = run.mock.calls[0][1];
    expect(argv[argv.indexOf('--session-id') + 1]).toBe('fixed-uuid-for-test');
  });

  // #3627 bug 7 — this spawn never passed a `cwd`, so it inherited the wrapper's own REPO_ROOT (the module
  // `run` helper's own default) instead of the lane, hitting the exact same `--restricted`
  // confined-to-working-directory sandboxing bug 7's delivery-agent spawn did.
  it('(#3627 bug 7) passes `lane` as the real `cwd` to the underlying run call — never the wrapper\'s own '
    + 'REPO_ROOT', () => {
    const run = vi.fn(() => JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }));
    runConvergeEdit(
      { prompt: 'fix it' },
      { item: '1234', round: 1, lane: '/real/pool/lane-3', run, ensureSettingsFile: () => '/fake/hooks.json' },
    );
    const [, , opts] = run.mock.calls[0];
    expect(opts.cwd).toBe('/real/pool/lane-3');
  });

  it('(#3627 bug 7) stamps WE_DISPATCH_KIND=delivery on the editor spawn too, same channel as the delivery '
    + 'agent\'s own spawn', () => {
    const run = vi.fn(() => JSON.stringify({ result: JSON.stringify({ advanced: true, dismissed: [] }) }));
    runConvergeEdit(
      { prompt: 'fix it' },
      { item: '1234', round: 1, lane: '/real/pool/lane-3', run, ensureSettingsFile: () => '/fake/hooks.json' },
    );
    const [, , opts] = run.mock.calls[0];
    expect(opts.env.WE_DISPATCH_KIND).toBe('delivery');
  });
});

describe('buildDeliveryAgentEnv (#3627 bug 7 helper — the real env vars the brief actually needs)', () => {
  it('returns all four real values plus the existing WE_DISPATCH_KIND stamp', () => {
    const env = buildDeliveryAgentEnv({
      sessionSlug: 'conveyor-3371', item: '3371', lanePath: '/real/pool/lane-3', attemptTag: 'b',
    });
    expect(env).toEqual({
      WE_DISPATCH_KIND: 'delivery',
      DELIVERY_SESSION: 'conveyor-3371',
      DELIVERY_ITEM: '3371',
      LANE: '/real/pool/lane-3',
      ATTEMPT_TAG: 'b',
    });
  });

  it('LANE is the RESOLVED path, never the bare lane number — the brief runs `cd $LANE`/`printenv LANE` and '
    + 'expects a real directory', () => {
    const env = buildDeliveryAgentEnv({ sessionSlug: 's', item: '1', lanePath: '/real/pool/lane-9', attemptTag: '' });
    expect(env.LANE).toBe('/real/pool/lane-9');
    expect(env.LANE).not.toBe(9);
    expect(env.LANE).not.toBe('9');
  });

  it('ATTEMPT_TAG falls back to the empty string when omitted, matching the old footer\'s behavior', () => {
    const env = buildDeliveryAgentEnv({ sessionSlug: 's', item: '1', lanePath: '/lane' });
    expect(env.ATTEMPT_TAG).toBe('');
  });

  it('DELIVERY_ITEM is always a string, even when item is handed in as a number', () => {
    const env = buildDeliveryAgentEnv({ sessionSlug: 's', item: 1234, lanePath: '/lane', attemptTag: '' });
    expect(env.DELIVERY_ITEM).toBe('1234');
  });
});

// ================================================================================================
// #3627 bug 8 (live #3371 attempt, confirmed 2026-09-09) — the generated hooks-only settings file carried only
// a `hooks` block. Under `--restricted` the CLI ignores the repo's normal project/user permissions files
// entirely, so with no `permissions.allow` in THIS file, an ordinary headless command (confirmed live: even
// `git --version`, `node -e ...`) came back "This command requires approval" with nobody there to approve it —
// this blocked the ONE sanctioned output channel the brief describes (`delivery-report-cli.mjs report`).
// ================================================================================================
describe('DELIVERY_HOOKS_SETTINGS permissions.allow (#3627 bug 8)', () => {
  it('carries a non-empty permissions.allow', () => {
    expect(Array.isArray(DELIVERY_HOOKS_SETTINGS.permissions?.allow)).toBe(true);
    expect(DELIVERY_HOOKS_SETTINGS.permissions.allow.length).toBeGreaterThan(0);
  });

  it('allow is exactly the same six bare tool names granted via --tools (RESTRICTED_PROVIDER_TOOLS) — broad '
    + 'enough to stop ordinary build/test/git commands from needing interactive approval, but never wider than '
    + 'the tool set --restricted already exposes; a hand-enumerated narrower "safe command" allowlist is '
    + 'deliberately NOT what this is (see the constant\'s own docblock: guard-bash.mjs/guard-lane.mjs are the '
    + 'real safety boundary, not this list)', () => {
    expect(DELIVERY_HOOKS_SETTINGS.permissions.allow).toEqual(['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep']);
  });

  it('every allow entry is a BARE tool name (this repo\'s own .claude/settings.json real syntax for an '
    + 'unconditional per-tool allow), never a narrower Tool(pattern:*) entry that would just be the brittle '
    + 'hand-enumerated list this fix is deliberately avoiding', () => {
    for (const entry of DELIVERY_HOOKS_SETTINGS.permissions.allow) {
      expect(entry).not.toContain('(');
    }
  });

  it('the hooks block is unchanged by the permissions addition — still exactly guard-lane.mjs + guard-bash.mjs', () => {
    expect(DELIVERY_HOOKS_SETTINGS.hooks.PreToolUse).toHaveLength(2);
    expect(DELIVERY_HOOKS_SETTINGS.hooks.PreToolUse[0].matcher).toBe('Edit|Write');
    expect(DELIVERY_HOOKS_SETTINGS.hooks.PreToolUse[1].matcher).toBe('Bash');
  });
});

// ================================================================================================
// Gap 4 — decideParkMode skipped the real `scoreEscalation` rubric (statute-touch + needs-human-judgment only).
// It now wires in the FULL real `scoreEscalation` (`scripts/lib/review-escalation.mjs`), including diff-size
// and dismissed-finding signals, via the SAME `producerReviewLabel` mapping `pr-land.mjs` itself uses.
// ================================================================================================
describe('decideParkMode (#3627 gap 4 — the real scoreEscalation rubric)', () => {
  const noVerdict = { verdict: 'land', dismissed: [] };

  it('still parks review:human on a statute-path touch (kept as its own cheap, explicit check)', () => {
    const result = decideParkMode({
      report: { outcome: 'done' }, convergeVerdict: noVerdict,
      filesTouched: ['docs/agent/platform-decisions.md'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'statute/policy-core path touched' });
  });

  it('still parks review:human on the agent\'s own needs-human-judgment outcome', () => {
    const result = decideParkMode({
      report: { outcome: 'needs-human-judgment', reason: 'a genuine taste call' }, convergeVerdict: noVerdict,
      filesTouched: ['scripts/lib/foo.mjs'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'a genuine taste call' });
  });

  it('still parks review:human when converge itself escalated', () => {
    const result = decideParkMode({
      report: { outcome: 'done' }, convergeVerdict: { verdict: 'escalate', reason: 'red-team broke it', dismissed: [] },
      filesTouched: ['scripts/lib/foo.mjs'],
    });
    expect(result).toEqual({ mode: 'park', label: 'review:human', reason: 'red-team broke it' });
  });

  // NOTE — these use `reports/*.md` paths, not `scripts/*`: `scripts/` is itself a real blast-radius surface
  // in `scoreEscalation` (verified directly against `isBlastRadiusPath`), so a `scripts/` path would trip the
  // rubric for a reason unrelated to what each test below is isolating (size, dismissed-findings).

  it('calls the REAL scoreEscalation for a clean small diff and labels ready-to-merge (label-on-green)', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '2\t1\treports/2026-09-09-note.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      { report: { outcome: 'done' }, convergeVerdict: noVerdict, filesTouched: ['reports/2026-09-09-note.md'], lanePath: '/lanes/lane-1' },
      { run },
    );
    expect(result.mode).toBe('label-on-green');
    expect(result.label).toBe('ready-to-merge');
    expect(result.score.escalate).toBe(false);
  });

  it('a LARGE real diff (>= the real 400-line threshold) escalates to review:pending via the real rubric, never silently clears', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '300\t200\treports/2026-09-09-big.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      { report: { outcome: 'done' }, convergeVerdict: noVerdict, filesTouched: ['reports/2026-09-09-big.md'], lanePath: '/lanes/lane-1' },
      { run },
    );
    expect(result.mode).toBe('park');
    expect(result.label).toBe('review:pending');
    expect(result.score.escalate).toBe(true);
    expect(result.score.signals.size).toBeGreaterThanOrEqual(400);
  });

  it('dismissed converge findings (from the real convergeVerdict.dismissed) escalate to review:pending via scoreEscalation', () => {
    const run = vi.fn((cmd, args) => {
      if (args.includes('merge-base')) return 'abc123\n';
      if (args.includes('diff')) return '2\t1\treports/2026-09-09-note.md\n';
      throw new Error(`unexpected: ${cmd} ${args}`);
    });
    const result = decideParkMode(
      {
        report: { outcome: 'done' },
        convergeVerdict: { verdict: 'land', dismissed: [{ summary: 'a finding the editor dismissed', reason: 'not real' }] },
        filesTouched: ['reports/2026-09-09-note.md'],
        lanePath: '/lanes/lane-1',
      },
      { run },
    );
    expect(result.mode).toBe('park');
    expect(result.label).toBe('review:pending');
    expect(result.score.signals.dismissedFindings).toBe(1);
  });

  it('computeLaneDiffStats fails soft to {changedFiles:[], diffLines:0} when git itself fails — never crashes the park decision', () => {
    const run = vi.fn(() => { throw new Error('git exploded'); });
    const stats = computeLaneDiffStats('/lanes/lane-1', { run });
    expect(stats).toEqual({ changedFiles: [], diffLines: 0 });
  });
});

// ================================================================================================
// Bug 1 (found re-reading the file end-to-end before the first real #3371 run) — `openPr`'s PR ref carried a
// literal, never-substituted `<slug>` placeholder (`lane/${item}${attemptTag}-<slug>`), which would have
// produced an invalid ref like `lane/3371-<slug>`. `openPr` is now a PURE function of its params — the caller
// resolves the item's real slug (via `findItem`, same as `resolveItemSpecPathBasename`) and passes it in.
// ================================================================================================
describe('openPr (#3627 bug 1 — the real slug, never the literal <slug> placeholder)', () => {
  // `openPr` writes a real PR-body file via `writePrBody`'s default `writeFileSync` (gap 2's own fix), so
  // these use a real temp dir for `lane` — the same pattern the `runConverge` describe block above uses.
  let lane;
  beforeEach(() => { lane = mkdtempSync(join(tmpdir(), 'deliver-item-wrapper-openpr-')); });
  afterEach(() => { rmSync(lane, { recursive: true, force: true }); });

  it('builds the PR ref using the REAL slug handed in, never the literal "<slug>" placeholder text', () => {
    const run = vi.fn(() => JSON.stringify({ number: 42, url: 'https://example/pr/42' }));
    const report = { reason: 'x', filesTouched: [] };
    const result = openPr(
      { item: '3371', attemptTag: '', lane, park: { mode: 'label-on-green' }, report, slug: 'some-real-slug' },
      { run },
    );
    expect(result).toEqual({ number: 42, url: 'https://example/pr/42' });
    const openPrCall = run.mock.calls.find((c) => c[1]?.[1] === 'open-pr');
    expect(openPrCall).toBeDefined();
    const refFlag = openPrCall[1].find((a) => a.startsWith('--ref='));
    expect(refFlag).toBe('--ref=lane/3371-some-real-slug');
    expect(refFlag).not.toContain('<slug>');
  });

  it('includes the attemptTag between the item number and the real slug when one is given', () => {
    const run = vi.fn(() => JSON.stringify({ number: 1 }));
    openPr(
      { item: '3371', attemptTag: 'b', lane, park: { mode: 'label-on-green' }, report: { reason: 'x', filesTouched: [] }, slug: 'do-the-thing' },
      { run },
    );
    const openPrCall = run.mock.calls.find((c) => c[1]?.[1] === 'open-pr');
    const refFlag = openPrCall[1].find((a) => a.startsWith('--ref='));
    expect(refFlag).toBe('--ref=lane/3371b-do-the-thing');
  });

  it('refuses (throws a named error) rather than opening a PR with no real slug', () => {
    expect(() => openPr({ item: '3371', attemptTag: '', lane, park: { mode: 'label-on-green' }, report: { reason: 'x', filesTouched: [] } }))
      .toThrow(/needs the item's real slug/);
  });

  it('never calls findItem/the backlog loader itself — openPr is a pure function of its params (the caller resolves the slug)', () => {
    // No `loadItems` is threaded through `openPr` at all (removed from its signature on purpose) — this test
    // simply asserts the call succeeds with a bare `run` mock and no backlog-loading machinery in play.
    const run = vi.fn(() => JSON.stringify({ number: 7 }));
    expect(() => openPr(
      { item: '1234', attemptTag: '', lane, park: { mode: 'park', label: 'review:human' }, report: { reason: 'x', filesTouched: [] }, slug: 'x' },
      { run },
    )).not.toThrow();
  });
});

// ================================================================================================
// Bug 2 (found in the same re-read) — `resolveLanePath(lane)` was a hardcoded, relative-path placeholder
// (`${REPO_ROOT}/../.lanes/web-everything/lane-${lane}`) that only resolved correctly when this file happened
// to be imported from the primary checkout root; run from an isolated worktree/clone it silently computed the
// WRONG path. It now shells `scripts/lane-pool.mjs status --json` (the single source of truth
// `lane-pool-paths.mjs`/`verify-lane.mjs` already trust) via an injectable `run` and reads the real `path`
// field off the matching lane entry — never a second, re-derived path computation.
// ================================================================================================
describe('resolveLanePath (#3627 bug 2 — real lane-pool.mjs status --json lookup, not hardcoded path math)', () => {
  const statusJson = (lanes) => JSON.stringify({ repo: 'web-everything', root: '/pool', lanes });

  it('calls lane-pool.mjs status --json (via the injected run) and returns the matching lane\'s real path', () => {
    const run = vi.fn(() => statusJson([
      { lane: 1, path: '/Users/op/workspace/.lanes/web-everything/lane-1', exists: true },
      { lane: 4, path: '/Users/op/workspace/.lanes/web-everything/lane-4', exists: true },
    ]));
    const path = resolveLanePath(4, { run });
    expect(path).toBe('/Users/op/workspace/.lanes/web-everything/lane-4');
    expect(run).toHaveBeenCalledWith('node', ['scripts/lane-pool.mjs', 'status', '--json']);
  });

  it('never derives the path from hardcoded relative-path math — the returned path need not even look like ../.lanes/web-everything/lane-N', () => {
    const run = vi.fn(() => statusJson([
      { lane: 9, path: '/completely/different/pool/location/lane-9', exists: true },
    ]));
    const path = resolveLanePath(9, { run });
    expect(path).toBe('/completely/different/pool/location/lane-9');
  });

  it('throws a named error when no matching lane entry is reported, rather than falling back to a computed path', () => {
    const run = vi.fn(() => statusJson([{ lane: 1, path: '/pool/lane-1', exists: true }]));
    expect(() => resolveLanePath(2, { run })).toThrow(/no entry\/path for lane-2/);
  });
});

describe('runGateWithOneRetry (#3627 bug 2 — threads the injected run through to resolveLanePath; '
  + '#3627 follow-up — routed through the declared `verify` operation, never raw verify-lane.mjs)', () => {
  const verifyOkJson = () => JSON.stringify({
    runId: 'run-1', op: 'verify', stopped: 'complete', applied: [],
    verdict: { ok: true, cwd: '/real/pool/lane-3', suite: 'run', passed: 2, failed: 0, unrun: 0, checks: [], blocking: [] },
  });
  const verifyRedJson = () => JSON.stringify({
    runId: 'run-1', op: 'verify', stopped: 'complete', applied: [],
    verdict: {
      ok: false, cwd: '/real/pool/lane-3', suite: 'run', passed: 1, failed: 1, unrun: 0,
      checks: [{ name: 'test:unit', outcome: 'fail' }],
      blocking: [{ check: 'test:unit', why: 'failed', detail: '3 error(s)' }],
    },
  });

  it('uses the injected run for BOTH the lane-pool.mjs status lookup and the gate itself, calling '
    + '`run.mjs verify --checkout=<resolved lane path> --json` — never raw verify-lane.mjs', () => {
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/lane-pool.mjs') {
        return JSON.stringify({ repo: 'web-everything', root: '/pool', lanes: [{ lane: 3, path: '/real/pool/lane-3', exists: true }] });
      }
      if (args[0] === 'scripts/operations/run.mjs') {
        expect(args).toEqual(['scripts/operations/run.mjs', 'verify', '--checkout=/real/pool/lane-3', '--json']);
        return verifyOkJson();
      }
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const result = runGateWithOneRetry({ lane: 3, item: '3371', sessionSlug: 'conveyor-3371' }, { run });
    expect(result).toEqual({ status: 'green', lanePath: '/real/pool/lane-3' });
    const statusCall = run.mock.calls.find((c) => c[1]?.[0] === 'scripts/lane-pool.mjs');
    expect(statusCall).toBeDefined();
    expect(statusCall[1]).toEqual(['scripts/lane-pool.mjs', 'status', '--json']);
  });

  it('reads `verdict.ok` from the JSON envelope rather than relying on a non-zero exit code — the `verify` '
    + 'OPERATION reports `stopped: complete` (exit 0) even for a red gate (compute-only, no confirm/judge), '
    + 'unlike the raw `verify-lane.mjs` home which exits 2', () => {
    let verifyCalls = 0;
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/lane-pool.mjs') {
        return JSON.stringify({ lanes: [{ lane: 3, path: '/real/pool/lane-3', exists: true }] });
      }
      if (args[0] === 'scripts/operations/run.mjs') { verifyCalls += 1; return verifyRedJson(); } // exit 0, verdict.ok=false
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const provider = { spawn: vi.fn() }; // stub — never spawns a real `claude`
    const result = runGateWithOneRetry(
      { lane: 3, item: '3371', sessionSlug: 'test-3627-fake-session-no-report', provider },
      { run },
    );
    expect(result.status).toBe('red');
    expect(verifyCalls).toBe(2); // the first attempt, then exactly one retry after the resume
    expect(provider.spawn).toHaveBeenCalledTimes(1); // the one resume-with-gate-failure call
  });

  it('(#3627 bug 5) resumes with claudeSessionId — a real UUID — as BOTH sessionId and resumeSessionId, '
    + 'never sessionSlug (the CLI validates --session-id/--resume as a UUID and rejects a human-readable slug)', () => {
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/lane-pool.mjs') {
        return JSON.stringify({ lanes: [{ lane: 3, path: '/real/pool/lane-3', exists: true }] });
      }
      if (args[0] === 'scripts/operations/run.mjs') return verifyRedJson();
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    const provider = { spawn: vi.fn() };
    const claudeSessionId = '33333333-3333-4333-8333-333333333333';
    runGateWithOneRetry(
      { lane: 3, item: '3371', sessionSlug: 'conveyor-3371', provider, claudeSessionId },
      { run },
    );
    expect(provider.spawn).toHaveBeenCalledTimes(1);
    const call = provider.spawn.mock.calls[0][0];
    expect(call.sessionId).toBe(claudeSessionId);
    expect(call.resumeSessionId).toBe(claudeSessionId);
    expect(call.sessionId).not.toBe('conveyor-3371');
    expect(call.resumeSessionId).not.toBe('conveyor-3371');
  });

  it('(#3627 bug 5) the SAME claudeSessionId a fresh spawn used is what the resume targets — a resume must '
    + 'never mint or receive a different id than the session it is resuming', () => {
    const claudeSessionId = '44444444-4444-4444-8444-444444444444';

    // The fresh spawn (mirrors what deliverItem's runAgentToCompletion call does).
    const freshProvider = { spawn: vi.fn() };
    freshProvider.spawn({ sessionId: claudeSessionId, prompt: 'build it' });

    // The resume, driven through the real runGateWithOneRetry with the SAME id threaded in, as deliverItem
    // threads it (both calls originate from one claudeSessionId minted once at the top of deliverItem).
    const run = vi.fn((cmd, args) => {
      if (args[0] === 'scripts/lane-pool.mjs') {
        return JSON.stringify({ lanes: [{ lane: 3, path: '/real/pool/lane-3', exists: true }] });
      }
      if (args[0] === 'scripts/operations/run.mjs') return verifyRedJson();
      throw new Error(`unexpected: ${cmd} ${JSON.stringify(args)}`);
    });
    runGateWithOneRetry({ lane: 3, item: '3371', sessionSlug: 'conveyor-3371', provider: freshProvider, claudeSessionId }, { run });

    expect(freshProvider.spawn).toHaveBeenCalledTimes(2); // the fresh spawn above + the one resume
    const [freshCall, resumeCall] = freshProvider.spawn.mock.calls.map((c) => c[0]);
    expect(freshCall.sessionId).toBe(claudeSessionId);
    expect(resumeCall.sessionId).toBe(claudeSessionId);
    expect(resumeCall.resumeSessionId).toBe(claudeSessionId);
  });
});

describe('claimItem (#3627 follow-up — routed through the declared `claim` operation, never raw backlog.mjs claim)', () => {
  it('calls `run.mjs claim --ref=<item> --json` — the exact argv the `claim` operation\'s real input schema '
    + '(`ref` required, `as`/`force` optional) accepts', () => {
    const run = vi.fn(() => '{}');
    claimItem({ item: '1234', sessionSlug: 'conveyor-1234' }, { run });
    expect(run).toHaveBeenCalledWith('node', ['scripts/operations/run.mjs', 'claim', '--ref=1234', '--json']);
  });

  it('never runs a raw `backlog.mjs claim` shell-out', () => {
    const run = vi.fn(() => '{}');
    claimItem({ item: '1234', sessionSlug: 'conveyor-1234' }, { run });
    const [, args] = run.mock.calls[0];
    expect(args.join(' ')).not.toMatch(/backlog\.mjs/);
  });

  it('never passes `--session` — the claim operation\'s real input schema (`claimOperation` in claim.mjs) has '
    + 'no such field; only `ref`/`as`/`force`', () => {
    const run = vi.fn(() => '{}');
    claimItem({ item: '1234', sessionSlug: 'conveyor-1234' }, { run });
    const [, args] = run.mock.calls[0];
    expect(args.some((a) => a.startsWith('--session'))).toBe(false);
  });
});
