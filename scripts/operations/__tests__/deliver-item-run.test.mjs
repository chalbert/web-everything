/**
 * @file deliver-item-run.test.mjs — the restartable per-dispatch CLI entry point
 * (`we:scripts/operations/deliver-item-run.mjs`), unit-level only: argv parsing, provider selection, and the
 * CLI's exit-code mapping via an injected `deliver` fake. No real process spawn anywhere in this file — every
 * assertion below exercises pure functions or an injected fake, never `../deliver-item-wrapper.mjs`'s real
 * `deliverItem` (which would spawn a real `claude`/`codex` CLI).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseDeliverItemRunArgv, selectDeliveryAgentProvider, runDeliverItemCli,
} from '../deliver-item-run.mjs';

describe('parseDeliverItemRunArgv', () => {
  it('parses the required flags plus optional scope/attempt/provider', () => {
    const launch = parseDeliverItemRunArgv([
      '--num=3645', '--lane=2', '--session=conveyor-3645', '--scope=we:scripts/foo.mjs', '--attempt=b',
      '--provider=codex',
    ]);
    expect(launch).toEqual({
      item: '3645', lane: '2', sessionSlug: 'conveyor-3645', scope: 'we:scripts/foo.mjs', attemptTag: 'b',
      provider: 'codex',
    });
  });

  it('defaults scope/attempt/provider to empty strings when absent', () => {
    const launch = parseDeliverItemRunArgv(['--num=1', '--lane=2', '--session=s']);
    expect(launch).toEqual({
      item: '1', lane: '2', sessionSlug: 's', scope: '', attemptTag: '', provider: '',
    });
  });

  it('refuses a missing `--num=`, by name', () => {
    expect(() => parseDeliverItemRunArgv(['--lane=2', '--session=s']))
      .toThrow(/--num=/);
  });

  it('refuses a missing `--lane=`, by name', () => {
    expect(() => parseDeliverItemRunArgv(['--num=1', '--session=s']))
      .toThrow(/--lane=/);
  });

  it('refuses a missing `--session=`, by name', () => {
    expect(() => parseDeliverItemRunArgv(['--num=1', '--lane=2']))
      .toThrow(/--session=/);
  });

  it('refuses all missing required flags at once, naming every one', () => {
    expect(() => parseDeliverItemRunArgv([])).toThrow(/--num=.*--lane=.*--session=/s);
  });
});

describe('selectDeliveryAgentProvider', () => {
  it('defaults to claude-restricted when no flag value is given', () => {
    const selected = selectDeliveryAgentProvider('');
    expect(selected.name).toBe('claude-restricted');
    expect(selected.provider).toBeTruthy();
  });

  it('accepts `codex` by name and resolves to a provider whose `.vendor` is `codex`', () => {
    const selected = selectDeliveryAgentProvider('codex');
    expect(selected.name).toBe('codex');
    expect(selected.provider.vendor).toBe('codex');
  });

  it('throws on an unknown provider name', () => {
    expect(() => selectDeliveryAgentProvider('gpt-5')).toThrow(/--provider must be one of/);
  });
});

describe('runDeliverItemCli (injected `deliver` fake — no real process spawn)', () => {
  const baseArgv = ['--num=42', '--lane=3', '--session=conveyor-42'];

  it('exits 0 and returns the result on success', async () => {
    const deliver = vi.fn(async () => ({ item: '42', result: 'PR #99 (soft)' }));
    const write = vi.fn();
    const writeErr = vi.fn();
    const { code, result } = await runDeliverItemCli(baseArgv, { deliver, write, writeErr });
    expect(code).toBe(0);
    expect(result).toEqual({ item: '42', result: 'PR #99 (soft)' });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(writeErr).not.toHaveBeenCalled();
  });

  it('exits 1 when the injected `deliver` throws', async () => {
    const deliver = vi.fn(async () => { throw new Error('acquire refused'); });
    const write = vi.fn();
    const writeErr = vi.fn();
    const { code, result } = await runDeliverItemCli(baseArgv, { deliver, write, writeErr });
    expect(code).toBe(1);
    expect(result).toBeNull();
    expect(writeErr).toHaveBeenCalledWith(expect.stringContaining('acquire refused'));
  });

  it('exits 1 on a bad `--provider=`, BEFORE `deliver` is ever called', async () => {
    const deliver = vi.fn(async () => ({ item: '42', result: 'should never run' }));
    const write = vi.fn();
    const writeErr = vi.fn();
    const { code, result } = await runDeliverItemCli([...baseArgv, '--provider=not-a-real-provider'], {
      deliver, write, writeErr,
    });
    expect(code).toBe(1);
    expect(result).toBeNull();
    expect(deliver).not.toHaveBeenCalled();
    expect(writeErr).toHaveBeenCalledWith(expect.stringContaining('--provider must be one of'));
  });
});
