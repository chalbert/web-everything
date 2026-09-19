/**
 * @file scripts/readiness/__tests__/prep-staleness.test.mjs
 * @description Unit tests for checkPrepStaleness and prepareStamp's preparedAgainstSha signature (#3108).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPrepStaleness } from '../prep-staleness.mjs';
import { readField } from '../../backlog/frontmatter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BACKLOG_CLI = join(ROOT, 'scripts', 'backlog.mjs');
const PREP_STALENESS_CLI = join(ROOT, 'scripts', 'readiness', 'prep-staleness.mjs');

describe('checkPrepStaleness — pure function (#3108)', () => {
  let tempRepo;
  let sha1;
  let sha2;
  let sha3;

  beforeAll(() => {
    tempRepo = mkdtempSync(join(tmpdir(), 'prep-staleness-test-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRepo });

    // Commit 1: base commit with file-a.txt and file-b.txt
    writeFileSync(join(tempRepo, 'file-a.txt'), 'hello a\n');
    writeFileSync(join(tempRepo, 'file-b.txt'), 'hello b\n');
    execFileSync('git', ['add', '.'], { cwd: tempRepo });
    execFileSync('git', ['commit', '-m', 'commit 1'], { cwd: tempRepo });
    sha1 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempRepo, encoding: 'utf8' }).trim();

    // Commit 2: update unrelated file-c.txt
    writeFileSync(join(tempRepo, 'file-c.txt'), 'hello c\n');
    execFileSync('git', ['add', '.'], { cwd: tempRepo });
    execFileSync('git', ['commit', '-m', 'commit 2'], { cwd: tempRepo });
    sha2 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempRepo, encoding: 'utf8' }).trim();

    // Commit 3: update file-a.txt
    writeFileSync(join(tempRepo, 'file-a.txt'), 'hello a modified\n');
    execFileSync('git', ['add', '.'], { cwd: tempRepo });
    execFileSync('git', ['commit', '-m', 'commit 3'], { cwd: tempRepo });
    sha3 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempRepo, encoding: 'utf8' }).trim();
  });

  afterAll(() => {
    if (tempRepo) rmSync(tempRepo, { recursive: true, force: true });
  });

  it('reports stale: false when card scope files are unchanged since sha', () => {
    // Check against sha2 where only file-b.txt is in scope (file-b has not changed since sha1 or sha2)
    const res = checkPrepStaleness({
      scope: ['we:file-b.txt'],
      preparedAgainstSha: sha2,
      cwd: tempRepo,
    });
    expect(res).toEqual({
      checked: true,
      stale: false,
      changedFiles: [],
      skipped: [],
    });
  });

  it('reports stale: true with the real changed-file list when scope files changed', () => {
    // Between sha1 and HEAD (sha3), file-a.txt changed, while file-b.txt did not
    const res = checkPrepStaleness({
      scope: ['we:file-a.txt', 'we:file-b.txt'],
      preparedAgainstSha: sha1,
      cwd: tempRepo,
    });
    expect(res).toEqual({
      checked: true,
      stale: true,
      changedFiles: ['file-a.txt'],
      skipped: [],
    });
  });

  it('returns checked: false when card has no preparedAgainstSha, without throwing', () => {
    const res1 = checkPrepStaleness({
      scope: ['we:file-a.txt'],
      cwd: tempRepo,
    });
    expect(res1).toEqual({ checked: false, reason: 'no preparedAgainstSha' });

    const res2 = checkPrepStaleness({
      scope: ['we:file-a.txt'],
      preparedAgainstSha: '',
      cwd: tempRepo,
    });
    expect(res2).toEqual({ checked: false, reason: 'no preparedAgainstSha' });

    const res3 = checkPrepStaleness();
    expect(res3).toEqual({ checked: false, reason: 'no preparedAgainstSha' });
  });

  it('returns checked: false with stated reason when sha is unreachable, without crashing', () => {
    const unreachableSha = '0000000000000000000000000000000000000000';
    const res = checkPrepStaleness({
      scope: ['we:file-a.txt'],
      preparedAgainstSha: unreachableSha,
      cwd: tempRepo,
    });
    expect(res.checked).toBe(false);
    expect(res.reason).toMatch(/unreachable commit sha/);
  });

  it('places non-we: scope entries into skipped while still diffing we: entries', () => {
    const res = checkPrepStaleness({
      scope: [
        'we:file-a.txt',
        'plateau:packages/dev-browser/types.ts',
        'fui:plugs/store.ts',
      ],
      preparedAgainstSha: sha1,
      cwd: tempRepo,
    });
    expect(res.checked).toBe(true);
    expect(res.stale).toBe(true);
    expect(res.changedFiles).toEqual(['file-a.txt']);
    expect(res.skipped).toEqual([
      'plateau:packages/dev-browser/types.ts',
      'fui:plugs/store.ts',
    ]);
  });
});

describe('prepareStamp() integration & CLI wrapper (#3108)', () => {
  let fixtureRepo;
  let backlogDir;
  let headSha;

  beforeAll(() => {
    fixtureRepo = mkdtempSync(join(tmpdir(), 'prep-stamp-test-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: fixtureRepo });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: fixtureRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: fixtureRepo });

    backlogDir = join(fixtureRepo, 'backlog');
    mkdirSync(backlogDir, { recursive: true });

    // Create a tracked file in the repo
    writeFileSync(join(fixtureRepo, 'src-code.js'), 'console.log("initial");\n');
    execFileSync('git', ['add', '.'], { cwd: fixtureRepo });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: fixtureRepo });
    headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixtureRepo, encoding: 'utf8' }).trim();

    // Create card with scope
    const cardContent = `---
kind: story
size: 3
status: active
scope:
  - we:src-code.js
---

# Test story
Description.
`;
    writeFileSync(join(backlogDir, '9999-test-story.md'), cardContent, 'utf8');
  });

  afterAll(() => {
    if (fixtureRepo) rmSync(fixtureRepo, { recursive: true, force: true });
  });

  it('prepareStamp writes preparedAgainstSha alongside preparedDate', () => {
    // Run backlog.mjs prepare-stamp 9999 --backlog-dir=<backlogDir>
    const out = execFileSync(
      process.execPath,
      [BACKLOG_CLI, 'prepare-stamp', '9999', `--backlog-dir=${backlogDir}`, '--json'],
      { cwd: fixtureRepo, encoding: 'utf8' },
    );
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(parsed.verb).toBe('prepare-stamp');
    expect(parsed.num).toBe('9999');
    expect(parsed.preparedAgainstSha).toBe(headSha);
    expect(parsed.preparedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const writtenContent = readFileSync(join(backlogDir, '9999-test-story.md'), 'utf8');
    expect(readField(writtenContent, 'status')).toBe('open');
    expect(readField(writtenContent, 'preparedDate')).toBe(parsed.preparedDate);
    expect(readField(writtenContent, 'preparedAgainstSha')).toBe(headSha);
  });

  it('CLI outputs "no drift" when scoped files are unchanged', () => {
    const out = execFileSync(
      process.execPath,
      [PREP_STALENESS_CLI, '--item=9999', `--backlog-dir=${backlogDir}`],
      { cwd: fixtureRepo, encoding: 'utf8' },
    );
    expect(out.trim()).toBe('no drift');
  });

  it('CLI outputs changed files when scoped files changed', () => {
    // Modify src-code.js and commit
    writeFileSync(join(fixtureRepo, 'src-code.js'), 'console.log("updated");\n');
    execFileSync('git', ['add', '.'], { cwd: fixtureRepo });
    execFileSync('git', ['commit', '-m', 'update code'], { cwd: fixtureRepo });

    const out = execFileSync(
      process.execPath,
      [PREP_STALENESS_CLI, '--item=9999', `--backlog-dir=${backlogDir}`],
      { cwd: fixtureRepo, encoding: 'utf8' },
    );
    expect(out.trim()).toBe('src-code.js');

    // Also verify --json output
    const jsonOut = execFileSync(
      process.execPath,
      [PREP_STALENESS_CLI, '--item=9999', `--backlog-dir=${backlogDir}`, '--json'],
      { cwd: fixtureRepo, encoding: 'utf8' },
    );
    const parsed = JSON.parse(jsonOut);
    expect(parsed.checked).toBe(true);
    expect(parsed.stale).toBe(true);
    expect(parsed.changedFiles).toEqual(['src-code.js']);
  });

  it('CLI outputs "not staleness-checked — no preparedAgainstSha" on an unstamped card', () => {
    const unstampedCard = `---
kind: story
size: 3
status: open
scope:
  - we:src-code.js
---

# Unstamped story
`;
    writeFileSync(join(backlogDir, '9998-unstamped.md'), unstampedCard, 'utf8');

    const out = execFileSync(
      process.execPath,
      [PREP_STALENESS_CLI, '--item=9998', `--backlog-dir=${backlogDir}`],
      { cwd: fixtureRepo, encoding: 'utf8' },
    );
    expect(out.trim()).toBe('not staleness-checked — no preparedAgainstSha');
  });
});
