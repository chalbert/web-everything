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

  it('exempts a marker whose reason WRAPS onto a second comment line directly above', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('wrapped.mjs', '// utc-day-slice-ok: UTC-anchored arithmetic on a stored date,\n'
      + '// not a wall-clock read — re-projecting it would shift the day.\n'
      + 'const due = d.toISOString().slice(0, 10);\n');
    expect(scan()).toEqual([]);
  });

  it('does NOT leak the exemption onto the lines BELOW the one it annotates (#2747 review)', () => {
    // The first cut matched the marker anywhere in a fixed 3-line window ending at the hit, so one
    // justified exemption granted blanket amnesty to whatever landed on the next two source lines.
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('leak.mjs', '// utc-day-slice-ok: UTC-anchored arithmetic\n'
      + 'const due = d.toISOString().slice(0, 10);\n'
      + 'const today = new Date().toISOString().slice(0, 10);\n'   // a REAL wall-clock stamp, one line below
      + 'const other = new Date().toISOString().slice(0, 10);\n'); // and two lines below
    expect(scan().map((h) => h.line)).toEqual([3, 4]);
  });

  it('does NOT exempt a hit separated from the marker by a non-comment line', () => {
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('gap.mjs', '// utc-day-slice-ok: UTC-anchored arithmetic\n'
      + 'const unrelated = 1;\n'
      + 'const today = new Date().toISOString().slice(0, 10);\n');
    expect(scan().map((h) => h.line)).toEqual([3]);
  });

  it('self-exempts the scanner by PATH, so a same-named file elsewhere is still scanned (#2747 review)', () => {
    // The bare-basename skip was applied at every recursion depth, so any `scripts/**/utc-day-slice-scan.mjs`
    // — a copy, a fork, a deliberately-named file — escaped the gate with no artefact and no reason.
    rmSync(join(dir, 'scripts'), { recursive: true, force: true });
    put('sub/utc-day-slice-scan.mjs', 'const today = new Date().toISOString().slice(0, 10);\n');
    expect(scan().map((h) => h.file)).toEqual(['scripts/sub/utc-day-slice-scan.mjs']);
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
