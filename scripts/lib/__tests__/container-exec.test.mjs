/**
 * @file scripts/lib/__tests__/container-exec.test.mjs
 * @description Unit proof for the #3621 heavy-command-pool container POC's pure argv/path-derivation logic,
 *   plus a REAL, self-skipping integration proof against the actual `container` CLI and the POC image when
 *   both are present (mirrors this repo's existing discipline of proving IO-shell code for real rather than
 *   only its injected-fake decision logic — see e.g. `scripts/lib/isolation-provider.mjs`'s own suite).
 *
 * The real proof this module cannot fully carry in CI: side-by-side fidelity of `check:standards` running
 * inside the container vs. on the host, and the CPU-cap containment result against 8 busy-spin loops. Both
 * were run and recorded manually while building this POC (see the PR that introduced this file for the
 * numbers) — reproducing them automatically needs a live git repo with a real `origin/main` and 20+ seconds
 * per assertion, which does not belong in the unit suite's fast feedback loop. The integration `describe`
 * block below proves the SAME argv-building/mount logic end-to-end against a real container, cheaply (a
 * `true`/`pwd` style command, not a real heavy command), which is enough to catch a real regression in the
 * plumbing without paying the slow, non-deterministic cost of the full fidelity proof on every run.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_CONTAINER_IMAGE, DEFAULT_CONTAINER_CPUS, DEFAULT_CONTAINER_MEMORY,
  resolveContainerImage, resolveContainerCpus, resolveContainerMemory,
  readAlternatesPrimaryRoot, buildContainerRunArgs, execContainerized,
  containerCliAvailable, containerImageAvailable, containerfileExists,
} from '../container-exec.mjs';

describe('resolveContainerImage/Cpus/Memory — env override, sane fallback (mirrors heavy-admission.mjs#resolveCap)', () => {
  it('defaults when unset', () => {
    expect(resolveContainerImage({})).toBe(DEFAULT_CONTAINER_IMAGE);
    expect(resolveContainerCpus({})).toBe(DEFAULT_CONTAINER_CPUS);
    expect(resolveContainerMemory({})).toBe(DEFAULT_CONTAINER_MEMORY);
  });
  it('reads the env override', () => {
    expect(resolveContainerImage({ WE_HEAVY_ADMISSION_CONTAINER_IMAGE: 'custom:tag' })).toBe('custom:tag');
    expect(resolveContainerCpus({ WE_HEAVY_ADMISSION_CONTAINER_CPUS: '4' })).toBe(4);
    expect(resolveContainerMemory({ WE_HEAVY_ADMISSION_CONTAINER_MEMORY: '4g' })).toBe('4g');
  });
  it('falls back to the default on a non-finite/sub-1 cpu count', () => {
    expect(resolveContainerCpus({ WE_HEAVY_ADMISSION_CONTAINER_CPUS: 'nope' })).toBe(DEFAULT_CONTAINER_CPUS);
    expect(resolveContainerCpus({ WE_HEAVY_ADMISSION_CONTAINER_CPUS: '0' })).toBe(DEFAULT_CONTAINER_CPUS);
  });
});

describe('readAlternatesPrimaryRoot — pure, over an injected readFile (why this mount exists at all)', () => {
  it('strips the trailing /.git/objects to get the primary checkout root', () => {
    const readFile = (p) => {
      expect(p).toBe('/lane/.git/objects/info/alternates');
      return '/Users/x/workspace/webeverything/.git/objects\n';
    };
    expect(readAlternatesPrimaryRoot('/lane', readFile)).toBe('/Users/x/workspace/webeverything');
  });
  it('tolerates no trailing newline and surrounding blank lines', () => {
    const readFile = () => '\n  /primary/root/.git/objects  \n\n';
    expect(readAlternatesPrimaryRoot('/lane', readFile)).toBe('/primary/root');
  });
  it('returns null when there is no alternates file (a primary checkout, or a non---reference clone)', () => {
    const readFile = () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); };
    expect(readAlternatesPrimaryRoot('/lane', readFile)).toBeNull();
  });
  it('returns null on an empty/malformed alternates file rather than a garbage slice', () => {
    expect(readAlternatesPrimaryRoot('/lane', () => '')).toBeNull();
    expect(readAlternatesPrimaryRoot('/lane', () => 'not a path at all')).toBeNull();
  });
});

describe('buildContainerRunArgs — the exact mount shape proven manually while building this POC', () => {
  it('mounts the checkout rw at its own absolute path, sets -w, caps cpus/memory, runs via sh -c', () => {
    const args = buildContainerRunArgs({ command: 'node scripts/check-standards.mjs', cwd: '/lane', cpus: 3, memory: '3g', image: 'img:tag' });
    expect(args).toEqual([
      'run', '--rm', '--cpus', '3', '--memory', '3g',
      '--volume', '/lane:/lane:rw',
      '-w', '/lane', 'img:tag', 'sh', '-c', 'node scripts/check-standards.mjs',
    ]);
  });

  it('adds a SECOND, read-only mount for the alternates primary root at its own identical path when present', () => {
    const args = buildContainerRunArgs({ command: 'true', cwd: '/lane', alternatesPrimaryRoot: '/primary' });
    expect(args).toContain('--volume');
    expect(args.join(' ')).toContain('--volume /primary:/primary:ro');
    // still mounts the lane itself too — order matters for nothing here, presence does.
    expect(args.join(' ')).toContain('--volume /lane:/lane:rw');
  });

  it('omits the alternates mount entirely when there is none', () => {
    const args = buildContainerRunArgs({ command: 'true', cwd: '/lane', alternatesPrimaryRoot: null });
    expect(args.filter((a) => a === '--volume')).toHaveLength(1);
  });

  it('uses the documented defaults when cpus/memory/image are omitted', () => {
    const args = buildContainerRunArgs({ command: 'true', cwd: '/lane' });
    expect(args).toEqual(expect.arrayContaining(['--cpus', String(DEFAULT_CONTAINER_CPUS), '--memory', DEFAULT_CONTAINER_MEMORY, DEFAULT_CONTAINER_IMAGE]));
  });
});

describe('execContainerized — the exec seam heavy-admission.mjs#runUnderAdmission injects', () => {
  it('resolves the alternates root for cwd, builds the argv, and shells out to the container binary with inherited stdio', () => {
    const calls = [];
    const execFile = (bin, argv, o) => calls.push({ bin, argv, opts: o });
    execContainerized('node scripts/check-standards.mjs', {
      cwd: '/lane', env: { WE_HEAVY_ADMISSION_CONTAINER_CPUS: '2' },
      execFile, readAlternates: () => '/primary',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].bin).toBe('container');
    expect(calls[0].argv).toEqual(expect.arrayContaining(['run', '--cpus', '2', '--volume', '/lane:/lane:rw', '--volume', '/primary:/primary:ro']));
    expect(calls[0].opts.stdio).toBe('inherit');
  });

  it('propagates a thrown error from the container binary (same shape execSync throws — status/message)', () => {
    const execFile = () => { const e = new Error('container run failed'); e.status = 5; throw e; };
    expect(() => execContainerized('false', { cwd: '/lane', execFile, readAlternates: () => null })).toThrow('container run failed');
  });
});

describe('containerCliAvailable / containerImageAvailable — presence probes, injectable', () => {
  it('reports true when the probe succeeds, false when it throws', () => {
    expect(containerCliAvailable(() => 'container CLI version 1.3.1')).toBe(true);
    expect(containerCliAvailable(() => { throw new Error('not found'); })).toBe(false);
  });
  it('finds a matching image:tag line, is false on no match or a throw', () => {
    const listing = 'NAME    TAG   DIGEST\nwe-heavy-admission  poc  abc123\nnode  22-alpine  def456\n';
    expect(containerImageAvailable('we-heavy-admission:poc', () => listing)).toBe(true);
    expect(containerImageAvailable('nonexistent:tag', () => listing)).toBe(false);
    expect(containerImageAvailable('x:y', () => { throw new Error('no daemon'); })).toBe(false);
  });
});

describe('the POC Containerfile actually exists on disk (this module points a build helper at it)', () => {
  it('containerfileExists is true against the real repo tree', () => expect(containerfileExists()).toBe(true));
});

// ── REAL integration proof — self-skips when the `container` CLI or POC image isn't present (Apple-Silicon
// -only tool; #3621's own permanent-portability finding) so this suite stays green in CI/on any other host. ──
const HAVE_CLI = containerCliAvailable();
const HAVE_IMAGE = HAVE_CLI && containerImageAvailable();

describe.skipIf(!HAVE_CLI || !HAVE_IMAGE)('REAL container integration — proves the argv this module builds actually runs', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'container-exec-test-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('runs a real command inside a real container against a real mounted directory, output reaches the host', () => {
    writeFileSync(join(dir, 'marker.txt'), 'hello-from-host\n', 'utf8');
    const out = execFileSync('container', buildContainerRunArgs({ command: 'cat marker.txt', cwd: dir }), { encoding: 'utf8' });
    expect(out.trim()).toBe('hello-from-host');
  });

  it('the CPU cap is real — a --cpus 1 container cannot report more than ~2 guest CPUs (the documented +1 off-by-one)', () => {
    const out = execFileSync('container', buildContainerRunArgs({ command: 'nproc', cwd: dir, cpus: 1 }), { encoding: 'utf8' });
    expect(Number(out.trim())).toBeLessThanOrEqual(2);
  });

  it('a write inside the container reaches the real host mount (rw fidelity)', () => {
    execFileSync('container', buildContainerRunArgs({ command: 'echo wrote-from-container > from-container.txt', cwd: dir }));
    expect(readFileSync(join(dir, 'from-container.txt'), 'utf8').trim()).toBe('wrote-from-container');
  });
});
