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
import { describe, it, expect } from 'vitest';

import { DELIVERY_AGENT_PROVIDERS, buildRestrictedProviderArgv } from '../deliver-item-wrapper.mjs';

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
