/**
 * @file operator-queue-entry.test.mjs — the CLI entry guard must hold for a symlinked / oddly-spelled argv[1].
 *
 * Regression: `node $TMPDIR/operator-queue.mjs` (macOS `$TMPDIR` ends in `//`) or a copy under `/tmp`
 * (a symlink to `/private/tmp`) printed nothing and exited 0, because the guard compared the resolved
 * `import.meta.url` with the UNRESOLVED argv path, so `main()` never ran.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isCliEntry } from '../operator-queue.mjs';

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '..', 'operator-queue.mjs');
// The queue imports its advisory parser from `../lib/`, so a copy is only runnable with that leaf beside it in
// the same `operations/` + `lib/` layout — stage both, then run the copy under `<root>/operations/`.
const LEAF = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'advisory-labels.mjs');
const stage = (root) => {
  mkdirSync(join(root, 'operations'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  copyFileSync(SOURCE, join(root, 'operations', 'operator-queue.mjs'));
  copyFileSync(LEAF, join(root, 'lib', 'advisory-labels.mjs'));
  copyFileSync(join(dirname(LEAF), 'constellation-repos.mjs'), join(root, 'lib', 'constellation-repos.mjs'));
  mkdirSync(join(root, 'conveyor'));
  copyFileSync(join(dirname(LEAF), '../conveyor/unsupported-repo.mjs'), join(root, 'conveyor/unsupported-repo.mjs'));
  // The queue also reads its STOOD DOWN section off `../conveyor/stand-down.mjs` (we:backlog/x6cjgz5) — stage it
  // too, or the staged copy fails to import and `main()` never runs.
  copyFileSync(join(dirname(LEAF), '../conveyor/stand-down.mjs'), join(root, 'conveyor/stand-down.mjs'));
  // …and its STUCK — INSPECTED section off `../conveyor/stuck-pr-dispatch-marker.mjs` (epic #3383) — same
  // reason: an unstaged import fails the copy silently and `main()` never runs.
  copyFileSync(join(dirname(LEAF), '../conveyor/stuck-pr-dispatch-marker.mjs'), join(root, 'conveyor/stuck-pr-dispatch-marker.mjs'));
};

let dir;
let env;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'we-op-queue-entry-')));
  mkdirSync(join(dir, 'bin'));
  // Fake `gh` so the run never touches the network: every repo has zero open PRs.
  writeFileSync(join(dir, 'bin', 'gh'), '#!/bin/sh\necho "[]"\n');
  chmodSync(join(dir, 'bin', 'gh'), 0o755);
  env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}` };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const run = (scriptPath) => spawnSync(process.execPath, [scriptPath, '--repo=x/y'], { encoding: 'utf8', env });

describe('operator-queue CLI entry guard', () => {
  it('runs main() when invoked through a symlinked directory', () => {
    stage(join(dir, 'real'));
    symlinkSync(join(dir, 'real'), join(dir, 'link'));
    const result = run(join(dir, 'link', 'operations', 'operator-queue.mjs'));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NEEDS YOU');
  });

  it('runs main() when invoked through a symlink to the file and a doubled slash', () => {
    stage(join(dir, 'real'));
    symlinkSync(join(dir, 'real', 'operations', 'operator-queue.mjs'), join(dir, 'real', 'operations', 'alias.mjs'));
    const result = run(`${dir}/real//operations//alias.mjs`);
    expect(result.stdout).toContain('NEEDS YOU');
  });

  it('isCliEntry is false when imported (argv[1] is another file) or when argv[1] is missing', () => {
    expect(isCliEntry(fileURLToPath(import.meta.url))).toBe(false);
    expect(isCliEntry(undefined)).toBe(false);
  });

  it('isCliEntry falls back to the raw path when argv[1] does not exist', () => {
    expect(isCliEntry(join(dir, 'missing.mjs'), 'file:///nowhere.mjs')).toBe(false);
  });
});
