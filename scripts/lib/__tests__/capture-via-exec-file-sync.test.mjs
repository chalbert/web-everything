/**
 * @file scripts/lib/__tests__/capture-via-exec-file-sync.test.mjs
 * @description Fast, deterministic tests for the validate-and-retry fix (#xwt6ola) via `createCapture`'s
 *   injectable `runOnce` seam — no real OS process/timing to race against, so this stays in the default
 *   suite even though the defect it fixes only reproduced under real subprocess contention. Covers both the
 *   disproven "killed" hypothesis (kept as regression coverage — a signal-carrying failure must still be
 *   handled sanely even though it wasn't the actual trigger) and the shape-validation fix that replaced it.
 */
import { describe, it, expect, vi } from 'vitest';
import { createCapture, isParseableJson } from '../capture-via-exec-file-sync.mjs';

function killedError(signal, stdout) {
  const e = new Error(`Command failed: killed by ${signal}`);
  e.signal = signal;
  if (stdout !== undefined) e.stdout = stdout;
  return e;
}
function exitError(status, stdout) {
  const e = new Error(`Command failed with exit code ${status}`);
  e.signal = null;
  e.status = status;
  e.stdout = stdout;
  return e;
}

describe('captureViaExecFileSync — no validate() passed (original single-attempt behavior, unchanged)', () => {
  it('returns stdout on a genuine success', () => {
    const runOnce = vi.fn(() => '{"ok":true}');
    const capture = createCapture(runOnce);
    expect(capture('x.mjs', [])).toBe('{"ok":true}');
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('returns e.stdout on a genuine non-zero exit, no retry (no validate to fail)', () => {
    const runOnce = vi.fn(() => { throw exitError(1, '{"errors":["real finding"]}'); });
    const capture = createCapture(runOnce);
    expect(capture('x.mjs', [])).toBe('{"errors":["real finding"]}');
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('a non-execFileSync error with no e.stdout at all still rethrows (e.g. ENOENT)', () => {
    const runOnce = vi.fn(() => { const e = new Error('spawn ENOENT'); e.signal = null; throw e; });
    const capture = createCapture(runOnce);
    expect(() => capture('missing.mjs', [])).toThrow('spawn ENOENT');
  });
});

describe('captureViaExecFileSync — with validate() (the #xwt6ola fix)', () => {
  it('a successful exit whose output fails validate() is retried, and the retry\'s valid output wins', () => {
    let call = 0;
    const runOnce = vi.fn(() => { call++; return call === 1 ? '{"trunc' : '{"ok":true}'; });
    const capture = createCapture(runOnce);
    expect(capture('x.mjs', [], { validate: isParseableJson })).toBe('{"ok":true}');
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it('exhausting all attempts on invalid output throws an explicit, diagnosable error', () => {
    const runOnce = vi.fn(() => '{"trunc');
    const capture = createCapture(runOnce);
    expect(() => capture('x.mjs', [], { validate: isParseableJson })).toThrow(/invalid\/incomplete result/);
    expect(runOnce).toHaveBeenCalledTimes(2); // default maxAttempts
  });

  it('never leaks a truncated payload as a return value once attempts are exhausted', () => {
    const runOnce = vi.fn(() => '{"trunc');
    const capture = createCapture(runOnce);
    let threw = false;
    try { capture('x.mjs', [], { validate: isParseableJson }); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it('a genuine non-zero exit with COMPLETE, valid output passes validate() on the first attempt (no wasted retry)', () => {
    const runOnce = vi.fn(() => { throw exitError(1, '{"errors":["real finding"]}'); });
    const capture = createCapture(runOnce);
    expect(capture('x.mjs', [], { validate: isParseableJson })).toBe('{"errors":["real finding"]}');
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it('regression: a KILLED attempt (signal set) with invalid output is also retried, same as any other invalid attempt', () => {
    let call = 0;
    const runOnce = vi.fn(() => {
      call++;
      if (call === 1) throw killedError('SIGTERM', '{"trunc');
      return '{"ok":true}';
    });
    const capture = createCapture(runOnce);
    expect(capture('x.mjs', [], { validate: isParseableJson })).toBe('{"ok":true}');
    expect(runOnce).toHaveBeenCalledTimes(2);
  });

  it('respects a custom maxAttempts', () => {
    const runOnce = vi.fn(() => '{"trunc');
    const capture = createCapture(runOnce);
    expect(() => capture('x.mjs', [], { validate: isParseableJson, maxAttempts: 4 })).toThrow();
    expect(runOnce).toHaveBeenCalledTimes(4);
  });
});

describe('isParseableJson', () => {
  it('true for valid JSON, false for a truncated/malformed fragment', () => {
    expect(isParseableJson('{"a":1}')).toBe(true);
    expect(isParseableJson('{"a":')).toBe(false);
    expect(isParseableJson('')).toBe(false);
  });
});
