/**
 * @file fix-report-store.test.mjs — the fs shell over the fix-report record (#xu2pp2m, downstream of #3627's
 * `delivery-report-store.mjs`). Mirrors that file's own test coverage shape.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import {
  createFileFixReportStore,
  fixReportPath,
  deleteFixReport,
  listFixReportSessions,
  newFixReport,
  readFixReport,
  resolveFixReportsDir,
  tryReadFixReport,
  writeFixReport,
} from '../fix-report-store.mjs';

let dir;
let previousDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-fix-report-store-'));
  previousDir = process.env.OPERATION_FIX_REPORTS_DIR;
  process.env.OPERATION_FIX_REPORTS_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.OPERATION_FIX_REPORTS_DIR;
  else process.env.OPERATION_FIX_REPORTS_DIR = previousDir;
  rmSync(dir, { recursive: true, force: true });
});

// Mirrors delivery-report-store.mjs's own bug-9 test — the SAME seam this wrapper's own provider relies on to
// make the wrapper's own process and the fix agent it spawns (a SEPARATE `git clone`, a different
// script-location-relative default) agree on the same sidecar directory.
describe('resolveFixReportsDir (the env override the wrapper depends on)', () => {
  it('returns the env override, resolved to an absolute path, when OPERATION_FIX_REPORTS_DIR is set', () => {
    expect(resolveFixReportsDir()).toBe(dir); // `dir` (from beforeEach) is already absolute (mkdtempSync).
  });

  it('falls back to the script-location-relative default when the env override is unset', () => {
    delete process.env.OPERATION_FIX_REPORTS_DIR;
    expect(resolveFixReportsDir()).toMatch(/[/\\]\.operations[/\\]fix-reports$/);
  });

  it('ignores a blank/whitespace-only override and falls back to the default, same as unset', () => {
    process.env.OPERATION_FIX_REPORTS_DIR = '   ';
    expect(resolveFixReportsDir()).toMatch(/[/\\]\.operations[/\\]fix-reports$/);
  });
});

describe('tryReadFixReport', () => {
  it('returns null when nothing was ever written', () => {
    expect(tryReadFixReport('fix-none')).toBeNull();
  });

  it('round-trips a written record', () => {
    const record = newFixReport({ session: 'fix-1', pr: '1' });
    writeFixReport(record);
    expect(tryReadFixReport('fix-1')).toEqual(record);
  });

  it('throws on a corrupt on-disk record rather than treating it as absent', () => {
    const record = newFixReport({ session: 'fix-1', pr: '1' });
    const path = writeFixReport(record);
    writeFileSync(path, '{"not":"valid"}');
    expect(() => tryReadFixReport('fix-1')).toThrow(/refusing to read fix report/);
  });
});

describe('readFixReport', () => {
  it('throws when no record exists (a missing record IS a refusal)', () => {
    expect(() => readFixReport('fix-none')).toThrow(/no fix report for/);
  });
});

describe('writeFixReport', () => {
  it('refuses to write an invalid record', () => {
    expect(() => writeFixReport({ session: 'fix-1' })).toThrow(/is invalid/);
  });

  it('is atomic — no partial-file readers, exercised via a rapid overwrite', () => {
    const first = newFixReport({ session: 'fix-1', pr: '1' });
    writeFixReport(first);
    const second = { ...first, status: 'done', outcome: 'fixed', filesTouched: ['a.mjs'], updatedAt: new Date().toISOString() };
    writeFixReport(second);
    expect(tryReadFixReport('fix-1')).toEqual(second);
  });
});

describe('fixReportPath', () => {
  it('refuses a filename-unsafe session slug', () => {
    expect(() => fixReportPath('../escape')).toThrow(/invalid fix-report session slug/);
  });
});

describe('listFixReportSessions / deleteFixReport', () => {
  it('lists sessions with a record and ignores stray files, sorted', () => {
    writeFixReport(newFixReport({ session: 'fix-2', pr: '2' }));
    writeFixReport(newFixReport({ session: 'fix-1', pr: '1' }));
    writeFileSync(join(dir, 'not-a-report.txt'), 'stray');
    expect(listFixReportSessions()).toEqual(['fix-1', 'fix-2']);

    deleteFixReport('fix-1');
    expect(listFixReportSessions()).toEqual(['fix-2']);
  });

  it('is a no-op deleting an already-absent session', () => {
    expect(() => deleteFixReport('fix-never-existed')).not.toThrow();
  });
});

describe('createFileFixReportStore', () => {
  it('exposes read/write/delete/list over the same records', () => {
    const store = createFileFixReportStore(dir);
    const record = newFixReport({ session: 'fix-1', pr: '1' });
    store.write(record);
    expect(store.read('fix-1')).toEqual(record);
    expect(store.list()).toEqual(['fix-1']);
    store.delete('fix-1');
    expect(store.read('fix-1')).toBeNull();
  });
});
