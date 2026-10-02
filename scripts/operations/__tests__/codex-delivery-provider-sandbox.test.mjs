/**
 * @file codex-delivery-provider-sandbox.test.mjs — #4443 REAL `codex sandbox -P locked` proof (no model) that an
 * extra writable WE root (`writableRoots`) grants ordinary file writes but NOT Git-metadata mutation.
 * Opt-in: `WE_TEST_SANDBOX=0 WE_CODEX_SANDBOX_TEST=1 npx vitest run -t 4443` (setup otherwise strips `WE_*`, fakes HOME). When requested, a missing CLI or unusable sandbox
 * FAILS (positive control must pass) rather than skipping. Fixtures live under $HOME: ambient temp dirs are
 * writable and would confound the ungranted-sibling control.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildNativeDenyCodexArgs } from '../../lib/isolation-provider.mjs';

const live = process.env.WE_CODEX_SANDBOX_TEST === '1';

describe.skipIf(!live)('4443 extra writable root vs Git metadata (live codex sandbox)', () => {
  let base; let impl; let we; let sib; let args;

  const sandbox = (cmd) => spawnSync(
    'codex', ['sandbox', '-P', 'locked', ...args, '--', 'sh', '-c', cmd], { cwd: impl, encoding: 'utf8' },
  );

  beforeAll(() => {
    base = realpathSync(mkdtempSync(join(homedir(), '.we-4443-')));
    [impl, we, sib] = ['impl', 'we', 'sib'].map((d) => join(base, d));
    for (const d of [impl, we, sib]) {
      mkdirSync(d);
      spawnSync('git', ['init', '-q', d]);
    }
    mkdirSync(join(we, 'backlog'));
    writeFileSync(join(we, '.git/hooks/pre-commit'), 'orig\n');
    args = buildNativeDenyCodexArgs([join(base, 'deny')], { writableRoots: [we] }).filter((a) => a !== '--strict-config');
  });
  afterAll(() => { if (base) rmSync(base, { recursive: true, force: true }); });

  it('4443 positive control: backlog write in the granted root succeeds (sandbox is usable)', () => {
    const r = sandbox(`echo ok > '${we}/backlog/a.md'`);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(readFileSync(join(we, 'backlog/a.md'), 'utf8')).toBe('ok\n');
  });

  it('4443 denies hook creation and overwrite', () => {
    expect(sandbox(`echo x > '${we}/.git/hooks/new'`).status).not.toBe(0);
    expect(sandbox(`echo x > '${we}/.git/hooks/pre-commit'`).status).not.toBe(0);
    expect(existsSync(join(we, '.git/hooks/new'))).toBe(false);
    expect(readFileSync(join(we, '.git/hooks/pre-commit'), 'utf8')).toBe('orig\n');
  });

  it('4443 denies metadata-root replacement and removal', () => {
    expect(sandbox(`mv '${we}/.git' '${we}/.git-moved'`).status).not.toBe(0);
    expect(sandbox(`rm -rf '${we}/.git'`).status).not.toBe(0);
    expect(existsSync(join(we, '.git/HEAD'))).toBe(true);
    expect(existsSync(join(we, '.git-moved'))).toBe(false);
  });

  it('4443 denies writes to an ungranted sibling', () => {
    expect(sandbox(`echo x > '${sib}/a'`).status).not.toBe(0);
    expect(existsSync(join(sib, 'a'))).toBe(false);
  });
});
