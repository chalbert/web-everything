/**
 * @file scripts/__tests__/daemon-overlay.test.mjs
 * @description The `scripts/daemon-overlay.mjs add` CLI's overlay-conflict guard (epic #3383/#4075). Live
 *   incident 2026-09-27: `lane/promote-stale-green` was registered while KNOWINGLY conflicting with
 *   `lane/fix-procedure` in a shared file — nothing refused it, so the next rebuild silently dropped it and its
 *   own fix never went live. Spawns the REAL CLI (never a mocked import) against a real temp origin+clone pair,
 *   exactly the shape a real daemon clone has — the same fixture pattern `daemon-rebuild.test.mjs` uses for
 *   {@link previewOverlayConflict} itself (the pure guard is tested there; this file proves the CLI wiring:
 *   refuse by default, `--allow-conflict --reason=` overrides and prints what it overrode, `--check` never
 *   mutates the overlay state file either way).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, '..', 'daemon-overlay.mjs');

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
function mktemp(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}
function writeFile(dir, name, content) {
  const full = join(dir, name);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
function makeAuthorClone(originDir) {
  const dir = join(mktemp('we-overlay-cli-author-'), 'w');
  const r = spawnSync('git', ['clone', '-q', originDir, dir], { encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
  if (r.status !== 0) throw new Error(`clone failed: ${r.stderr}`);
  return dir;
}
function pushBranch(originDir, ref, mutate, { base = 'origin/main' } = {}) {
  const dir = makeAuthorClone(originDir);
  gitOk(dir, ['fetch', '-q', 'origin']);
  gitOk(dir, ['checkout', '-q', '-B', ref, base]);
  mutate(dir);
  gitOk(dir, ['add', '-A']);
  gitOk(dir, ['commit', '-q', '-m', `overlay: ${ref}`]);
  gitOk(dir, ['push', '-q', 'origin', `HEAD:refs/heads/${ref}`]);
}
function advanceMain(originDir, mutate) {
  pushBranch(originDir, 'main', mutate, { base: 'origin/main' });
}

/** Fresh {originDir, cloneDir, env} — a real bare origin + a real working clone tracking it, one commit on
 *  main, every per-clone state dir a fresh mkdtemp (never `~/.claude/*`). */
function makeFixture() {
  const base = mktemp('we-overlay-cli-fixture-');
  const originDir = join(base, 'origin.git');
  const cloneDir = join(base, 'clone');
  mkdirSync(cloneDir, { recursive: true });
  gitOk(base, ['init', '--bare', '-q', originDir]);
  gitOk(cloneDir, ['init', '-q', '-b', 'main']);
  writeFile(cloneDir, 'README.md', 'init\n');
  gitOk(cloneDir, ['add', '-A']);
  gitOk(cloneDir, ['commit', '-q', '-m', 'init']);
  gitOk(cloneDir, ['remote', 'add', 'origin', originDir]);
  gitOk(cloneDir, ['push', '-q', '-u', 'origin', 'main']);
  gitOk(cloneDir, ['fetch', '-q', 'origin']);
  const overlayDir = mktemp('we-overlay-cli-state-');
  const env = { ...process.env, WE_DAEMON_OVERLAY_DIR: overlayDir };
  return { originDir, cloneDir, overlayDir, env };
}

function runCli(args, env) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL', env });
}

function overlayStateFile(overlayDir, cloneDir) {
  // one file per clone, named by a hash of its realpath — just read whatever the dir contains, there is only one.
  void cloneDir;
  const names = readdirSync(overlayDir).filter((n) => n.endsWith('.json'));
  return names.length ? JSON.parse(readFileSync(join(overlayDir, names[0]), 'utf8')) : null;
}

describe('daemon-overlay.mjs add — the overlay-conflict guard', () => {
  it('REFUSES (exit 3) a conflicting overlay by default, and registers NOTHING', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 1;\n'));
    pushBranch(originDir, 'lane/fix-procedure', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 2;\n'));
    pushBranch(originDir, 'lane/promote-stale-green', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 3;\n'));

    const first = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/fix-procedure', '--pr=2821'], env);
    expect(first.status).toBe(0);

    const second = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/promote-stale-green', '--pr=2826', '--json'], env);
    expect(second.status).toBe(3);
    expect(second.stderr).toMatch(/REFUSED/);
    expect(second.stderr).toMatch(/shared\.mjs/);
    expect(second.stderr).toMatch(/lane\/fix-procedure/);

    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state.overlays.map((o) => o.ref)).toEqual(['lane/fix-procedure']); // #2826 never registered
  });

  it('--allow-conflict --reason=... registers anyway, and PRINTS which overlay/file conflicts', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 1;\n'));
    pushBranch(originDir, 'lane/fix-procedure', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 2;\n'));
    pushBranch(originDir, 'lane/promote-stale-green', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 3;\n'));
    runCli(['add', `--clone=${cloneDir}`, '--ref=lane/fix-procedure', '--pr=2821'], env);

    const r = runCli([
      'add', `--clone=${cloneDir}`, '--ref=lane/promote-stale-green', '--pr=2826',
      '--allow-conflict', '--reason=operator-approved override',
    ], env);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/registering DESPITE a known conflict/);
    expect(r.stderr).toMatch(/shared\.mjs/);

    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state.overlays.map((o) => o.ref).sort()).toEqual(['lane/fix-procedure', 'lane/promote-stale-green']);
  });

  it('--allow-conflict with no --reason is a usage error (exit 2), never silently ignored', () => {
    const { cloneDir, env } = makeFixture();
    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/whatever', '--allow-conflict'], env);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--allow-conflict requires --reason/);
  });

  it('a clean (non-conflicting) overlay registers normally, no refusal at all', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    pushBranch(originDir, 'lane/fix-procedure', (dir) => writeFile(dir, 'a.mjs', 'a\n'));
    pushBranch(originDir, 'lane/other', (dir) => writeFile(dir, 'b.mjs', 'b\n'));
    runCli(['add', `--clone=${cloneDir}`, '--ref=lane/fix-procedure'], env);

    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/other'], env);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');

    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state.overlays.map((o) => o.ref).sort()).toEqual(['lane/fix-procedure', 'lane/other']);
  });

  it('--check reports the conflict but registers NOTHING — safe to run against a live clone', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 1;\n'));
    pushBranch(originDir, 'lane/fix-procedure', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 2;\n'));
    pushBranch(originDir, 'lane/promote-stale-green', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 3;\n'));
    runCli(['add', `--clone=${cloneDir}`, '--ref=lane/fix-procedure', '--pr=2821'], env);
    expect(existsSync(overlayDir)).toBe(true);
    const before = overlayStateFile(overlayDir, cloneDir);

    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/promote-stale-green', '--pr=2826', '--check', '--json'], env);
    expect(r.status).toBe(3);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.check.clean).toBe(false);
    expect(parsed.check.files).toEqual(['shared.mjs']);
    expect(parsed.wouldRegister).toBe(false);

    const after = overlayStateFile(overlayDir, cloneDir);
    expect(after).toEqual(before); // untouched — --check never calls addOverlay
  });

  it('--check on a clean candidate reports wouldRegister:true and still registers nothing', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    pushBranch(originDir, 'lane/solo', (dir) => writeFile(dir, 'c.mjs', 'c\n'));
    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/solo', '--check', '--json'], env);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.check.clean).toBe(true);
    expect(parsed.wouldRegister).toBe(true);
    // `--check` never calls `addOverlay` — no state file is ever created for this clone at all.
    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state?.overlays ?? []).toEqual([]);
  });

  // ── PR #2827 review findings ──────────────────────────────────────────────────────────────────────────────

  it('a stuck PINNED overlay (now conflicting with main) does not block an unrelated, clean add', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 1;\n'));
    pushBranch(originDir, 'lane/pinned-thing', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 2;\n'));
    expect(runCli(['add', `--clone=${cloneDir}`, '--ref=lane/pinned-thing', '--pinned'], env).status).toBe(0);
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 9;\n')); // pinned now conflicts
    pushBranch(originDir, 'lane/unrelated', (dir) => writeFile(dir, 'other.mjs', 'o\n'));

    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/unrelated'], env);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/lane\/pinned-thing/); // the stuck overlay is NAMED, not swallowed
    expect(r.stderr).toMatch(/pinned-overlay-conflict/);
    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state.overlays.map((o) => o.ref)).toEqual(['lane/pinned-thing', 'lane/unrelated']);
  });

  it('two CONCURRENT adds of mutually-conflicting refs register at most one of them', async () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    advanceMain(originDir, (dir) => writeFile(dir, 'shared.mjs', 'export const X = 1;\n'));
    pushBranch(originDir, 'lane/a', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 2;\n'));
    pushBranch(originDir, 'lane/b', (dir) => writeFile(dir, 'shared.mjs', 'export const X = 3;\n'));

    const { spawn } = await import('node:child_process');
    const run = (ref) => new Promise((res) => {
      const p = spawn(process.execPath, [CLI, 'add', `--clone=${cloneDir}`, `--ref=${ref}`], { env });
      let stderr = '';
      p.stderr.on('data', (d) => { stderr += d; });
      p.on('close', (status) => res({ status, stderr }));
    });
    const results = await Promise.all([run('lane/a'), run('lane/b')]);

    expect(results.map((x) => x.status).sort()).toEqual([0, 3]);
    const state = overlayStateFile(overlayDir, cloneDir);
    expect(state.overlays).toHaveLength(1);
  }, 60_000);

  it('--check against a corrupt overlay store fails (exit 1, wouldRegister:false) — never a false "would register"', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    pushBranch(originDir, 'lane/solo', (dir) => writeFile(dir, 'c.mjs', 'c\n'));
    expect(runCli(['add', `--clone=${cloneDir}`, '--ref=lane/solo'], env).status).toBe(0);
    const file = readdirSync(overlayDir).find((n) => n.endsWith('.json'));
    writeFileSync(join(overlayDir, file), '{not json');

    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/solo', '--check', '--json'], env);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).wouldRegister).toBe(false);
  });

  it('a merge-tree execution error is refused even with --allow-conflict (it is not a confirmed conflict)', () => {
    const { originDir, cloneDir, overlayDir, env } = makeFixture();
    const dir = makeAuthorClone(originDir);
    gitOk(dir, ['checkout', '-q', '--orphan', 'lane/unrelated']);
    gitOk(dir, ['rm', '-rq', '--cached', '.']);
    writeFile(dir, 'z.mjs', 'z\n');
    gitOk(dir, ['add', 'z.mjs']);
    gitOk(dir, ['commit', '-q', '-m', 'orphan']);
    gitOk(dir, ['push', '-q', 'origin', 'HEAD:refs/heads/lane/unrelated']);

    const r = runCli(['add', `--clone=${cloneDir}`, '--ref=lane/unrelated', '--allow-conflict', '--reason=try it'], env);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/merge-tree-failed/);
    expect(overlayStateFile(overlayDir, cloneDir)?.overlays ?? []).toEqual([]);
  });
});
