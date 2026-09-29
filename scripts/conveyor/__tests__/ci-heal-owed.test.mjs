/**
 * @file scripts/conveyor/__tests__/ci-heal-owed.test.mjs
 * @description Pins the owed-write primitive's own edges (we:backlog/4352): which failures count as a budget
 *   refusal, how a CLI's target repo resolves without a GitHub read, what a record must carry, and that a
 *   malformed file on the shared host dir is skipped rather than breaking every tick's flush. The end-to-end
 *   flush (post / dedupe / moot / bound) is pinned through its real caller in `ci-heal-pr-dispatch.test.mjs`.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isBudgetRefusal, resolveOwedRepo, recordOwedWrite, readOwedWrites, clearOwedWrite, owedWriteAlreadyLive, owedDir,
} from '../ci-heal-owed.mjs';
import { budgetBlockedMessage } from '../../lib/gh-throttle.mjs';

const HEAD = 'abcdef0123456789abcdef0123456789abcdef01';

describe('isBudgetRefusal', () => {
  it('reads gh-throttle budget_blocked (thrown or stderr-only) and a raw GitHub rate limit as budget refusals', () => {
    expect(isBudgetRefusal(Object.assign(new Error('x'), { budgetBlocked: { resource: 'graphql' } }))).toBe(true);
    expect(isBudgetRefusal({ message: 'Command failed', stderr: budgetBlockedMessage({ resource: 'graphql', until: 'soon' }) })).toBe(true);
    expect(isBudgetRefusal(new Error('GraphQL: API rate limit exceeded for installation ID 1'))).toBe(true);
  });

  it('does not read an ordinary failure (404, auth, network) as a budget refusal', () => {
    expect(isBudgetRefusal(new Error('HTTP 404: Not Found'))).toBe(false);
    expect(isBudgetRefusal(new Error('gh: To use GitHub CLI, please authenticate'))).toBe(false);
    expect(isBudgetRefusal(null)).toBe(false);
  });
});

describe('resolveOwedRepo', () => {
  it('a --repo slug or key resolves to the constellation key + canonical slug', () => {
    expect(resolveOwedRepo({ repoFlag: 'chalbert/web-everything' })).toEqual({ key: 'we', slug: 'chalbert/web-everything' });
    expect(resolveOwedRepo({ repoFlag: 'plateau-app' })).toEqual({ key: 'plateau-app', slug: 'chalbert/plateau-app' });
  });

  it('without --repo, reads the LOCAL origin remote (ssh or https), never GitHub', () => {
    expect(resolveOwedRepo({ exec: () => 'git@github.com:chalbert/frontierui.git\n' })).toEqual({ key: 'frontierui', slug: 'chalbert/frontierui' });
    expect(resolveOwedRepo({ exec: () => 'https://github.com/chalbert/web-everything\n' })).toEqual({ key: 'we', slug: 'chalbert/web-everything' });
  });

  it('a repo outside the constellation, or no remote at all, is null', () => {
    expect(resolveOwedRepo({ repoFlag: 'someone/else' })).toBeNull();
    expect(resolveOwedRepo({ exec: () => { throw new Error('no remote'); } })).toBeNull();
  });
});

describe('recordOwedWrite / readOwedWrites / clearOwedWrite', () => {
  const base = { repo: 'we', slug: 'chalbert/web-everything', pr: 5, kind: 'ci-heal', headSha: HEAD, body: 'b' };

  it('one file per (repo, pr, kind): a repeat refusal refreshes the same record, a different kind is its own', () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-'));
    try {
      recordOwedWrite(base, { dir });
      recordOwedWrite({ ...base, body: 'newer' }, { dir });
      recordOwedWrite({ ...base, kind: 'ci-heal-escalation' }, { dir });
      const all = readOwedWrites({ dir });
      expect(all).toHaveLength(2);
      expect(all.find((r) => r.kind === 'ci-heal').body).toBe('newer');
      clearOwedWrite(all[0], { dir });
      clearOwedWrite(all[0], { dir }); // idempotent
      expect(readOwedWrites({ dir })).toHaveLength(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('refuses a kind outside OWED_KINDS (advisory-fix is deliberately not one) and a record with no head', () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-'));
    try {
      expect(() => recordOwedWrite({ ...base, kind: 'advisory-fix' }, { dir })).toThrow(/kind/);
      expect(() => recordOwedWrite({ ...base, headSha: '' }, { dir })).toThrow(/headSha/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a malformed file in the shared dir is skipped, not thrown; a missing dir reads as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'owed-'));
    try {
      writeFileSync(join(dir, 'garbage.json'), '{not json');
      recordOwedWrite(base, { dir });
      expect(readOwedWrites({ dir })).toHaveLength(1);
      expect(readOwedWrites({ dir: join(dir, 'nope') })).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('lives under the gh-throttle lock root', () => {
    expect(owedDir({ WE_GH_THROTTLE_LOCK_ROOT: '/tmp/lr' })).toBe('/tmp/lr/ci-heal-owed');
  });
});

describe('owedWriteAlreadyLive', () => {
  const rec = { kind: 'ci-heal', headSha: HEAD, body: 'MARK\nhead: ' + HEAD + '\n\nbody' };
  it('matches only a TRUSTED, marker-leading comment for the SAME head', () => {
    expect(owedWriteAlreadyLive([{ body: rec.body, author: { login: 'web-everything' } }], rec)).toBe(true);
    expect(owedWriteAlreadyLive([{ body: rec.body, author: { login: 'mallory' } }], rec)).toBe(false);
    expect(owedWriteAlreadyLive([{ body: `> ${rec.body}`, author: { login: 'web-everything' } }], rec)).toBe(false);
    expect(owedWriteAlreadyLive([{ body: 'MARK\n\nno head line', author: { login: 'web-everything' } }], rec)).toBe(false);
  });
});
