/**
 * @file scripts/lib/__tests__/daemon-clone-stays-clean.test.mjs
 * @description End-to-end proof for the 2026-09-24 freeze fix (a live daemon clone froze because a daemon
 *   wrote an untracked `.conveyor/unsupported-repo.json` and the tree read as dirty). This suite never touches
 *   the real lane clone or any real daemon state dir — it builds a THROWAWAY git repo that carries a COPY of
 *   this repo's real `.gitignore` and a COPY of the real `scripts/conveyor/unsupported-repo.mjs` at its real
 *   relative path, runs a REAL write through that module (not a hand-authored JSON file — the actual code path
 *   a resident daemon uses), writes every other daemon/session-state sidecar this codebase is known to drop
 *   into a clone, and asserts `git status` still reads completely clean. A second test proves it is the
 *   `.gitignore` doing the work, not the specific filenames above, by checking an arbitrary never-seen-before
 *   path under `.conveyor/`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// scripts/lib/__tests__ -> scripts/lib -> scripts -> repo root
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, '..', '..', '..');

const tempDirs = [];

function mktemp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function git(cwd, args) {
  return spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
  });
}
function gitOk(cwd, args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

function writeFile(dir, relPath, content) {
  const full = join(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Copy a real file from THIS repo into the throwaway repo at the SAME relative path — required so a module
 *  that resolves its own state-file path via `import.meta.url` (as `unsupported-repo.mjs` does) writes to the
 *  same relative location (`../../.conveyor/...`) inside the throwaway repo as it would in a real clone. */
function copyRealFile(dir, relPath) {
  const src = join(REPO_ROOT, relPath);
  const dst = join(dir, relPath);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

beforeEach(() => {
  tempDirs.length = 0;
});
afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

/** A fresh throwaway repo: real `.gitignore`, real `scripts/conveyor/unsupported-repo.mjs`, one commit. */
function makeThrowawayRepo() {
  const dir = mktemp('we-daemon-clone-stays-clean-');
  gitOk(dir, ['init', '-q', '-b', 'main']);
  copyRealFile(dir, '.gitignore');
  copyRealFile(dir, 'scripts/conveyor/unsupported-repo.mjs');
  writeFile(dir, 'README.md', 'throwaway repo for daemon-clone-stays-clean.test.mjs\n');
  gitOk(dir, ['add', '-A']);
  gitOk(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

describe('a daemon clone stays git-clean under real daemon-state writes', () => {
  it('a real write through unsupported-repo.mjs, plus every other known daemon sidecar, leaves the tree clean', () => {
    const dir = makeThrowawayRepo();

    // The REAL write path a resident daemon uses — not a hand-authored JSON file. `recordUnsupported` resolves
    // its own target path relative to the module's own file location (`../../.conveyor/unsupported-repo.json`
    // from scripts/conveyor/), so this genuinely lands at `<dir>/.conveyor/unsupported-repo.json`.
    const script = "import { recordUnsupported } from './scripts/conveyor/unsupported-repo.mjs';\n"
      + "recordUnsupported({ repo: 'we', rows: [{ reason: 'daemon-clone-stays-clean-test' }] });\n";
    const run = spawnSync('node', ['--input-type=module', '-e', script], {
      cwd: dir, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL',
    });
    expect(run.status, run.stderr).toBe(0);
    expect(existsSync(join(dir, '.conveyor', 'unsupported-repo.json'))).toBe(true);

    // Every other daemon/session-state file this codebase is known to write into a clone (per the .gitignore's
    // own individual `.conveyor/*` entries, plus the settings-override entry).
    writeFile(dir, '.conveyor/queue.json', '{}\n');
    writeFile(dir, '.conveyor/dispatch-log.json', '{}\n');
    writeFile(dir, '.conveyor/driver-status.json', '{}\n');
    writeFile(dir, '.conveyor/review-daemon.log', 'log line\n');
    writeFile(dir, '.conveyor/jury/x.json', '{}\n');
    // Deliberately not one of the individually-listed `.conveyor/*` entries — proves the new directory-wide
    // `.conveyor/` rule, not just the older itemized ones, is what keeps a clone clean.
    writeFile(dir, '.conveyor/some-future-state.json', '{}\n');
    writeFile(dir, '.claude/settings.local.json', '{}\n');

    const status = gitOk(dir, ['status', '--porcelain', '--untracked-files=all']);
    expect(status.trim()).toBe('');
  });

  it('the .gitignore itself is what keeps an arbitrary new .conveyor/ path clean (not just the listed filenames)', () => {
    const dir = makeThrowawayRepo();
    const check = git(dir, ['check-ignore', '-q', '.conveyor/brand-new.json']);
    expect(check.status).toBe(0);
  });
});
