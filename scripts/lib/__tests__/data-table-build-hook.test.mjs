/**
 * data-table-build-hook — the WE Eleventy build orchestration for the SSR data-table harness
 * (#1905, slice C of #1867). Proves the four-step arc on a build fixture: DETECT a deterministic
 * `<we-data-table rows="[[ ref ]]">` binding, RESOLVE the bare ref from build-known data, SHELL the
 * keyed-batch to a (here injected) FUI CLI, and SPLICE the SSR `<table>` back — with per-entry isolation,
 * the non-deterministic-binding skip, and the producer-pin / missing-artifact hard errors. The injected
 * runner stands in for the pinned `../frontierui/dist/tools/data-table-build/cli.mjs` so the test needs no
 * sibling FUI checkout.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveBareRef,
  findDataTableBindings,
  runBuildBatch,
  spliceDataTables,
  EXPECTED_PRODUCER,
  PINNED_CLI_RELATIVE,
} from '../data-table-build-hook.cjs';

// A throwaway "repo root" whose sibling ../frontierui/dist/tools/data-table-build/cli.mjs exists, so the
// hard missing-artifact gate passes and the injected runner (not the real artifact) does the rendering.
let stubRoot;
beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'we-dt-hook-'));
  stubRoot = path.join(base, 'webeverything');
  fs.mkdirSync(stubRoot, { recursive: true });
  const cli = path.resolve(stubRoot, PINNED_CLI_RELATIVE);
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(cli, '// stub pinned artifact for tests\n');
});
afterAll(() => { try { fs.rmSync(stubRoot, { recursive: true, force: true }); } catch { /* noop */ } });

const ROWS = [{ name: 'A', year: 2026 }, { name: 'B', year: 2025 }];
const DATA = { tables: { releases: { rows: ROWS, config: { columns: [{ field: 'year', type: 'number', sortable: true }] } } }, bareRows: ROWS };

// A fake CLI runner: echoes a keyed-batch envelope, rendering each entry to a trivial deterministic table
// that embeds its row count and the data-* sort key — enough to assert the splice is real and per-key.
function fakeRunner(_cmd, _args, opts) {
  const entries = JSON.parse(opts.input);
  return JSON.stringify({
    producer: EXPECTED_PRODUCER,
    results: entries.map((e) => ({ key: e.key, html: `<table data-rows="${e.rows.length}"><caption>${e.key}</caption></table>` })),
  });
}

describe('resolveBareRef — dotted-path lookup over build context', () => {
  it('resolves a dotted ref', () => {
    expect(resolveBareRef('tables.releases', DATA)).toEqual({ ok: true, value: DATA.tables.releases });
  });
  it('returns ok:false for a missing segment (left for the runtime path)', () => {
    expect(resolveBareRef('tables.missing', DATA)).toEqual({ ok: false });
    expect(resolveBareRef('nope.deep.path', DATA)).toEqual({ ok: false });
  });
});

describe('findDataTableBindings — detect only the deterministic bare-ref subset', () => {
  it('detects a paired-form binding and resolves its rows + config envelope', () => {
    const html = `<we-data-table rows="[[ tables.releases ]]"></we-data-table>`;
    const b = findDataTableBindings(html, DATA);
    expect(b).toHaveLength(1);
    expect(b[0].rows).toEqual(ROWS);
    expect(b[0].config.columns[0].field).toBe('year');
  });
  it('accepts a bare rows array on the ref', () => {
    const html = `<we-data-table rows="[[ bareRows ]]" />`;
    const b = findDataTableBindings(html, DATA);
    expect(b).toHaveLength(1);
    expect(b[0].rows).toEqual(ROWS);
  });
  it('SKIPS a non-bare (non-deterministic) binding — runtime owns it', () => {
    const html = `<we-data-table rows="[[ rows | filter(active) ]]"></we-data-table>`;
    expect(findDataTableBindings(html, DATA)).toHaveLength(0);
  });
  it('SKIPS an unresolved ref — left intact for the client', () => {
    const html = `<we-data-table rows="[[ tables.unknown ]]"></we-data-table>`;
    expect(findDataTableBindings(html, DATA)).toHaveLength(0);
  });
});

describe('runBuildBatch — producer pin + missing-artifact hard error', () => {
  it('throws a hard build error when the pinned artifact is absent', () => {
    // A repoRoot whose ../frontierui/dist/tools/... cannot exist.
    expect(() => runBuildBatch([], '/nonexistent-repo-root-xyz', fakeRunner)).toThrow(/pinned FUI artifact missing/);
  });
});

describe('runBuildBatch — producer-pin mismatch is a hard error', () => {
  it('throws when the envelope producer does not match the expected pin', () => {
    const wrong = () => JSON.stringify({ producer: 'someone-else/9', results: [] });
    expect(() => runBuildBatch([{ key: 'k', rows: [], config: {} }], stubRoot, wrong)).toThrow(/producer pin mismatch/);
  });
});

describe('spliceDataTables — full build arc on a fixture', () => {
  it('detects, resolves, shells, and splices the SSR <table> into the element body', () => {
    const html = `<main><we-data-table rows="[[ tables.releases ]]"></we-data-table></main>`;
    const out = spliceDataTables(html, DATA, stubRoot, fakeRunner);
    expect(out).toContain('<table data-rows="2">');
    expect(out).toContain('</we-data-table>');
    // The original empty body is replaced by exactly one SSR table (no JSON island, no duplicate render).
    expect(out.match(/<table/g)).toHaveLength(1);
  });

  it('is a no-op fast path for pages with no we-data-table', () => {
    expect(spliceDataTables('<p>no tables here</p>', DATA, stubRoot, fakeRunner)).toBe('<p>no tables here</p>');
  });

  it('isolates a per-entry error — the bad binding is left intact, others still splice', () => {
    const html = `<we-data-table rows="[[ tables.releases ]]"></we-data-table><we-data-table rows="[[ bareRows ]]"></we-data-table>`;
    const oneFails = (_c, _a, opts) => {
      const entries = JSON.parse(opts.input);
      return JSON.stringify({
        producer: EXPECTED_PRODUCER,
        results: entries.map((e, i) => (i === 0 ? { key: e.key, error: 'boom' } : { key: e.key, html: '<table id="ok"></table>' })),
      });
    };
    const out = spliceDataTables(html, DATA, stubRoot, oneFails);
    // The failed (first) binding keeps its original empty body; the second gets its SSR table.
    expect(out).toContain('<table id="ok">');
    expect(out.match(/<table/g)).toHaveLength(1);
  });
});
