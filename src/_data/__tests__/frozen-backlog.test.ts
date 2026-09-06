// #3531 — pins the ISOLATION seam under `we:src/_data/__tests__/backlog-leverage.test.ts`, and pins the
// root cause itself so the diagnosis cannot quietly rot back into the card's original (wrong) hypothesis.
//
// What #3531 actually was, established by running it rather than reading it:
//
//   • The four leverage fields are a pure function of the `we:backlog/*.md` corpus. `we:src/_data/backlog.js`
//     holds no module-level cache, reads no clock on that path, and resolves `BACKLOG_DIR` ONCE at module
//     load — so once the module is required, no `process.env` change can move them. `hazard` and
//     `env-cannot` below assert both halves executably.
//   • Therefore the only reachable cause of "a second load produces different leverage fields" is that the
//     CORPUS CHANGED between the two reads. `we:backlog/` is a live working directory that scaffold,
//     resolve and the drain write to; at full-suite size the two reads sit far enough apart in wall-clock
//     for a concurrent write to land between them, and at small suite size they do not. That is exactly the
//     card's probe table — the file alone passes, small subsets pass, the full run fails.
//   • The card's leading hypothesis — cross-file `WE_VISUAL_FIXTURES` pollution from
//     `we:src/_data/__tests__/backlog-visual-fixture-mode.test.ts` — is FALSIFIED by `env-cannot`. No
//     sibling test is the polluter, because no env value can reach these fields after the require.
//
// The CI blind spot, stated: CI could never catch this, and sharding is not the reason. A CI checkout has
// no concurrent writer to `we:backlog/`, so the race has no second party there. Sharding is a real but
// SEPARATE blind spot for order dependence in general (four shards never co-locate every pair), and it is
// accepted: an unsharded gate costs the `test` lane its wall-clock budget, and the isolation fix here means
// this particular defect can no longer occur at any file count, in or out of CI.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freezeBacklogCorpus, withFrozenBacklogDir } from './frozen-backlog';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');

const card = (num: string, blockedBy: string[] = []) =>
  `---\nbornAs: x${num}aaa\nkind: story\nsize: 1\nstatus: open\n`
  + (blockedBy.length ? `blockedBy: [${blockedBy.map((b) => `"${b}"`).join(', ')}]\n` : '')
  + `dateOpened: "2026-01-01"\n---\n\n# card ${num}\n\nbody\n`;

/** A two-card corpus: 002 is blocked by 001, so 001 carries all the leverage. */
function synthCorpus(): string {
  const dir = mkdtempSync(join(tmpdir(), 'we-synth-backlog-'));
  writeFileSync(join(dir, '001-gate.md'), card('001'));
  writeFileSync(join(dir, '002-dependent.md'), card('002', ['001']));
  return dir;
}

/**
 * Load the leverage fields in a CHILD process, optionally writing a third card between the two loads and
 * optionally flipping env between them. A child is required, not a nicety: `BACKLOG_DIR` freezes at module
 * load, so only a fresh module registry can honour a `WE_BACKLOG_DIR` chosen per case.
 */
function twoLoads(dir: string, between: 'write-card' | 'flip-env' | 'nothing'): { first: string; second: string } {
  const script = `
    const fs = require('node:fs'), path = require('node:path');
    const load = require(${JSON.stringify(join(ROOT, 'src/_data/backlog.js'))});
    const pick = (a) => JSON.stringify(a.map((i) =>
      i.num + ':' + i.directUnblocks + ':' + i.transitiveUnblocks + ':' + i.unblocksToReady + ':' + i.leverageScore).sort());
    const first = pick(load());
    const between = ${JSON.stringify(between)};
    if (between === 'write-card') {
      fs.writeFileSync(path.join(process.env.WE_BACKLOG_DIR, '003-concurrent.md'),
        ${JSON.stringify(card('003', ['001']))});
    } else if (between === 'flip-env') {
      // Precisely what \`we:src/_data/__tests__/backlog-visual-fixture-mode.test.ts\` does between reads.
      process.env.WE_VISUAL_FIXTURES = '1';
      process.env.WE_BACKLOG_DIR = '/nonexistent-would-throw-if-read-late';
    }
    const second = pick(load());
    process.stdout.write(JSON.stringify({ first: first, second: second }));
  `;
  const out = execFileSync(process.execPath, ['-e', script],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, WE_BACKLOG_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

describe('#3531 — what actually makes the leverage derivation look non-deterministic', () => {
  it('hazard: a card written between two loads DOES move the fields — the corpus is the input', () => {
    const dir = synthCorpus();
    try {
      const { first, second } = twoLoads(dir, 'write-card');
      expect(first).not.toEqual(second);
      // Named, not just "different": 001 gains a second open dependent that it is the last blocker for.
      expect(first).toContain('001:1:1:1:1001');
      expect(second).toContain('001:2:2:2:2002');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('env-cannot: flipping WE_VISUAL_FIXTURES / WE_BACKLOG_DIR between loads canNOT move the fields', () => {
    const dir = synthCorpus();
    try {
      // This is the card's leading hypothesis, executed. It passes identical — `BACKLOG_DIR` was already
      // frozen by the require, and nothing on the leverage path reads env at call time. So cross-file env
      // pollution is not a candidate explanation, and no sibling test needs to be named as the polluter.
      const { first, second } = twoLoads(dir, 'flip-env');
      expect(second).toEqual(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('control: with nothing changed between them, two loads agree — the derivation itself is sound', () => {
    const dir = synthCorpus();
    try {
      const { first, second } = twoLoads(dir, 'nothing');
      expect(second).toEqual(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('freezeBacklogCorpus', () => {
  it('is immune to later writes to the source directory — the property the fix rests on', () => {
    const src = mkdtempSync(join(tmpdir(), 'we-src-backlog-'));
    writeFileSync(join(src, '001-gate.md'), card('001'));
    const frozen = freezeBacklogCorpus(src);
    try {
      expect(readdirSync(frozen.dir).sort()).toEqual(['001-gate.md']);
      writeFileSync(join(src, '002-late.md'), card('002'));
      rmSync(join(src, '001-gate.md'));
      expect(readdirSync(frozen.dir).sort()).toEqual(['001-gate.md']);
      expect(readFileSync(join(frozen.dir, '001-gate.md'), 'utf8')).toContain('# card 001');
    } finally {
      frozen.dispose();
      rmSync(src, { recursive: true, force: true });
    }
  });

  it('dispose() removes the copy, and is safe to call twice', () => {
    const src = mkdtempSync(join(tmpdir(), 'we-src-backlog-'));
    mkdirSync(join(src, 'sub'), { recursive: true });
    const frozen = freezeBacklogCorpus(src);
    frozen.dispose();
    expect(() => frozen.dispose()).not.toThrow();
    rmSync(src, { recursive: true, force: true });
  });
});

describe('withFrozenBacklogDir — leaves process.env exactly as it found it', () => {
  const KEY = 'WE_BACKLOG_DIR';
  const restore = (prior: string | undefined, had: boolean) => {
    if (had) process.env[KEY] = prior as string;
    else delete process.env[KEY];
  };

  it('exposes the dir to the callback and then UNSETS the var when it was unset before', () => {
    const had = Object.prototype.hasOwnProperty.call(process.env, KEY);
    const prior = process.env[KEY];
    delete process.env[KEY];
    try {
      const seen = withFrozenBacklogDir('/frozen', () => process.env[KEY]);
      expect(seen).toBe('/frozen');
      // Not '' — a naive save/restore turns "absent" into "empty string", which `we:src/_data/backlog.js`
      // reads as falsy today but which would leak a real difference the moment anything checks presence.
      expect(Object.prototype.hasOwnProperty.call(process.env, KEY)).toBe(false);
    } finally {
      restore(prior, had);
    }
  });

  it('restores a PRE-EXISTING value rather than clearing it', () => {
    const had = Object.prototype.hasOwnProperty.call(process.env, KEY);
    const prior = process.env[KEY];
    process.env[KEY] = '/was-here-first';
    try {
      withFrozenBacklogDir('/frozen', () => 0);
      expect(process.env[KEY]).toBe('/was-here-first');
    } finally {
      restore(prior, had);
    }
  });

  it('restores even when the callback throws — a failed require must not leave the worker dirty', () => {
    const had = Object.prototype.hasOwnProperty.call(process.env, KEY);
    const prior = process.env[KEY];
    delete process.env[KEY];
    try {
      expect(() => withFrozenBacklogDir('/frozen', () => { throw new Error('boom'); })).toThrow('boom');
      expect(Object.prototype.hasOwnProperty.call(process.env, KEY)).toBe(false);
    } finally {
      restore(prior, had);
    }
  });
});

describe('the WIRING — backlog-leverage.test.ts must read the frozen copy, not the live directory', () => {
  // Testing the helper is not testing that the leverage test USES it: a correct helper nothing calls
  // protects nothing. Mutating the call site in `we:src/_data/__tests__/backlog-leverage.test.ts` — back to
  // a bare `require('../backlog.js')` — reddens this.
  const SRC = readFileSync(join(HERE, 'backlog-leverage.test.ts'), 'utf8');

  it('obtains its loader through withFrozenBacklogDir over a frozen corpus', () => {
    expect(SRC).toMatch(/freezeBacklogCorpus\(/);
    expect(SRC).toMatch(/withFrozenBacklogDir\(\s*corpus\.dir\s*,\s*\(\)\s*=>\s*require\('\.\.\/backlog\.js'\)\s*\)/);
  });

  it('does not require the loader outside that wrapper', () => {
    const bare = SRC.split('\n').filter((l) => /require\('\.\.\/backlog\.js'\)/.test(l) && !/withFrozenBacklogDir/.test(l));
    expect(bare).toEqual([]);
  });

  it('still disposes the copy, so a full run does not strand 3500-file temp trees', () => {
    expect(SRC).toMatch(/afterAll\(\(\) => corpus\.dispose\(\)\)/);
  });

  it('keeps the determinism assertion itself — the fix is at the isolation seam, never the assertion', () => {
    expect(SRC).toMatch(/is deterministic — a second load produces identical leverage fields/);
    expect(SRC).toMatch(/expect\(pick\(again\)\)\.toEqual\(pick\(items\)\)/);
  });
});
