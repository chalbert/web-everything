/**
 * @file check-standards-rules-lane-journal-guard.test.mjs
 * @description #4370 — every `git reset --hard` / `git clean` / lease-marker `rmSync` in lane code sits next to
 * a `journalLaneEvent(...)` call (or carries a `journal-exempt: <why>` comment). Pure detector:
 * `findUnjournaledLaneMutations`; the last case runs it over the real lane files so the guard is green today.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { findUnjournaledLaneMutations, LANE_MUTATION_FILES } from '../check-standards-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = 'scripts/lane-pool.mjs';

describe('findUnjournaledLaneMutations', () => {
  it('flags a reset, a clean and a lease rmSync with no journal call nearby', () => {
    const content = [
      "git(['reset', '--hard', 'origin/main'], dir);",
      "git(['clean', '-fd'], dir);",
      'rmSync(LEASE_MARKER(dir), { force: true });',
    ].join('\n');
    const findings = findUnjournaledLaneMutations([{ file: FILE, content }]);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3]);
    expect(findings[0].reason).toMatch(/git reset --hard/);
    expect(findings[2].reason).toMatch(/lease-marker rmSync/);
  });

  it('is silent when a journal call is within the window, or the mutation is marked journal-exempt', () => {
    const journalled = ["execFileSync('git', ['reset', '--hard', ref]);", 'journalLaneEvent(dir, { action: "reclaim-reset" });'].join('\n');
    const exempt = ['// journal-exempt: a sibling clone, not a lane', "tryGit(['reset', '--hard', ref], dest);"].join('\n');
    expect(findUnjournaledLaneMutations([{ file: FILE, content: journalled }, { file: FILE, content: exempt }])).toEqual([]);
  });

  it('ignores comments that merely mention the command, and files outside the lane set', () => {
    expect(findUnjournaledLaneMutations([
      { file: FILE, content: "// runs ['reset', '--hard'] later" },
      { file: 'scripts/other.mjs', content: "git(['reset', '--hard'], d);" },
    ])).toEqual([]);
  });

  it('a journal call far outside the window does not count', () => {
    const content = ["git(['clean', '-fd'], dir);", ...Array(30).fill('noop();'), 'journalLaneEvent(dir, {});'].join('\n');
    expect(findUnjournaledLaneMutations([{ file: FILE, content }])).toHaveLength(1);
  });

  it('the real lane code is clean today', () => {
    const files = LANE_MUTATION_FILES.map((file) => ({ file, content: readFileSync(join(ROOT, file), 'utf8') }));
    expect(findUnjournaledLaneMutations(files)).toEqual([]);
  });
});
