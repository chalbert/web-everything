/**
 * @file claim-io.test.mjs — the `claim` declaration's io shell (#3034, under epic #3029).
 *
 * Every fs/git touch is INJECTED (`listFiles`/`readText`/`exec`), so this suite never reads the real repo's
 * `backlog/` or shells `git` — the same discipline `dispatch-lane-io.mjs`'s own suite uses for `runNode`/`exec`.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createClaimReader, createClaimSinks } from '../claim-io.mjs';
import { CLAIM_EFFECT } from '../claim.mjs';

const CARD = '---\nkind: task\nsize: 1\nstatus: open\ndateOpened: "2026-08-01"\n---\n\n# Example\n';

/** A fake filesystem: `files` lists `backlog/`'s entries, `texts` maps absolute path → content. */
function stubReader({
  files = ['042-example.md', '099-other.md'],
  texts = { '/repo/backlog/042-example.md': CARD },
  queuedText = '',
  holdText = '',
  gitOut = '',
  gitThrows = false,
  today = () => '2026-08-16',
} = {}) {
  const readText = (path) => {
    if (path.endsWith('queued.json')) return queuedText;
    if (path.endsWith('prepare-hold.json')) return holdText;
    if (Object.prototype.hasOwnProperty.call(texts, path)) return texts[path];
    throw new Error(`stubReader: no fixture text for ${path}`);
  };
  const exec = () => {
    if (gitThrows) throw new Error('git hiccup');
    return gitOut;
  };
  return createClaimReader({ root: '/repo', listFiles: () => files, readText, exec, today });
}

describe('createClaimReader', () => {
  it('resolves ref to the one matching file and reads its status/content', () => {
    const reader = stubReader();
    const ctx = reader({ ref: '042' });
    expect(ctx).toMatchObject({
      found: true,
      abs: '/repo/backlog/042-example.md',
      rel: 'backlog/042-example.md',
      id: '042',
      status: 'open',
      queued: false,
      held: false,
      heldBy: null,
      dirty: false,
      today: '2026-08-16',
    });
  });

  it('reports not-found for a ref that matches no file', () => {
    const reader = stubReader();
    expect(reader({ ref: '999' })).toEqual({ found: false });
  });

  it('reports not-found for an ambiguous ref (two files sharing a prefix)', () => {
    const reader = stubReader({ files: ['042-example.md', '042-duplicate.md'] });
    expect(reader({ ref: '042' })).toEqual({ found: false });
  });

  it('reports not-found for an unparseable ref', () => {
    const reader = stubReader();
    expect(reader({ ref: 'not-an-id!!' })).toEqual({ found: false });
  });

  it('reads the queued guard off queued.json', () => {
    const reader = stubReader({ queuedText: JSON.stringify({ queued: [{ num: '042', at: '2026-08-01T00:00:00Z' }] }) });
    expect(reader({ ref: '042' }).queued).toBe(true);
  });

  it('reads the prepare-hold guard off prepare-hold.json, with a live lease', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const reader = stubReader({ holdText: JSON.stringify({ holds: [{ num: '042', holder: 'session-a', leaseUntil: future }] }) });
    const ctx = reader({ ref: '042' });
    expect(ctx.held).toBe(true);
    expect(ctx.heldBy).toBe('session-a');
  });

  it('treats an EXPIRED prepare-hold as not held', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const reader = stubReader({ holdText: JSON.stringify({ holds: [{ num: '042', holder: 'session-a', leaseUntil: past }] }) });
    const ctx = reader({ ref: '042' });
    expect(ctx.held).toBe(false);
    expect(ctx.heldBy).toBe(null);
  });

  it('reads the dirty-file guard off a scoped git status --porcelain', () => {
    const reader = stubReader({ gitOut: 'M  backlog/042-example.md\n' });
    expect(reader({ ref: '042' }).dirty).toBe(true);
  });

  it('a clean git status reads as not dirty', () => {
    const reader = stubReader({ gitOut: '' });
    expect(reader({ ref: '042' }).dirty).toBe(false);
  });

  it('a git hiccup is best-effort and never blocks the read — reads as clean', () => {
    const reader = stubReader({ gitThrows: true });
    expect(reader({ ref: '042' }).dirty).toBe(false);
  });

  it('a missing/corrupt queued.json or prepare-hold.json degrades to unqueued/unheld, not a throw', () => {
    const reader = createClaimReader({
      root: '/repo',
      listFiles: () => ['042-example.md'],
      readText: (path) => {
        if (path.endsWith('.json')) throw new Error('ENOENT');
        return CARD;
      },
      exec: () => '',
      today: () => '2026-08-16',
    });
    const ctx = reader({ ref: '042' });
    expect(ctx.queued).toBe(false);
    expect(ctx.held).toBe(false);
  });
});

describe('createClaimSinks', () => {
  let scratch;

  afterEach(() => {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  });

  it('is registered under exactly the declared CLAIM_EFFECT type', () => {
    const sinks = createClaimSinks({ root: '/does-not-need-to-exist-for-this-assertion' });
    expect(Object.keys(sinks)).toEqual([CLAIM_EFFECT]);
    expect(typeof sinks[CLAIM_EFFECT]).toBe('function');
  });

  it('writes the effect payload through the guarded writer, producing the exact bytes on disk', async () => {
    // A scratch dir OUTSIDE the workspace's `.lanes`/primary-repo layout — `laneGuardDecision` only denies a
    // path under a known primary repo root, so a bare tmp dir is never classified as one and the write
    // proceeds unguarded (the same reasoning the extraction's own docblock states).
    scratch = mkdtempSync(join(tmpdir(), 'claim-io-sink-'));
    mkdirSync(join(scratch, 'backlog'), { recursive: true });
    const abs = join(scratch, 'backlog', '042-example.md');
    const rel = 'backlog/042-example.md';
    const content = CARD.replace('status: open', 'status: active');

    const sinks = createClaimSinks({ root: scratch });
    const result = await sinks[CLAIM_EFFECT]({ abs, rel, content });

    expect(result).toEqual({ abs, rel });
    expect(readFileSync(abs, 'utf8')).toBe(content);
  });
});
