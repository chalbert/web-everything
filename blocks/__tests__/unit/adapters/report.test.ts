/**
 * Web Reporting v1 EXPORT adapters (backlog #434). Proves Report → SARIF 2.1.0 (run-per-source, level
 * mapping, location) and Report → JUnit XML (suite-per-section, failure/pass split, tallied counts) over
 * the #431 report model.
 */
import { describe, it, expect } from 'vitest';
import {
  toSarif,
  toJUnit,
  severityToSarifLevel,
  type SarifLog,
} from '../../../adapters/report/exportReport';
import type { Report } from '../../../renderers/report/renderReport';

const report: Report = {
  id: 'r1',
  title: 'Conformance run',
  sources: [
    { id: 'check:standards', name: 'check:standards' },
    { id: 'ext', name: 'External tool' },
  ],
  sections: [
    {
      id: 'sec1',
      title: 'Standards',
      findings: [
        { id: 'f1', severity: 'error', title: 'Missing aria-sort', detail: 'add it', location: { path: 'a.ts', line: 12, col: 4 }, ruleId: 'aria-sort', source: 'check:standards' },
        { id: 'f2', severity: 'warn', title: 'Digest too long', source: 'check:standards' },
        { id: 'f3', severity: 'pass', title: 'All good', source: 'check:standards' },
      ],
    },
    {
      id: 'sec2',
      title: 'External',
      findings: [
        { id: 'f4', severity: 'info', title: 'FYI', source: 'ext' },
        { id: 'f5', severity: 'custom-sev', title: 'Producer-extended', source: 'ext' },
      ],
    },
  ],
};

describe('severityToSarifLevel', () => {
  it('maps the base vocabulary, none for an unknown (extended) severity', () => {
    expect(severityToSarifLevel('error')).toBe('error');
    expect(severityToSarifLevel('warn')).toBe('warning');
    expect(severityToSarifLevel('info')).toBe('note');
    expect(severityToSarifLevel('pass')).toBe('none');
    expect(severityToSarifLevel('whatever')).toBe('none');
  });
});

describe('toSarif', () => {
  const log: SarifLog = toSarif(report);

  it('is a valid 2.1.0 log with one run per source', () => {
    expect(log.version).toBe('2.1.0');
    expect(log.$schema).toContain('sarif-2.1.0');
    expect(log.runs).toHaveLength(2);
    expect(log.runs[0].tool.driver.name).toBe('check:standards');
  });

  it('routes findings to the run matching their source', () => {
    expect(log.runs[0].results).toHaveLength(3);
    expect(log.runs[1].results).toHaveLength(2);
  });

  it('maps severity → level and finding location → physicalLocation', () => {
    const first = log.runs[0].results[0];
    expect(first.level).toBe('error');
    expect(first.ruleId).toBe('aria-sort');
    expect(first.message.text).toBe('Missing aria-sort — add it');
    expect(first.locations?.[0].physicalLocation.artifactLocation.uri).toBe('a.ts');
    expect(first.locations?.[0].physicalLocation.region).toEqual({ startLine: 12, startColumn: 4 });
  });

  it('omits locations for a finding without one, and collects ruleIds into the driver', () => {
    expect(log.runs[0].results[1].locations).toBeUndefined();
    expect(log.runs[0].tool.driver.rules).toEqual([{ id: 'aria-sort' }]);
  });
});

describe('toJUnit', () => {
  const xml = toJUnit(report);

  it('emits a well-formed root with tallied totals', () => {
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites name="Conformance run" tests="5" failures="2">');
  });

  it('emits one suite per section with its own counts', () => {
    expect(xml).toContain('<testsuite name="Standards" tests="3" failures="2">');
    expect(xml).toContain('<testsuite name="External" tests="2" failures="0">');
  });

  it('error/warn become <failure>; info/pass/extended are passing cases', () => {
    expect(xml).toContain('<failure message="a.ts:12 Missing aria-sort (aria-sort)" type="error">add it</failure>');
    expect(xml).toContain('type="warn"');
    expect(xml).toContain('<testcase name="All good" classname="Standards"></testcase>');
    expect(xml).toContain('<testcase name="FYI" classname="External"></testcase>');
    expect(xml).not.toContain('<failure message="FYI"');
  });

  it('escapes XML metacharacters in titles/details', () => {
    const r: Report = { id: 'x', title: 'A & B', sources: [{ id: 's', name: 's' }],
      sections: [{ id: 'se', title: '<unsafe>', findings: [{ id: 'f', severity: 'error', title: 'a < b & "c"', source: 's' }] }] };
    const out = toJUnit(r);
    expect(out).toContain('name="A &amp; B"');
    expect(out).toContain('name="&lt;unsafe&gt;"');
    expect(out).toContain('a &lt; b &amp; &quot;c&quot;');
  });
});
