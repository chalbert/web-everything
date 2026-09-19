/**
 * @file delivery-report-store.test.mjs — the fs shell over the delivery-report record (#3627 design prototype).
 * Mirrors `we:scripts/operations/__tests__/completion-store.test.mjs`'s own coverage shape.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import {
  createFileDeliveryReportStore,
  deliveryReportPath,
  deleteDeliveryReport,
  listDeliveryReportSessions,
  newDeliveryReport,
  readDeliveryReport,
  resolveDeliveryReportsDir,
  tryReadDeliveryReport,
  writeDeliveryReport,
} from '../delivery-report-store.mjs';

let dir;
let previousDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'we-op-delivery-report-store-'));
  previousDir = process.env.OPERATION_DELIVERY_REPORTS_DIR;
  process.env.OPERATION_DELIVERY_REPORTS_DIR = dir;
});
afterEach(() => {
  if (previousDir === undefined) delete process.env.OPERATION_DELIVERY_REPORTS_DIR;
  else process.env.OPERATION_DELIVERY_REPORTS_DIR = previousDir;
  rmSync(dir, { recursive: true, force: true });
});

// #3627 bug 9 (live #3371 attempt 4, confirmed 2026-09-09) — `resolveDeliveryReportsDir` is the ONE seam
// `deliver-item-wrapper.mjs#CLAUDE_RESTRICTED_PROVIDER.spawn` relies on to make the wrapper's own process and
// the delivery agent it spawns (a SEPARATE `git clone`, whose own copy of this file has a DIFFERENT
// script-location-relative default) agree on the same sidecar directory. This directly asserts the env
// override wins, and wins with an absolute, resolved path — the exact contract the wrapper's fix depends on.
describe('resolveDeliveryReportsDir (#3627 bug 9 — the env override the wrapper depends on)', () => {
  it('returns the env override, resolved to an absolute path, when OPERATION_DELIVERY_REPORTS_DIR is set', () => {
    expect(resolveDeliveryReportsDir()).toBe(dir); // `dir` (from beforeEach) is already absolute (mkdtempSync).
  });

  it('falls back to the script-location-relative default when the env override is unset', () => {
    delete process.env.OPERATION_DELIVERY_REPORTS_DIR;
    expect(resolveDeliveryReportsDir()).toMatch(/[/\\]\.operations[/\\]delivery-reports$/);
  });

  it('ignores a blank/whitespace-only override and falls back to the default, same as unset', () => {
    process.env.OPERATION_DELIVERY_REPORTS_DIR = '   ';
    expect(resolveDeliveryReportsDir()).toMatch(/[/\\]\.operations[/\\]delivery-reports$/);
  });
});

describe('tryReadDeliveryReport', () => {
  it('returns null when nothing was ever written', () => {
    expect(tryReadDeliveryReport('deliver-none')).toBeNull();
  });

  it('round-trips a written record', () => {
    const record = newDeliveryReport({ session: 'deliver-1', item: '1' });
    writeDeliveryReport(record);
    expect(tryReadDeliveryReport('deliver-1')).toEqual(record);
  });

  it('throws on a corrupt on-disk record rather than treating it as absent', () => {
    const record = newDeliveryReport({ session: 'deliver-1', item: '1' });
    const path = writeDeliveryReport(record);
    // Corrupt the file directly, bypassing the writer's own validation.
    writeFileSync(path, '{"not":"valid"}');
    expect(() => tryReadDeliveryReport('deliver-1')).toThrow(/refusing to read delivery report/);
  });
});

describe('readDeliveryReport', () => {
  it('throws when no record exists (a missing record IS a refusal)', () => {
    expect(() => readDeliveryReport('deliver-none')).toThrow(/no delivery report for/);
  });
});

describe('writeDeliveryReport', () => {
  it('refuses to write an invalid record', () => {
    expect(() => writeDeliveryReport({ session: 'deliver-1' })).toThrow(/is invalid/);
  });

  it('is atomic — no partial-file readers, exercised via a rapid overwrite', () => {
    const first = newDeliveryReport({ session: 'deliver-1', item: '1' });
    writeDeliveryReport(first);
    const second = { ...first, status: 'done', outcome: 'done', filesTouched: ['a.mjs'], updatedAt: new Date().toISOString() };
    writeDeliveryReport(second);
    expect(tryReadDeliveryReport('deliver-1')).toEqual(second);
  });
});

describe('deliveryReportPath', () => {
  it('refuses a filename-unsafe session slug', () => {
    expect(() => deliveryReportPath('../escape')).toThrow(/invalid delivery-report session slug/);
  });
});

describe('listDeliveryReportSessions / deleteDeliveryReport', () => {
  it('lists sessions with a record and ignores stray files, sorted', () => {
    writeDeliveryReport(newDeliveryReport({ session: 'deliver-2', item: '2' }));
    writeDeliveryReport(newDeliveryReport({ session: 'deliver-1', item: '1' }));
    writeFileSync(join(dir, 'not-a-report.txt'), 'stray');
    expect(listDeliveryReportSessions()).toEqual(['deliver-1', 'deliver-2']);

    deleteDeliveryReport('deliver-1');
    expect(listDeliveryReportSessions()).toEqual(['deliver-2']);
  });

  it('is a no-op deleting an already-absent session', () => {
    expect(() => deleteDeliveryReport('deliver-never-existed')).not.toThrow();
  });
});

describe('createFileDeliveryReportStore', () => {
  it('exposes read/write/delete/list over the same records', () => {
    const store = createFileDeliveryReportStore(dir);
    const record = newDeliveryReport({ session: 'deliver-1', item: '1' });
    store.write(record);
    expect(store.read('deliver-1')).toEqual(record);
    expect(store.list()).toEqual(['deliver-1']);
    store.delete('deliver-1');
    expect(store.read('deliver-1')).toBeNull();
  });
});
