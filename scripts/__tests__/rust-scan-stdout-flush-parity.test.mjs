/**
 * @file scripts/__tests__/rust-scan-stdout-flush-parity.test.mjs
 * @description Cross-language differential proof for #3417's first Rust port: `scripts/rust-scan`'s
 *   `stdout-flush` subcommand must report the EXACT same findings as `scripts/lib/stdout-flush-scan.mjs`'s
 *   `scanStdoutFlush` over the same real file tree — a real `cargo build` and a real spawned binary, not an
 *   in-process stub, per the #3264 mechanics qualifier (this item's whole claim is "same behavior, different
 *   language", which an injected double cannot observe). Requires `cargo` on PATH; skips (not silently
 *   passes) if absent, since not every dev machine has the Rust toolchain yet.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanStdoutFlush } from '../lib/stdout-flush-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CRATE = join(ROOT, 'scripts', 'rust-scan');
const BIN = join(CRATE, 'target', 'release', 'we-scan');

const hasCargo = spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;

function normalize(hits) {
  return hits.map((h) => `${h.file}:${h.line}:${h.kind}:${h.text}`).sort();
}

function runRust(root, extraArgs = []) {
  const out = execFileSync(BIN, ['stdout-flush', `--root=${root}`, ...extraArgs], { encoding: 'utf8' });
  return JSON.parse(out);
}

describe.skipIf(!hasCargo)('we-scan stdout-flush — cross-language parity with the JS reference (#3417)', () => {
  beforeAll(() => {
    execFileSync('cargo', ['build', '--release'], { cwd: CRATE, stdio: 'inherit' });
  }, 180_000);

  it('matches over this real repo tree (scripts/ + skills-src/)', () => {
    const js = normalize(scanStdoutFlush(ROOT));
    const rust = normalize(runRust(ROOT));
    expect(rust).toEqual(js);
  });

  it('matches over a synthetic fixture tree covering all three violation kinds plus the #1730 regex-vs-division edge case', () => {
    const dir = mkdtempSync(join(tmpdir(), 'we-scan-parity-'));
    const scripts = join(dir, 'scripts');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(join(scripts, '__tests__'), { recursive: true });

    writeFileSync(
      join(scripts, 'a.mjs'),
      "function main() {\n  process.stdout.write(JSON.stringify({ ok: true }));\n  process.exit(0);\n}\nmain();\n",
    );
    writeFileSync(
      join(scripts, 'b.mjs'),
      "function fail(msg) {\n  process.stdout.write(msg + '\\n');\n  process.exit(2);\n}\nfunction run() {\n  if (bad) fail('nope');\n  process.stdout.write('ok\\n');\n}\nrun();\n",
    );
    writeFileSync(
      join(scripts, 'c.mjs'),
      'function main(argv) {\n  process.stdout.write(JSON.stringify(argv));\n  return 0;\n}\nprocess.exit(main(process.argv));\n',
    );
    writeFileSync(join(scripts, 'd.mjs'), "process.stdout.write('static banner\\n');\nprocess.exit(0);\n");
    writeFileSync(
      join(scripts, 'e.mjs'),
      // eslint-disable-next-line no-useless-escape
      'function f(x) {\n  if (x in/[&<>"\']/.test(x)) return;\n  process.stdout.write(JSON.stringify(x));\n  process.exit(0);\n}\n',
    );
    writeFileSync(
      join(scripts, 'f.mjs'),
      'const esc = (s) => String(s).replace(/[&<>"\']/g, (c) => c);\nfunction g(x) {\n  const msg = `${JSON.stringify({ error: x })}`;\n  process.stdout.write(msg);\n  process.exit(1);\n}\n',
    );
    writeFileSync(
      join(scripts, '__tests__', 'skip-me.mjs'),
      'process.stdout.write(JSON.stringify({}));\nprocess.exit(0);\n',
    );

    try {
      const js = normalize(scanStdoutFlush(dir));
      const rust = normalize(runRust(dir));
      expect(js.length).toBeGreaterThan(0); // guard against a vacuous fixture
      expect(rust).toEqual(js);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the parallel scan (multiple --max-workers) still matches the JS reference', () => {
    const js = normalize(scanStdoutFlush(ROOT));
    for (const n of [1, 2, 4]) {
      const rust = normalize(runRust(ROOT, [`--max-workers=${n}`]));
      expect(rust).toEqual(js);
    }
  });

  it('the DEFAULT worker count (no --max-workers flag) still matches the JS reference', () => {
    // Locks in the fixed stopgap default (3, until the operation manager can set this per-run) — a wrong
    // default is exactly the kind of thing that passes every explicit-flag test and still breaks in the wild.
    const js = normalize(scanStdoutFlush(ROOT));
    const rust = normalize(runRust(ROOT));
    expect(rust).toEqual(js);
  });
});
