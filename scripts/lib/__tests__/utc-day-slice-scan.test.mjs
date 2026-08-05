/**
 * @file utc-day-slice-scan.test.mjs — proof of the #2747 gate: the raw UTC day-slice idiom is DETECTED in
 * `scripts/**` source, the two exemptions (a `__tests__/` oracle, an explicit `utc-day-slice-ok:` reason)
 * are honoured, a full instant timestamp is left alone, and the real repo is currently clean.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findUtcDaySlices, utcDaySliceMessage } from '../utc-day-slice-scan.mjs';

let dir;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'we-utc-day-slice-')); mkdirSync(join(dir, 'scripts', 'sub'), { recursive: true }); });
afterAll(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });

const put = (rel, content) => {
  const abs = join(dir, 'scripts', rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
};
const scan = () => findUtcDaySlices(join(dir, 'scripts'), dir);

describe('findUtcDaySlices', () => {
  it('flags the raw idiom in .mjs and .cjs, at any depth, with a hoisted receiver or split across lines', () => {
    put('a.mjs', 'const today = new Date().toISOString().slice(0, 10);\n');
    put('sub/b.cjs', 'module.exports = () => new Date().toISOString().slice(0,10);\n');
    put('sub/c.mjs', 'const d = someDate.toISOString()\n  .slice(0, 10);\n'); // hoisted receiver, wrapped call
    expect(scan().map((h) => h.file).sort()).toEqual(['scripts/a.mjs', 'scripts/sub/b.cjs', 'scripts/sub/c.mjs']);
  });

  it('does NOT flag a full instant timestamp — those legitimately want UTC', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('ok.mjs', 'const nowIso = new Date().toISOString();\nconst n = arr.slice(0, 10);\n');
    expect(scan()).toEqual([]);
  });

  it('exempts __tests__ (an independent oracle must not use the helper it judges)', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('__tests__/x.test.mjs', 'const oracle = new Date().toISOString().slice(0, 10);\n');
    expect(scan()).toEqual([]);
  });

  it('exempts a line carrying an explicit `utc-day-slice-ok:` reason, on the line or just above', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('same-line.mjs', 'const due = d.toISOString().slice(0, 10); // utc-day-slice-ok: UTC-anchored arithmetic\n');
    put('above.mjs', '// utc-day-slice-ok: UTC-anchored arithmetic, not a wall-clock read\nconst due = d.toISOString().slice(0, 10);\n');
    expect(scan()).toEqual([]);
  });

  it('does NOT exempt a bare marker with no reason', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('bare.mjs', '// utc-day-slice-ok:\nconst due = d.toISOString().slice(0, 10);\n');
    expect(scan()).toHaveLength(1);
  });

  it('the message names the file, the line and the replacement', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('m.mjs', '\nconst today = new Date().toISOString().slice(0, 10);\n');
    const [hit] = scan();
    expect(hit.line).toBe(2);
    const msg = utcDaySliceMessage(hit);
    expect(msg).toContain('scripts/m.mjs:2');
    expect(msg).toContain('localToday()');
    expect(msg).toContain('#2747');
  });
});

describe('the real repo', () => {
  it('has no un-exempted UTC day-slice left in scripts/ (the gate is green at HEAD)', () => {
    // vitest runs from the repo root; `import.meta.url` is an http dev URL under this suite's environment.
    const root = process.cwd();
    expect(findUtcDaySlices(resolve(root, 'scripts'), root)).toEqual([]);
  });
});
