/**
 * ingestReport — v1 INGEST adapters for the Web Reporting report model (backlog #433, phase 3 of #350).
 * The inverse of the export adapters (#434): take a foreign producer's output and normalize it bottom-up
 * into a {@link Report} (the schema the #431 `report-model` protocol fixes), so any tool's results render
 * through the shared renderers instead of a bespoke viewer. The lossy-normalization-hub pattern — the
 * pivot the project never ships; each foreign format is ingested INTO it ([[feedback_adapter_normalization_hub]]).
 *
 *   - {@link fromSarif}    — SARIF 2.1.0 log → Report (one {@link ReportSource} + section per `run`; one
 *     {@link Finding} per `result`, level → severity, `physicalLocation` → location).
 *   - {@link fromJUnit}    — JUnit XML → Report (one section per `<testsuite>`; one finding per
 *     `<testcase>`, a `<failure>` → its `type` severity, a passing case → `pass`).
 *   - {@link fromCoverage} — Istanbul/nyc `coverage-summary.json` → Report (per-file × per-metric
 *     {@link Score}s under a coverage section, keyed `"file/metric"` so {@link coverageFromScores} pivots
 *     them straight into the coverage matrix).
 *
 * Pure functions, no I/O, like the export adapters and renderers. Round-trips with {@link ../report/exportReport}
 * on the base vocabulary (an export-then-ingest preserves sources, sections, severities, and locations).
 */
import type {
  Report,
  ReportSource,
  ReportSection,
  Finding,
  Score,
  Severity,
} from '../../renderers/report/renderReport';
import type { SarifLog, SarifLevel } from './exportReport';

// ── SARIF 2.1.0 → Report ──────────────────────────────────────────────────────────

/** Inverse of {@link severityToSarifLevel}: a SARIF level → the base report-model severity. */
export function sarifLevelToSeverity(level: SarifLevel | string): Severity {
  switch (level) {
    case 'error': return 'error';
    case 'warning': return 'warn';
    case 'note': return 'info';
    case 'none': return 'pass';
    default: return 'info';
  }
}

/**
 * SARIF 2.1.0 log → Report. Each `run` becomes one {@link ReportSource} (id/name from its
 * `tool.driver.name`) AND one {@link ReportSection} carrying that run's findings, so the producer set
 * round-trips with {@link toSarif}. A result's `level` maps to severity, its first `physicalLocation` to a
 * location, and findings get synthesized ids (`<sourceId>-<n>`) since SARIF has none.
 */
export function fromSarif(log: SarifLog, opts: { id?: string; title?: string } = {}): Report {
  const sources: ReportSource[] = [];
  const sections: ReportSection[] = [];
  log.runs.forEach((run, ri) => {
    const name = run.tool?.driver?.name || `run-${ri + 1}`;
    const sourceId = name;
    sources.push({ id: sourceId, name, kind: 'sarif' });
    const findings: Finding[] = (run.results ?? []).map((r, fi) => {
      const finding: Finding = {
        id: `${sourceId}-${fi + 1}`,
        severity: sarifLevelToSeverity(r.level),
        title: r.message?.text ?? '',
        source: sourceId,
      };
      if (r.ruleId) finding.ruleId = r.ruleId;
      const phys = r.locations?.[0]?.physicalLocation;
      if (phys?.artifactLocation?.uri) {
        finding.location = { path: phys.artifactLocation.uri };
        if (phys.region?.startLine !== undefined) finding.location.line = phys.region.startLine;
        if (phys.region?.startColumn !== undefined) finding.location.col = phys.region.startColumn;
      }
      return finding;
    });
    sections.push({ id: `sec-${sourceId}`, title: name, findings });
  });
  return { id: opts.id ?? 'sarif', title: opts.title ?? 'SARIF report', sources, sections };
}

// ── JUnit XML → Report ──────────────────────────────────────────────────────────────

const xmlUnesc = (s: string): string =>
  s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) =>
    ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e as 'amp']));

/** Read an XML attribute's value off a start-tag string, unescaped; undefined when absent. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? xmlUnesc(m[1]) : undefined;
}

/**
 * JUnit XML → Report. One {@link ReportSection} per `<testsuite>` (its `name` → title); one
 * {@link Finding} per `<testcase>`. A `<failure>` child marks the case failed — its `type` attribute
 * carries the original severity (what {@link toJUnit} wrote), defaulting to `error`; a passing case is
 * `pass`. A single source represents the whole JUnit run. A regex parse over the flat structure
 * {@link toJUnit} emits — no DOM, pure and dependency-free.
 */
export function fromJUnit(xml: string, opts: { id?: string; sourceName?: string } = {}): Report {
  const sourceId = opts.id ?? 'junit';
  const sourceName = opts.sourceName ?? 'JUnit';
  const rootName = (xml.match(/<testsuites\b[^>]*>/)?.[0] && attr(xml.match(/<testsuites\b[^>]*>/)![0], 'name'))
    || 'JUnit report';
  const sections: ReportSection[] = [];
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g;
  let suiteMatch: RegExpExecArray | null;
  let si = 0;
  while ((suiteMatch = suiteRe.exec(xml))) {
    const suiteTitle = attr(`<x ${suiteMatch[1]}>`, 'name') || `suite-${si + 1}`;
    const inner = suiteMatch[2];
    const findings: Finding[] = [];
    // Each <testcase ...> either self-/empty-closes (pass) or wraps a <failure ...>...</failure>.
    const caseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let caseMatch: RegExpExecArray | null;
    let ci = 0;
    while ((caseMatch = caseRe.exec(inner))) {
      const caseTag = `<x ${caseMatch[1]}>`;
      const body = caseMatch[2] ?? '';
      const title = attr(caseTag, 'name') || `case-${ci + 1}`;
      const failure = body.match(/<failure\b([^>]*?)(?:\/>|>([\s\S]*?)<\/failure>)/);
      const finding: Finding = {
        id: `${sourceId}-${si + 1}-${ci + 1}`,
        severity: failure ? ((attr(`<x ${failure[1]}>`, 'type') as Severity) || 'error') : 'pass',
        title,
        source: sourceId,
      };
      const detail = failure?.[2] ? xmlUnesc(failure[2]).trim() : '';
      if (detail) finding.detail = detail;
      findings.push(finding);
      ci++;
    }
    sections.push({ id: `sec-${si + 1}`, title: suiteTitle, findings });
    si++;
  }
  return {
    id: sourceId,
    title: rootName,
    sources: [{ id: sourceId, name: sourceName, kind: 'junit' }],
    sections,
  };
}

// ── Istanbul/nyc coverage-summary.json → Report ──────────────────────────────────────

/** One metric block of an Istanbul coverage summary. */
interface CoverageMetric {
  total: number;
  covered: number;
  skipped?: number;
  pct: number;
}
/** The Istanbul `coverage-summary.json` shape: a `total` plus one entry per file path. */
export type CoverageSummary = Record<string, Partial<Record<'lines' | 'statements' | 'functions' | 'branches', CoverageMetric>>>;

const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

/** The row label for a coverage file key — basename only, since the matrix splits score ids on `/`. */
function coverageRow(fileKey: string): string {
  if (fileKey === 'total') return 'total';
  const base = fileKey.split(/[\\/]/).filter(Boolean).pop();
  return base || fileKey;
}

/**
 * Istanbul/nyc `coverage-summary.json` → Report. Each file (plus `total`) × each metric becomes a
 * {@link Score} keyed `"<file>/<metric>"` (`value` = pct, `max` = 100, `unit` = '%') under a single
 * coverage section — the `row/col` id convention {@link coverageFromScores} pivots straight into the
 * coverage matrix. File rows use the basename (the matrix splits ids on `/`, so a full path can't be a
 * row). The `total` row is the project roll-up. A degenerate (empty) summary yields an empty section.
 */
export function fromCoverage(summary: CoverageSummary, opts: { id?: string; title?: string } = {}): Report {
  const scores: Score[] = [];
  for (const [fileKey, metrics] of Object.entries(summary)) {
    const row = coverageRow(fileKey);
    for (const metric of COVERAGE_METRICS) {
      const m = metrics?.[metric];
      if (!m || typeof m.pct !== 'number') continue;
      scores.push({ id: `${row}/${metric}`, label: `${row} ${metric}`, value: m.pct, max: 100, unit: '%' });
    }
  }
  return {
    id: opts.id ?? 'coverage',
    title: opts.title ?? 'Coverage report',
    sources: [{ id: 'coverage', name: 'Coverage', kind: 'coverage' }],
    sections: [{ id: 'coverage', title: 'Coverage', scores }],
  };
}
