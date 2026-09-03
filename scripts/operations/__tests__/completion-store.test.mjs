/**
 * @file completion-store.test.mjs — the fs shell over completion-record.mjs (#3436).
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { newCompletionRecord } from '../completion-record.mjs';
import {
  completionPath,
  completionsDir,
  createFileCompletionStore,
  deleteCompletion,
  listCompletionSessions,
  readCompletion,
  resolveCompletionsDir,
  tryReadCompletion,
  writeCompletion,
} from '../completion-store.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'we-op-completions-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const sample = () => newCompletionRecord({ session: 'review-701', kind: 'review', pr: 701, now: () => '2026-09-03T00:00:00.000Z' });

describe('the fs shell', () => {
  it('writes atomically and leaves no temp file behind', () => {
    writeCompletion(sample(), dir);
    expect(readdirSync(dir)).toEqual(['review-701.json']);
    expect(JSON.parse(readFileSync(join(dir, 'review-701.json'), 'utf8'))).toEqual(sample());
  });

  it('round-trips through the file store handle', () => {
    const store = createFileCompletionStore(dir);
    store.write(sample());
    expect(store.read('review-701')).toEqual(sample());
    expect(store.list()).toEqual(['review-701']);
    store.delete('review-701');
    expect(store.read('review-701')).toBeNull();
    expect(() => store.delete('review-701')).not.toThrow();
  });

  it('lists only well-formed completion files, ignoring temp and stray names', () => {
    writeCompletion(sample(), dir);
    writeFileSync(join(dir, 'review-701.json.123.tmp'), 'x');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    expect(listCompletionSessions(dir)).toEqual(['review-701']);
    expect(listCompletionSessions(join(dir, 'nope'))).toEqual([]);
  });

  it('resolves the sidecar by SCRIPT location, and OPERATION_COMPLETIONS_DIR overrides it', () => {
    const previous = process.env.OPERATION_COMPLETIONS_DIR;
    try {
      delete process.env.OPERATION_COMPLETIONS_DIR;
      expect(resolveCompletionsDir()).toBe(completionsDir());
      expect(completionsDir()).toMatch(/[/\\]\.operations[/\\]completions$/);
      process.env.OPERATION_COMPLETIONS_DIR = dir;
      expect(resolveCompletionsDir()).toBe(dir);
    } finally {
      if (previous === undefined) delete process.env.OPERATION_COMPLETIONS_DIR;
      else process.env.OPERATION_COMPLETIONS_DIR = previous;
    }
  });

  it('creates the completions directory on first write', () => {
    const nested = join(dir, 'deep', 'completions');
    writeCompletion(sample(), nested);
    expect(readdirSync(nested)).toEqual(['review-701.json']);
  });

  it('deleteCompletion on a directory that does not exist is a no-op', () => {
    mkdirSync(join(dir, 'empty'), { recursive: true });
    expect(() => deleteCompletion('review-701', join(dir, 'empty'))).not.toThrow();
  });

  it('refuses a session slug that could escape the completions directory', () => {
    expect(() => completionPath('../escape', dir)).toThrow(/invalid completion session slug/);
  });
});

describe('a corrupt record is REFUSED, never read as absent', () => {
  it('tryReadCompletion THROWS on a corrupt file rather than returning null', () => {
    writeFileSync(join(dir, 'fix-9.json'), '{"v":1,"session":"fix-9"');
    expect(() => tryReadCompletion('fix-9', dir)).toThrow(/refusing to read completion record for fix-9[\s\S]*never treated as one that was never written/);
  });

  it('tryReadCompletion returns null ONLY when the file genuinely does not exist', () => {
    expect(tryReadCompletion('review-missing', dir)).toBeNull();
    expect(() => readCompletion('review-missing', dir)).toThrow(/no completion record for "review-missing"/);
  });
});
