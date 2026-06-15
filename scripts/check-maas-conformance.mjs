#!/usr/bin/env node
/**
 * check-maas-conformance.mjs — the opt-in .NET execution-conformance gate (backlog #549, slice 3 of #507).
 *
 * Drives the @generated MaaS origin (#548 — `GeneratedMaaSOrigin`) through the #506 conformance runner
 * against the frozen golden vectors, holding the foreign-language target to byte-identical / identity-
 * stable fidelity — the proof epic #507 was chartered to ship.
 *
 * Fork 1 (ratified, option B): this is a SEPARATE opt-in suite, kept OUT of the default gate. Driving the
 * C# target needs `dotnet` (compile + execute), a heavy toolchain not universally present — so the gate
 * DETECTS a capable `dotnet` and runs the suite when present, or SKIPS-WITH-NOTICE otherwise (exit 0). A
 * project whose CI guarantees `dotnet` promotes this into a required gate by making a non-skip outcome
 * mandatory (one line of CI config) — getting option A's "can never drift" guarantee without a different
 * runner. This is the canonical foreign-toolchain conformance shape (Protobuf/Connect) and how this repo
 * already treats heavy toolchains (Playwright `test:integration` is a separate script from `test:unit`).
 *
 * The free byte-level SOURCE snapshot (`generate.test.ts`) stays in the default vitest run regardless —
 * it needs no toolchain. This adds the executed-BEHAVIOUR layer on top, only where a toolchain exists.
 *
 * Run:  npm run check:maas-conformance         (auto-detect dotnet; skip-with-notice when absent)
 *       npm run check:maas-conformance -- --require   (treat a skip as failure — the strict CI posture)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRE = process.argv.slice(2).includes('--require');

/** The minimum .NET major version that compiles the generated origin (records, file-scoped namespaces, ranges). */
const MIN_DOTNET_MAJOR = 8;

/**
 * Candidate `dotnet` executables, in order: whatever is on PATH, then the known macOS install location
 * (the SDK is often installed there but not symlinked onto PATH — including on this repo's dev machine).
 */
const CANDIDATES = ['dotnet', '/usr/local/share/dotnet/dotnet', `${process.env.HOME ?? ''}/.dotnet/dotnet`];

/** Resolve the first candidate whose `--version` reports a major >= MIN_DOTNET_MAJOR, or null. */
function resolveCapableDotnet() {
  for (const candidate of CANDIDATES) {
    if (candidate.includes('/') && !existsSync(candidate)) continue;
    let version;
    try {
      version = execFileSync(candidate, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      continue; // not on PATH / not executable
    }
    const major = Number.parseInt(version.split('.')[0], 10);
    if (Number.isFinite(major) && major >= MIN_DOTNET_MAJOR) return { path: candidate, version };
  }
  return null;
}

const found = resolveCapableDotnet();

if (!found) {
  const notice = [
    `↷ check:maas-conformance — skipped (no .NET ${MIN_DOTNET_MAJOR}+ toolchain found).`,
    '  The generated .NET origin\'s EXECUTION conformance (#549) needs `dotnet` to compile + run the C#',
    '  host. The byte-level SOURCE snapshot (generate.test.ts) still gates drift in the default run.',
    '  Install .NET 8+ (or put it on PATH) and re-run to drive the generated origin against the golden',
    '  vectors. CI that guarantees dotnet can make this required with `-- --require`.',
  ].join('\n');
  console.log(notice);
  process.exit(REQUIRE ? 1 : 0);
}

console.log(`▶ check:maas-conformance — driving the generated .NET origin via dotnet ${found.version} (${found.path})`);

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vitest.maas-conformance.config.ts'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, MAAS_DOTNET: found.path } },
);

process.exit(result.status ?? 1);
