/**
 * @file scripts/__tests__/session-replay.test.mjs
 * @description #2272 — proof of the Tier-B session-replay harness's MECHANICS: substrate creation,
 * fixture seeding, invariant assertion, and teardown. This does NOT (and cannot) test the judgment
 * skill itself — that is session-run, LLM-driven, and has no deterministic output (the whole reason
 * #2272 exists). What IS deterministic, and what this suite proves, is the harness scaffolding around
 * it: `open` produces a real throwaway origin+clone seeded from the golden corpus; `check` correctly
 * PASSES when the fabricated invariants hold and FAILS when a direct main push is simulated; `close`
 * discards the substrate.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/session-replay.mjs');
const GIT_IDENTITY = ['-c', 'user.email=t@t.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false'];

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status ?? 1, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

function git(args, cwd) {
  return execFileSync('git', [...GIT_IDENTITY, ...args], { cwd, encoding: 'utf8' }).trim();
}

function parseWorkDir(openOut) {
  const line = openOut.split('\n').find((l) => l.trim().startsWith('work dir:'));
  return line.split('work dir:')[1].trim();
}

const opened = [];
afterEach(() => {
  for (const base of opened.splice(0)) {
    try {
      rmSync(base, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
});

describe('session-replay open — substrate + fixture seeding (#2272)', () => {
  it('creates a throwaway origin+work clone seeded from a golden-corpus fixture, with a manifest', () => {
    const r = run(['open', '--skill=batch']);
    expect(r.code).toBe(0);
    const workDir = parseWorkDir(r.out);
    opened.push(dirname(workDir));

    expect(existsSync(workDir)).toBe(true);
    expect(existsSync(join(workDir, '.replay-session.json'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(workDir, '.replay-session.json'), 'utf8'));
    expect(manifest.skill).toBe('batch');
    expect(manifest.stoppedAt).toBeNull();
    expect(manifest.invariantIds).toContain('tier-b.producer-never-merges-never-pushes-main');
    expect(existsSync(join(workDir, manifest.seededFile))).toBe(true);

    // the work dir is a real git clone with the seed + fixture commit, pushed to its own fabricated origin.
    expect(git(['rev-parse', 'origin/main'], workDir)).toBe(git(['rev-parse', 'HEAD'], workDir));
  });

  it('rejects an unwired --skill without touching disk', () => {
    const r = run(['open', '--skill=drain']);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/not wired yet/);
  });
});

describe('session-replay check — Tier-B invariant assertion (#2272)', () => {
  it('FAILS batch-hard-stop and PASSES the others on a freshly-opened, unstamped substrate', () => {
    const openR = run(['open', '--skill=batch']);
    const workDir = parseWorkDir(openR.out);
    opened.push(dirname(workDir));

    const r = run(['check', `--dir=${workDir}`]);
    expect(r.code).toBe(1); // unstamped manifest ⇒ hard-stop invariant unmet
    expect(r.out).toMatch(/PASS tier-b\.lane-isolation-never-primary-checkout/);
    expect(r.out).toMatch(/PASS tier-b\.producer-never-merges-never-pushes-main/);
    expect(r.out).toMatch(/FAIL tier-b\.batch-hard-stop-guarantees-termination/);
  });

  it('PASSES all three once the session stamps a terminal marker', () => {
    const openR = run(['open', '--skill=batch']);
    const workDir = parseWorkDir(openR.out);
    opened.push(dirname(workDir));

    const manifestPath = join(workDir, '.replay-session.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.stoppedAt = new Date().toISOString();
    manifest.itemsProcessed = 1;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const r = run(['check', `--dir=${workDir}`]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/All 3 Tier-B invariant\(s\) held/);
  });

  it('FAILS producer-never-merges when a direct push to main is simulated', () => {
    const openR = run(['open', '--skill=batch']);
    const workDir = parseWorkDir(openR.out);
    opened.push(dirname(workDir));

    // Simulate the exact violation the invariant guards: a direct commit+push to main, bypassing any
    // lane/PR flow, from a SEPARATE clone (mirrors a real skill pushing from its own checkout).
    const manifest = JSON.parse(readFileSync(join(workDir, '.replay-session.json'), 'utf8'));
    const otherClone = mkdtempSync(join(tmpdir(), 'session-replay-violator-'));
    git(['clone', '--quiet', manifest.originDir, otherClone]);
    writeFileSync(join(otherClone, 'DIRECT_MAIN_PUSH.txt'), 'bypassed the lane/PR flow\n');
    git(['add', '-A'], otherClone);
    git(['commit', '--quiet', '-m', 'violation: direct main push'], otherClone);
    git(['push', '--quiet', 'origin', 'main'], otherClone);
    rmSync(otherClone, { recursive: true, force: true });

    const r = run(['check', `--dir=${workDir}`]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/FAIL tier-b\.producer-never-merges-never-pushes-main/);
    expect(r.out).toMatch(/a direct push\/merge to main was observed/);
  });
});

describe('session-replay close — teardown (#2272)', () => {
  it('discards the entire substrate (origin + work dir)', () => {
    const openR = run(['open', '--skill=batch']);
    const workDir = parseWorkDir(openR.out);
    const base = dirname(workDir);

    const r = run(['close', `--dir=${workDir}`]);
    expect(r.code).toBe(0);
    expect(existsSync(base)).toBe(false);
  });

  it('REFUSES to delete a --dir that does not look like a harness work dir (safety guard)', () => {
    // A malformed/wrong --dir (here: the substrate's own base, one level too high — the exact shape of
    // a fat-fingered or hallucinated argument) must NOT be recursively deleted.
    const openR = run(['open', '--skill=batch']);
    const workDir = parseWorkDir(openR.out);
    const base = dirname(workDir);
    opened.push(base);

    const r = run(['close', `--dir=${base}`]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/refusing to delete/);
    expect(existsSync(base)).toBe(true); // nothing was deleted
    expect(existsSync(workDir)).toBe(true);
  });
});
