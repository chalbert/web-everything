/**
 * @file review-prep-io.test.mjs — the `review-prep` io shell: reads a card, appends its review section,
 * commits, and shells `we:scripts/pr-land.mjs` — with no real `fs` mutation outside a temp dir and no real
 * `git`/`gh` subprocess (both injected).
 *
 * THE PROPERTY WORTH PINNING is the race guard: a `record` whose card changed since `read` makes NO write and
 * calls neither `exec` nor `runNode` — the deterministic stand-in for the `confirm` step this operation
 * deliberately does not have (see `review-prep-io.mjs`'s header).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  contentHashOf, createReviewPrepReader, createReviewPrepSinks, readPrep, recordPrepVerdict, resolveCardPath,
  todayIso,
} from '../review-prep-io.mjs';
import { REVIEW_PREP_EFFECTS } from '../review-prep.mjs';
import { notApplied } from '../effect-executor.mjs';

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'review-prep-io-'));
  mkdirSync(join(root, 'backlog'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const CARD_RAW = [
  '---',
  'kind: story',
  'size: 3',
  'status: open',
  'tags: [x, y]',
  'scope:',
  '  - we:scripts/foo.mjs',
  '  - we:scripts/bar.mjs',
  '---',
  '',
  '# A fake card for tests',
  '',
  'This card claims the sky is blue.',
  '',
].join('\n');

function writeCard(name, raw = CARD_RAW) {
  const path = join(root, 'backlog', name);
  writeFileSync(path, raw, 'utf8');
  return path;
}

describe('resolveCardPath', () => {
  it('resolves a hash-prefixed item to its card', () => {
    writeCard('9999-a-fake-card.md');
    expect(resolveCardPath({ item: '9999', cwd: root })).toBe(join(root, 'backlog', '9999-a-fake-card.md'));
  });

  it('resolves an exact `<item>.md` — a card whose slug IS its id', () => {
    writeCard('xk1tron.md');
    expect(resolveCardPath({ item: 'xk1tron', cwd: root })).toBe(join(root, 'backlog', 'xk1tron.md'));
  });

  it('refuses a missing item', () => {
    expect(() => resolveCardPath({ item: '404', cwd: root })).toThrow(/no backlog card matches/);
  });

  it('refuses an ambiguous item rather than guessing', () => {
    writeCard('42-first.md');
    writeCard('42-second.md');
    expect(() => resolveCardPath({ item: '42', cwd: root })).toThrow(/ambiguous/);
  });

  it('refuses an empty item', () => {
    expect(() => resolveCardPath({ item: '', cwd: root })).toThrow(/non-empty backlog id/);
  });
});

describe('readPrep', () => {
  it('reads frontmatter, body and scope — and hashes the raw bytes', () => {
    writeCard('9999-a-fake-card.md');
    const result = readPrep({ item: '9999', repo: 'chalbert/web-everything', cwd: root });
    expect(result.card.frontmatter).toMatchObject({ kind: 'story', size: 3, status: 'open', tags: ['x', 'y'] });
    expect(result.card.body).toContain('# A fake card for tests');
    expect(result.card.body).toContain('the sky is blue');
    expect(result.card.contentHash).toBe(contentHashOf(CARD_RAW));
    expect(result.scopeFiles).toEqual(['we:scripts/foo.mjs', 'we:scripts/bar.mjs']);
  });

  it('refuses a malformed repo rather than reading a card for nobody', () => {
    writeCard('9999-a-fake-card.md');
    expect(() => readPrep({ item: '9999', repo: 'not-a-repo', cwd: root })).toThrow(/owner\/name/);
  });

  it('`createReviewPrepReader` binds cwd, giving the declaration\'s injected `{item, repo}` shape', () => {
    writeCard('9999-a-fake-card.md');
    const reader = createReviewPrepReader({ cwd: root });
    const result = reader({ item: '9999', repo: 'chalbert/web-everything' });
    expect(result.scopeFiles).toEqual(['we:scripts/foo.mjs', 'we:scripts/bar.mjs']);
  });
});

describe('contentHashOf', () => {
  it('is deterministic and sensitive to a single byte', () => {
    expect(contentHashOf('a')).toBe(contentHashOf('a'));
    expect(contentHashOf('a')).not.toBe(contentHashOf('b'));
  });
});

describe('todayIso', () => {
  it('formats YYYY-MM-DD from a fixed clock', () => {
    expect(todayIso(new Date(2026, 7, 14))).toBe('2026-08-14'); // month is 0-indexed
  });
});

describe('recordPrepVerdict — the race guard', () => {
  it('a card that changed since it was read makes NO write and calls neither exec nor runNode', async () => {
    const path = writeCard('9999-a-fake-card.md');
    const calls = [];
    const result = await recordPrepVerdict({
      item: '9999',
      repo: 'chalbert/web-everything',
      cwd: root,
      confidence: 'High',
      risks: [],
      corrections: [],
      fixApplied: false,
      note: '',
      expectedContentHash: 'a-hash-that-will-never-match-the-live-file',
      exec: () => { calls.push('exec'); return ''; },
      runNode: () => { calls.push('runNode'); return '{}'; },
    });
    expect(result).toMatchObject({ recorded: false, aborted: true });
    expect(result.reason).toMatch(/changed since it was read/);
    expect(calls).toEqual([]);
    expect(readFileSync(path, 'utf8')).toBe(CARD_RAW); // byte-for-byte unchanged
  });

  it('a matching hash proceeds to write, commit and land', async () => {
    const path = writeCard('9999-a-fake-card.md');
    const calls = [];
    const result = await recordPrepVerdict({
      item: '9999',
      repo: 'chalbert/web-everything',
      cwd: root,
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true, note: 'checked against live code' }],
      corrections: [],
      fixApplied: false,
      note: 'the preparation holds up',
      expectedContentHash: contentHashOf(CARD_RAW),
      exec: (cmd, args) => { calls.push([cmd, args]); return args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''; },
      runNode: (argv) => { calls.push(['node', argv]); return JSON.stringify({ ok: true }); },
    });
    expect(result).toMatchObject({ recorded: true, aborted: false, clean: true, disposition: 'landed' });
    const updated = readFileSync(path, 'utf8');
    expect(updated).toContain('## Independent review — ');
    expect(updated).toContain('Confidence: **High**');
    expect(updated).toContain('premise');
    // git add / commit / rev-parse, then the pr-land shell.
    expect(calls[0]).toEqual(['git', ['add', '--', 'backlog/9999-a-fake-card.md']]);
    expect(calls[1][0]).toBe('git');
    expect(calls[1][1][0]).toBe('commit');
    expect(calls[2]).toEqual(['git', ['rev-parse', 'HEAD']]);
    const landCall = calls[3];
    expect(landCall[0]).toBe('node');
    expect(landCall[1]).toContain(`${join(root, 'scripts', 'pr-land.mjs')}`);
    expect(landCall[1]).toContain('--label-on-green');
    expect(landCall[1]).toContain('--sha=deadbeefcafe');
    // THE BODY RIDES A FILE, NEVER `--body=<text>` — pr-land's own argv regex has no `s` flag, so a
    // multi-line `--body=` value fails the match outright and silently resolves to no body at all,
    // reproduced live against a real card (#1637) as pr-land's `empty-body` refusal.
    const bodyFlag = landCall[1].find((a) => a.startsWith('--body-file='));
    expect(bodyFlag).toBeTruthy();
    expect(landCall[1].some((a) => a.startsWith('--body='))).toBe(false);
    const bodyFilePath = bodyFlag.slice('--body-file='.length);
    const stagedBody = readFileSync(bodyFilePath, 'utf8');
    expect(stagedBody).toContain('Independent review of #9999');
    expect(stagedBody).toContain('## Independent review — ');
  });
});

describe('recordPrepVerdict — land vs park', () => {
  const baseArgs = (overrides = {}) => ({
    item: '9999',
    repo: 'chalbert/web-everything',
    cwd: root,
    expectedContentHash: contentHashOf(CARD_RAW),
    exec: (cmd, args) => (args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''),
    runNode: () => '{}',
    ...overrides,
  });

  it('parks (never lands) when a risk is left unaddressed', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    const result = await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'consumer', addressed: false, note: 'a caller outside scope: was found' }],
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(result.clean).toBe(false);
    expect(result.disposition).toBe('parked');
    expect(seen[0]).toContain('--park=review:pending');
    expect(seen[0].some((a) => a === '--label-on-green')).toBe(false);
  });

  it('parks when a correction was applied, even at High confidence with all risks addressed', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true }],
      corrections: ['the cited line number is stale'],
      fixApplied: true,
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(seen[0]).toContain('--park=review:pending');
  });

  it('parks at Low confidence regardless of risk state', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    await recordPrepVerdict(baseArgs({
      confidence: 'Low', risks: [], runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(seen[0]).toContain('--park=review:pending');
  });

  it('lands cleanly at High confidence, every risk addressed, no corrections', async () => {
    writeCard('9999-a-fake-card.md');
    const seen = [];
    const result = await recordPrepVerdict(baseArgs({
      confidence: 'High',
      risks: [{ risk: 'premise', addressed: true }, { risk: 'interface', addressed: true }],
      runNode: (argv) => { seen.push(argv); return '{}'; },
    }));
    expect(result.clean).toBe(true);
    expect(seen[0]).toContain('--label-on-green');
  });
});

describe('recordPrepVerdict — failure classification', () => {
  it('a git commit failure is `notApplied` — nothing pushed, safe to retry', async () => {
    writeCard('9999-a-fake-card.md');
    await expect(recordPrepVerdict({
      item: '9999', repo: 'chalbert/web-everything', cwd: root, confidence: 'High', risks: [],
      expectedContentHash: contentHashOf(CARD_RAW),
      exec: () => { throw new Error('nothing to commit'); },
      runNode: () => { throw new Error('must not be reached'); },
    })).rejects.toMatchObject({ notApplied: true });
  });

  it('a pr-land failure AFTER a local commit is INDETERMINATE, not notApplied — the commit already happened', async () => {
    writeCard('9999-a-fake-card.md');
    const err = await recordPrepVerdict({
      item: '9999', repo: 'chalbert/web-everything', cwd: root, confidence: 'High', risks: [],
      expectedContentHash: contentHashOf(CARD_RAW),
      exec: (cmd, args) => (args[0] === 'rev-parse' ? 'deadbeefcafe\n' : ''),
      runNode: () => { throw new Error('gh: network unreachable'); },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.notApplied).toBeUndefined();
    expect(String(err.message)).toMatch(/UNKNOWN/);
    expect(String(err.message)).toContain('deadbeefcafe');
  });
});

describe('createReviewPrepSinks', () => {
  it('wires the RECORD and NOTICE effect types', () => {
    const sinks = createReviewPrepSinks({ root });
    expect(typeof sinks[REVIEW_PREP_EFFECTS.RECORD]).toBe('function');
    expect(typeof sinks[REVIEW_PREP_EFFECTS.NOTICE]).toBe('function');
  });

  it('the NOTICE sink reports through the injected channel and writes nothing', async () => {
    const lines = [];
    const sinks = createReviewPrepSinks({ root, out: (l) => lines.push(l) });
    const result = await sinks[REVIEW_PREP_EFFECTS.NOTICE]({ notice: 'Card o/n#7 — recorded.' });
    expect(result).toEqual({ reported: true });
    expect(lines).toEqual(['Card o/n#7 — recorded.']);
  });
});

// `notApplied` re-export sanity — used above via `.toMatchObject({ notApplied: true })`; this just documents
// the helper is the SAME one `review-pr-io.mjs` uses, not a lookalike.
describe('notApplied', () => {
  it('marks an error so the executor retries rather than replays it as indeterminate', () => {
    expect(notApplied('x').notApplied).toBe(true);
  });
});
