/**
 * @file scripts/__tests__/stdout-flush.test.mjs
 * @description Regression proof that the two DECISION-CORRUPTING `write(); process.exit()` truncation sites
 *   deliver their FULL payload to a capturing parent (#3061), plus the guards that keep the drain helper single.
 *
 * THE BUG. `process.stdout.write` / `console.log` to a PIPE is asynchronous in Node once the payload passes the
 * pipe buffer; `process.exit()` tears the process down without waiting, so the tail is dropped — silently, with
 * a zero status. Measured on this checkout, 2026-08-10:
 *
 *   | command                          | to a file  | through `execFileSync` |
 *   |----------------------------------|------------|------------------------|
 *   | `check-standards.mjs --json`     | 1 143 763  | 8 192 (unparseable)    |
 *   | `lane-review.mjs diff`           | 1 355 035  | 8 192 (0.6 % of it)    |
 *
 * `lane-review.mjs diff` is the severe one: skills-src/batch-backlog-items/parallel-execute.workflow.js step 7
 * hands exactly this stdout to the #2170 pre-PR independent reviewer, which therefore signed off on the first
 * few hunks of a 1.4 MB change and reported clean.
 *
 * WHY THESE TESTS ARE SHAPED THIS WAY — four properties, each load-bearing, each measured (#3061):
 *   1. Spawn a REAL child. An in-process `main()` call never touches a pipe and always passes.
 *   2. CAPTURE stdout — never inherit it and never redirect it to a file. A file fd is synchronous and wins the
 *      flush race, so a redirect-based assertion passes even on the broken code.
 *   3. Assert the payload PARSES, not merely that it is long. Truncated JSON is long too.
 *   4. Use `execFileSync`, NOT a shell pipe. The same `lane-review diff` payload delivered 8 192 bytes through
 *      `execFileSync` but 65 536 through `sh -c '… | wc -c'` — a shell-pipe test passes on a payload that
 *      `execFileSync` truncates. Both variants are asserted below so the distinction stays pinned.
 *
 * Reverting either fix fails these tests (verified by reverting both, 2026-08-10).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK_STANDARDS = join(ROOT, 'scripts', 'check-standards.mjs');
const LANE_REVIEW = join(ROOT, 'scripts', 'lane-review.mjs');

/** The macOS pipe-buffer floor an `execFileSync` consumer truncated at. Payloads must clear it comfortably. */
const PIPE_FLOOR = 8192;

/**
 * Run a node script and CAPTURE its stdout through a genuine `execFileSync` pipe (property 4). A non-zero exit
 * is expected for a gate, so the thrown error's own `stdout` is returned — the payload is what is under test,
 * never the status. `maxBuffer` is generous so a real truncation is the ONLY thing that can shorten the result.
 */
function captureViaExecFileSync(script, args, opts = {}) {
  try {
    return execFileSync(process.execPath, [script, ...args], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts,
    });
  } catch (e) {
    if (typeof e.stdout === 'string') return e.stdout;
    throw e;
  }
}

describe('check-standards.mjs --json survives a capturing parent (#3061)', () => {
  let out;
  beforeAll(() => { out = captureViaExecFileSync(CHECK_STANDARDS, ['--json']); }, 120_000);

  it('delivers far more than the pipe-buffer floor through execFileSync', () => {
    expect(Buffer.byteLength(out, 'utf8')).toBeGreaterThan(PIPE_FLOOR * 10);
  });

  it('PARSES — length alone is worthless, truncated JSON is long too (property 3)', () => {
    const parsed = JSON.parse(out); // throws "Unterminated string in JSON at position 8154" when truncated
    expect(typeof parsed.ok).toBe('boolean');
    // The whole point of the machine feed: a consumer can read the verdict AND the finding lists off the tail
    // of the payload, which is exactly what truncation removes.
    expect(parsed.summary).toBeTruthy();
    expect(Array.isArray(parsed.errors)).toBe(true);
    expect(Array.isArray(parsed.warnings)).toBe(true);
    expect(parsed.summary.errors).toBe(parsed.errors.length);
    expect(parsed.summary.warnings).toBe(parsed.warnings.length);
  });

  it('never calls process.exit — remedy (a) is the only fix that also repairs the human console.log loop', () => {
    // The gate's human mode is a `console.log` LOOP (many small async writes) which truncates RACILY under
    // `process.exit`; only letting Node drain and fall off the end fixes both modes. A future edit that
    // reintroduces `process.exit(` here silently re-breaks the human mode with every JSON test still green.
    // Comment lines are stripped first so the file may still NAME the pattern it must not call.
    const code = readFileSync(CHECK_STANDARDS, 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(code).not.toMatch(/process\.exit\(/);
    expect(code).toMatch(/process\.exitCode\s*=/);
  });
});

describe('check-standards.mjs human mode survives a capturing parent (#3061)', () => {
  // The human (non-`--json`) mode is a `console.log` loop, so it truncates racily rather than deterministically
  // — 337 131 bytes to a file vs 302 018 through a slow pipe on the broken code. Its LAST line is the summary,
  // so asserting the summary arrived is the exact tail-loss detector, and it does not depend on the race.
  it('delivers its final summary line, not just the first N KB of warnings', () => {
    const out = captureViaExecFileSync(CHECK_STANDARDS, []);
    expect(Buffer.byteLength(out, 'utf8')).toBeGreaterThan(PIPE_FLOOR * 10);
    expect(out.trimEnd().split('\n').pop()).toMatch(/\d+ error\(s\).*\d+ warning\(s\)/);
  }, 120_000);
});

describe('lane-review.mjs diff survives a capturing parent — the #2170 reviewer feed (#3061)', () => {
  let repo;
  let base;
  const BIG_LINES = 8000; // ~300 KB of added text: ~37x the pipe floor, so truncation cannot hide

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'lane-review-flush-'));
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
    git('init', '--quiet');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(join(repo, 'seed.txt'), 'seed\n');
    git('add', 'seed.txt');
    git('commit', '--quiet', '-m', 'seed');
    base = git('rev-parse', 'HEAD').trim();
    // A payload whose LAST line is unique, so "did the tail arrive?" is a single exact assertion.
    const body = Array.from({ length: BIG_LINES }, (_, i) => `line ${i} — padding to clear the pipe buffer`).join('\n');
    writeFileSync(join(repo, 'big.txt'), `${body}\n`);
    git('add', 'big.txt');
    git('commit', '--quiet', '-m', 'big');
  });

  afterAll(() => { if (repo) rmSync(repo, { recursive: true, force: true }); });

  it('delivers the WHOLE diff through execFileSync (property 4 — the strictest consumer)', () => {
    const out = captureViaExecFileSync(LANE_REVIEW, ['diff', `--base=${base}`, `--repo=${repo}`]);
    expect(Buffer.byteLength(out, 'utf8')).toBeGreaterThan(PIPE_FLOOR * 10);
    // "Parses" for a diff = STRUCTURALLY COMPLETE, not non-empty: every added line is present and the final one
    // is the last line of the file we committed. Truncation loses the tail, so this is the load-bearing check.
    const added = out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    expect(added.length).toBe(BIG_LINES);
    expect(added.at(-1)).toBe(`+line ${BIG_LINES - 1} — padding to clear the pipe buffer`);
  }, 60_000);

  it('also survives a SHELL pipe — the weaker consumer a naive test would have used', () => {
    // Pinned only to keep property 4 honest: this variant carried 65 536 bytes of the same payload on the BROKEN
    // code, i.e. it would have passed while `execFileSync` still lost 99.4 %. Never the only assertion.
    const cmd = `${JSON.stringify(process.execPath)} ${JSON.stringify(LANE_REVIEW)} diff --base=${base} --repo=${JSON.stringify(repo)} | cat`;
    const out = execFileSync('/bin/sh', ['-c', cmd], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const added = out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    expect(added.length).toBe(BIG_LINES);
  }, 60_000);

  it('emits byte-for-byte what git produced — the fix changed the FLUSH, never the output', () => {
    const viaScript = captureViaExecFileSync(LANE_REVIEW, ['diff', `--base=${base}`, `--repo=${repo}`]);
    const viaGit = execFileSync('git', ['diff', `${base}...HEAD`], { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    expect(viaScript).toBe(viaGit); // no added/stripped trailing newline — `writeAllSync` is byte-transparent
  }, 60_000);

  it('routes every stdout emit through the shared drain, keeping its guard exits in place', () => {
    const src = readFileSync(LANE_REVIEW, 'utf8');
    // `runCli` is a chain of guard branches that must halt IN PLACE, so remedy (b) applies: the `process.exit`
    // stays and the WRITE is what changed. Nothing may write to stdout raw here.
    expect(src).not.toMatch(/process\.stdout\.write\(/);
    expect(src).toMatch(/import \{ writeAllSync \} from '\.\/lib\/write-all-sync\.mjs'/);
  });
});

describe('the drain helper has exactly ONE home (#3061)', () => {
  // WHY A GUARD AND NOT A COMMENT. This loop was copy-pasted into three files and five files carried
  // near-identical prose about the pipe buffer — five local rediscoveries, never a rule. A fourth copy is
  // script-decidable, so it is a test, not a reviewer's attention (#51).
  // `__tests__` is skipped, and that is not a loophole: a test may only DESCRIBE the loop (this file does, in a
  // comment), and a test file cannot be the runtime home a CLI imports — so a copy there is not the defect. It
  // also stops the guard from self-matching on its own explanatory prose.
  const SKIP = new Set(['node_modules', '.git', 'dist', '_site', 'coverage', '__tests__']);
  const sources = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(ent.name)) continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(ent.name)) sources.push(p);
    }
  };
  for (const d of ['scripts', 'skills-src']) walk(join(ROOT, d));

  it('no file re-implements the EAGAIN write-drain loop', () => {
    // The signature of the copied loop: a `writeSync(fd, buf, off, …)` inside an EAGAIN retry.
    const copies = sources.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /writeSync\(\s*fd\s*,/.test(src) && /EAGAIN/.test(src);
    }).map((f) => f.replace(`${ROOT}/`, ''));
    expect(copies).toEqual(['scripts/lib/write-all-sync.mjs']);
  });
});

describe('write-all-sync: byte transparency (#3061)', () => {
  let dir;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'write-all-sync-')); });
  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  const roundTrip = (name, fn) => {
    const p = join(dir, name);
    writeFileSync(p, '');
    const fd = openSync(p, 'a');
    try { fn(fd); } finally { closeSync(fd); }
    return readFileSync(p, 'utf8');
  };

  it('writeAllSync appends NOTHING — a diff/pre-terminated payload must not gain a stray newline', () => {
    expect(roundTrip('exact.txt', (fd) => writeAllSync(fd, 'abc'))).toBe('abc');
    expect(roundTrip('exact-nl.txt', (fd) => writeAllSync(fd, 'abc\n'))).toBe('abc\n');
  });

  it('writeLineSync appends exactly one newline — the behaviour the three de-duplicated copies had', () => {
    expect(roundTrip('line.txt', (fd) => writeLineSync(fd, 'abc'))).toBe('abc\n');
  });

  it('writes a payload larger than the pipe buffer in full (the loop, not one writeSync)', () => {
    const big = 'x'.repeat(PIPE_FLOOR * 40);
    const p = join(dir, 'big.txt');
    writeFileSync(p, '');
    const fd = openSync(p, 'a');
    try { writeAllSync(fd, big); } finally { closeSync(fd); }
    expect(statSync(p).size).toBe(big.length);
  });

  it('accepts a Buffer as well as a string', () => {
    expect(roundTrip('buf.txt', (fd) => writeAllSync(fd, Buffer.from('abc', 'utf8')))).toBe('abc');
  });
});
