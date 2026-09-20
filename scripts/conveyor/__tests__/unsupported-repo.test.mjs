import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readUnsupported, recordUnsupported } from '../unsupported-repo.mjs';

const dirs = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
it('replaces and clears one repo while preserving the others and stamping time', () => {
  const dir = mkdtempSync(join(tmpdir(), 'unsupported-')); dirs.push(dir);
  const path = join(dir, 'rows.json');
  const now = () => '2026-09-20T00:00:00.000Z';
  expect(readUnsupported({ path })).toEqual([]);
  recordUnsupported({ repo: 'frontierui', rows: [{ prNumber: 1 }], path, now });
  recordUnsupported({ repo: 'plateau-app', rows: [{ prNumber: 2 }], path, now });
  recordUnsupported({ repo: 'frontierui', rows: [{ prNumber: 3 }], path, now });
  expect(readUnsupported({ path })).toEqual([
    { repo: 'plateau-app', prNumber: 2, at: now() }, { repo: 'frontierui', prNumber: 3, at: now() },
  ]);
  recordUnsupported({ repo: 'frontierui', rows: [], path });
  expect(readUnsupported({ path })).toEqual([{ repo: 'plateau-app', prNumber: 2, at: now() }]);
  for (const corrupt of ['{', '{}', '[null]']) {
    writeFileSync(path, corrupt);
    expect(readUnsupported({ path })).toEqual([]);
  }
});
