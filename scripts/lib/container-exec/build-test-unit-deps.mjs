#!/usr/bin/env node
/**
 * @file scripts/lib/container-exec/build-test-unit-deps.mjs
 * @description Image-build automation for the `test:unit` container slice (#3621 sequencing note, tracked on
 *   #3383) — the piece the `check:standards`-only POC named as a named open gap ("no image-build automation
 *   exists yet"). Builds `Containerfile.test-unit-deps` (a real LINUX `npm ci`, ~15-20s — see that file's own
 *   header for why plain `node:22-alpine` is enough, no compiler toolchain needed) and seeds a named
 *   `container volume` (default: `container-exec.mjs#DEFAULT_NODE_MODULES_VOLUME`) from the resulting
 *   `/app/node_modules`, so `container-exec.mjs#execContainerized`'s `nodeModulesVolume` mount has something
 *   real to shadow the host-darwin `node_modules` with at run time.
 *
 * Usage:
 *   node scripts/lib/container-exec/build-test-unit-deps.mjs [status] [--force] [--image=<tag>] [--volume=<name>]
 *
 * `status` (no build/seed) reports whether the image/volume exist and whether the volume's seeded
 * `package-lock.json` hash MATCHES the repo's current lockfile — a stale seed (lockfile changed since the last
 * seed) is reported, not auto-rebuilt, unless `--force` (or the default `build` mode) is used; this keeps a
 * `status` check cheap/safe to run from a preflight (mirrors `heavy-admission.mjs run --container`'s own
 * "tell the caller what to run" pattern for a missing image, rather than a silent surprise rebuild).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveTestUnitDepsImage, resolveNodeModulesVolume,
  containerCliAvailable, nodeModulesVolumeAvailable, containerImageAvailable,
  testUnitDepsContainerfilePath, testUnitDepsContainerfileExists,
} from '../container-exec.mjs';
import { writeAllSync } from '../write-all-sync.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MARKER = '.deps-lockfile-hash';

function lockfileHash(repoRootPath = repoRoot) {
  const raw = readFileSync(join(repoRootPath, 'package-lock.json'), 'utf8');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function sh(argv, opts = {}) {
  return execFileSync(argv[0], argv.slice(1), { stdio: 'inherit', ...opts });
}

function capture(argv) {
  return execFileSync(argv[0], argv.slice(1), { encoding: 'utf8' });
}

function parseFlags(argv) {
  const flags = {}; const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true; else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positionals.push(a);
  }
  return { flags, positionals };
}

async function main(argv) {
  const { flags, positionals } = parseFlags(argv);
  const mode = positionals[0] || 'build';
  const image = typeof flags.image === 'string' ? flags.image : resolveTestUnitDepsImage(process.env);
  const volume = typeof flags.volume === 'string' ? flags.volume : resolveNodeModulesVolume(process.env);

  if (!containerCliAvailable()) {
    process.stderr.write('✗ the `container` CLI is not available on this host (Apple-Silicon-only tool).\n');
    process.exit(1);
  }
  if (!testUnitDepsContainerfileExists()) {
    process.stderr.write(`✗ missing ${testUnitDepsContainerfilePath()}\n`);
    process.exit(1);
  }

  const wantHash = lockfileHash();

  if (mode === 'status') {
    const hasImage = containerImageAvailable(image);
    const hasVolume = nodeModulesVolumeAvailable(volume);
    let seededHash = null;
    if (hasVolume) {
      try {
        seededHash = capture(['container', 'run', '--rm', '--volume', `${volume}:/vol`, 'node:22-alpine', 'cat', `/vol/${MARKER}`]).trim();
      } catch { /* no marker yet — pre-dates this script, or never seeded */ }
    }
    const stale = hasVolume && seededHash !== wantHash;
    // `writeAllSync` (not a bare `process.stdout.write` + `process.exit`) — a `write` immediately followed by
    // `exit` can truncate the pipe before the OS drains it (the #2967 emit-then-exit gate `check:standards`
    // enforces repo-wide); this drains for real before setting the exit code.
    writeAllSync(1, JSON.stringify({ image, volume, hasImage, hasVolume, seededHash, currentHash: wantHash, stale }, null, 2) + '\n');
    process.exitCode = hasImage && hasVolume && !stale ? 0 : 2;
    return;
  }

  if (mode !== 'build') {
    process.stderr.write('usage: build-test-unit-deps.mjs [status|build] [--force] [--image=] [--volume=]\n');
    process.exit(3);
  }

  if (!flags.force && nodeModulesVolumeAvailable(volume)) {
    let seededHash = null;
    try { seededHash = capture(['container', 'run', '--rm', '--volume', `${volume}:/vol`, 'node:22-alpine', 'cat', `/vol/${MARKER}`]).trim(); } catch { /* stale/no marker — rebuild below */ }
    if (seededHash === wantHash) {
      process.stderr.write(`✓ ${volume} already seeded for the current lockfile (${wantHash}) — nothing to do (--force to rebuild anyway).\n`);
      return;
    }
  }

  process.stderr.write(`→ building ${image} from ${testUnitDepsContainerfilePath()}…\n`);
  sh(['container', 'build', '-f', testUnitDepsContainerfilePath(), '-t', image, repoRoot]);

  process.stderr.write(`→ (re)creating volume ${volume}…\n`);
  try { sh(['container', 'volume', 'create', volume]); } catch { /* already exists — fine, we overwrite its content below */ }

  process.stderr.write(`→ seeding ${volume} from ${image}'s /app/node_modules…\n`);
  sh(['container', 'run', '--rm', '--volume', `${volume}:/vol`, image,
    'sh', '-c', `rm -rf /vol/* /vol/.[!.]* 2>/dev/null; cp -a /app/node_modules/. /vol/ && echo -n '${wantHash}' > /vol/${MARKER}`]);

  process.stderr.write(`✓ ${volume} seeded (lockfile hash ${wantHash}).\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`✗ build-test-unit-deps error: ${String(e && e.stack || e)}\n`); process.exit(1); });
}

export { lockfileHash, parseFlags, MARKER };
