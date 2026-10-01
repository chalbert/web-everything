import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRelatedReport, relatedReportRefs } from '../lib/related-report.cjs';
import { validateBacklogItem, validateReportsNotHidden } from '../check-standards-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('relatedReport repo locus compatibility', () => {
  it.each(['', 'we:'])('loads and validates a report with prefix %j', (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), 'we-related-report-'));
    try {
      const report = join(dir, '2026-09-30-example.md');
      writeFileSync(report, '# Example report\n\n**Point:** Example summary.\n\nReport details.\n');
      const relatedReport = prefix + relative(root, report);
      writeFileSync(join(dir, '001-pointer.md'),
        `---\nkind: story\nsize: 1\nstatus: open\ndateOpened: "2026-09-30"\nrelatedReport: ${relatedReport}\n---\n`);
      const [item] = JSON.parse(execFileSync(process.execPath, ['-e',
        `console.log(JSON.stringify(require(${JSON.stringify(join(root, 'src/_data/backlog.js'))}).loadBacklogScoped(['001-pointer.md'])))`,
      ], { encoding: 'utf8', env: { ...process.env, WE_BACKLOG_DIR: dir } }));
      expect(item.title).toBe('Example report');
      expect(item.summary).toBe('Example summary.');
      expect(item.details).toContain('Report details.');
      expect(item.reportDate).toBe('2026-09-30');
      expect(item.relatedReport).toBe(relatedReport);
      const ctx = { reportExists: (path) => existsSync(join(root, path)) };
      expect(validateBacklogItem(item, ctx).errors).toEqual([]);
      const missing = prefix + 'reports/missing-example.md';
      expect(validateBacklogItem({ ...item, relatedReport: missing }, ctx).errors)
        .toEqual([expect.objectContaining({ message: expect.stringContaining(`relatedReport does not exist: ${missing}`) })]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['', 'we:'])('counts prefix %j toward report visibility', (prefix) => {
    const backlogReportRefs = relatedReportRefs([{ relatedReport: `${prefix}reports/2026-09-30-example.md` }, {}]);
    expect(validateReportsNotHidden(['2026-09-30-example.md'], {
      researchIds: new Set(), backlogReportRefs,
    }).errors).toEqual([]);
    expect(validateReportsNotHidden(['2026-09-30-other.md'], {
      researchIds: new Set(), backlogReportRefs,
    }).errors).toHaveLength(1);
  });

  it('normalizes only the local locus and deduplicates equivalent references', () => {
    expect(normalizeRelatedReport('fui:reports/example.md')).toBe('fui:reports/example.md');
    expect(relatedReportRefs([
      { relatedReport: 'reports/example.md' }, { relatedReport: 'we:reports/example.md' },
    ])).toEqual(new Set(['example.md']));
  });
});
