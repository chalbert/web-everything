/**
 * Explorer interchange contract tests (#1769) — pins the SARIF 2.1.0-compatible core, the WE extension slot
 * (oracle id + conformance-vector linkage in SARIF `properties`), the structural validator, round-trip
 * serialize/deserialize, and the reference projector from the explorer's native finding shape.
 */
import { describe, it, expect } from 'vitest';
import {
  SARIF_VERSION,
  SARIF_SCHEMA_URI,
  EXPLORER_EXTENSION_VERSION,
  severityToSarifLevel,
  assertExplorerInterchange,
  ExplorerInterchangeSchemaError,
  serializeExplorerInterchange,
  deserializeExplorerInterchange,
  findingsToInterchange,
  explorerInterchangeJsonSchema,
  type ExplorerReportInput,
} from '../schema';

const REPORT: ExplorerReportInput = {
  url: 'http://localhost:3000/app',
  coverage: { states: 12, edges: 18, coverage: 0.84 },
  generatedAt: '2026-06-26T00:00:00.000Z',
  findings: [
    { oracle: 'no-console-errors', severity: 'error', stateId: 's3', detail: 'Uncaught TypeError at submit' },
    {
      oracle: 'aria-conformance',
      severity: 'warn',
      stateId: 's7',
      detail: 'combobox missing aria-expanded',
      conformance: { contract: '@webeverything/presentation-a11y', vectorIds: ['combobox/aria/expanded'] },
      evidence: [{ kind: 'screenshot', uri: 'shots/s7.png' }],
      location: { uri: 'http://localhost:3000/app#combobox', startLine: 1 },
    },
    { oracle: 'advisory-llm-judge', severity: 'advisory', stateId: 's7', detail: 'Layout looks cramped', confidence: 0.4 },
  ],
};

describe('severityToSarifLevel', () => {
  it('maps explorer severities onto SARIF levels (advisory → note)', () => {
    expect(severityToSarifLevel('error')).toBe('error');
    expect(severityToSarifLevel('warn')).toBe('warning');
    expect(severityToSarifLevel('advisory')).toBe('note');
    expect(severityToSarifLevel('bogus')).toBe('note'); // unknown → note
  });
});

describe('findingsToInterchange — the reference projection (#1769)', () => {
  const doc = findingsToInterchange(REPORT);

  it('produces a SARIF 2.1.0 log any SARIF tool can read', () => {
    expect(doc.version).toBe(SARIF_VERSION);
    expect(doc.$schema).toBe(SARIF_SCHEMA_URI);
    expect(doc.runs).toHaveLength(1);
    expect(doc.runs[0].tool.driver.name).toBe('web-everything-explorer');
  });

  it('carries the run/coverage summary in the run properties (WE extension slot)', () => {
    const props = doc.runs[0].properties;
    expect(props.url).toBe(REPORT.url);
    expect(props.coverage.coverage).toBe(0.84);
    expect(props.extensionVersion).toBe(EXPLORER_EXTENSION_VERSION);
  });

  it('mirrors the oracle as BOTH ruleId and properties.oracle, and maps severity', () => {
    const r0 = doc.runs[0].results[0];
    expect(r0.ruleId).toBe('no-console-errors');
    expect(r0.properties.oracle).toBe('no-console-errors');
    expect(r0.level).toBe('error');
  });

  it('carries conformance-vector linkage + evidence + location in the result properties', () => {
    const r1 = doc.runs[0].results[1];
    expect(r1.level).toBe('warning');
    expect(r1.properties.conformance).toEqual({ contract: '@webeverything/presentation-a11y', vectorIds: ['combobox/aria/expanded'] });
    expect(r1.properties.evidence?.[0]).toEqual({ kind: 'screenshot', uri: 'shots/s7.png' });
    expect(r1.locations?.[0].physicalLocation.artifactLocation.uri).toContain('#combobox');
  });

  it('carries advisory confidence and the note level', () => {
    const r2 = doc.runs[0].results[2];
    expect(r2.level).toBe('note');
    expect(r2.properties.confidence).toBe(0.4);
  });

  it('collects the distinct oracle ids into the tool driver rules', () => {
    const ids = doc.runs[0].tool.driver.rules.map((r) => r.id);
    expect(ids).toEqual(['no-console-errors', 'aria-conformance', 'advisory-llm-judge']);
  });
});

describe('assertExplorerInterchange — structural validator', () => {
  it('accepts a projected document and round-trips through serialize/deserialize', () => {
    const doc = findingsToInterchange(REPORT);
    const json = serializeExplorerInterchange(doc);
    expect(deserializeExplorerInterchange(json)).toEqual(doc);
  });

  it('rejects a wrong version', () => {
    expect(() => assertExplorerInterchange({ $schema: 'x', version: '2.0.0', runs: [] })).toThrow(ExplorerInterchangeSchemaError);
  });

  it('rejects a result missing the WE oracle extension', () => {
    const bad = {
      $schema: 'x',
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'x', rules: [] } }, results: [{ ruleId: 'r', level: 'error', message: { text: 't' }, properties: {} }], properties: { url: 'u', coverage: { states: 0, edges: 0, coverage: 0 }, extensionVersion: '1.0.0' } }],
    };
    expect(() => assertExplorerInterchange(bad)).toThrow(/oracle/);
  });

  it('rejects a run missing the WE run summary', () => {
    const bad = { $schema: 'x', version: '2.1.0', runs: [{ tool: { driver: { name: 'x', rules: [] } }, results: [], properties: {} }] };
    expect(() => assertExplorerInterchange(bad)).toThrow(/url, coverage/);
  });
});

describe('explorerInterchangeJsonSchema', () => {
  it('describes the interchange for non-TS consumers', () => {
    expect(explorerInterchangeJsonSchema.properties.version.const).toBe('2.1.0');
    expect(explorerInterchangeJsonSchema.required).toContain('runs');
  });
});
