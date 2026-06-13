/**
 * exportReport — v1 EXPORT adapters for the Web Reporting report model (backlog #434, phase 4 of #350).
 * The inverse of the ingest adapters (#433): take a normalized {@link Report} (the schema the #431
 * `report-model` protocol fixes) and emit a common CI-consumer format, so a WE-generated report feeds
 * standard tooling instead of needing a bespoke viewer.
 *
 *   - {@link toSarif}  — Report → SARIF 2.1.0 log (one `run` per {@link ReportSource}; one `result` per
 *     {@link Finding}, severity mapped to a SARIF `level`, location to a `physicalLocation`).
 *   - {@link toJUnit} — Report → JUnit XML string (one `<testsuite>` per {@link ReportSection}; one
 *     `<testcase>` per finding, error/warn → `<failure>`, info/pass → a passing case).
 *
 * The report model IS the contract — these adapters only translate it OUT, the lossy bridge that earns
 * the protocol ([[feedback_adapter_normalization_hub]]). Pure functions, no I/O, like the renderers.
 */
import type { Report, Finding, ReportSection, Severity } from '../../renderers/report/renderReport';

// ── SARIF 2.1.0 (the subset we emit) ──────────────────────────────────────────────

/** SARIF result severity level. https://docs.oasis-open.org/sarif/sarif/v2.1.0/ */
export type SarifLevel = 'error' | 'warning' | 'note' | 'none';

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}
export interface SarifRun {
  tool: { driver: { name: string; rules: { id: string }[] } };
  results: SarifResult[];
}
export interface SarifResult {
  ruleId?: string;
  level: SarifLevel;
  message: { text: string };
  locations?: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number; startColumn?: number };
    };
  }[];
}

/** Map a report-model severity to a SARIF level; an unknown (producer-extended) severity → `none`. */
export function severityToSarifLevel(severity: Severity | string): SarifLevel {
  switch (severity) {
    case 'error': return 'error';
    case 'warn': return 'warning';
    case 'info': return 'note';
    case 'pass': return 'none';
    default: return 'none';
  }
}

/**
 * Report → SARIF 2.1.0. One run per source (its `tool.driver` named for the producer), each run carrying
 * the findings keyed to that source. A finding's `ruleId`s are collected into the driver's `rules[]`. A
 * finding with no `source` match, or sources with no findings, still produce a (possibly empty) run so the
 * producer set round-trips.
 */
export function toSarif(report: Report): SarifLog {
  const findings: Finding[] = report.sections.flatMap((s) => s.findings ?? []);
  const runs: SarifRun[] = report.sources.map((src) => {
    const own = findings.filter((f) => f.source === src.id);
    const ruleIds = [...new Set(own.map((f) => f.ruleId).filter((r): r is string => !!r))];
    return {
      tool: { driver: { name: src.name || src.id, rules: ruleIds.map((id) => ({ id })) } },
      results: own.map(toSarifResult),
    };
  });
  return { $schema: 'https://json.schemastore.org/sarif-2.1.0.json', version: '2.1.0', runs };
}

function toSarifResult(f: Finding): SarifResult {
  const result: SarifResult = {
    level: severityToSarifLevel(f.severity),
    message: { text: f.detail ? `${f.title} — ${f.detail}` : f.title },
  };
  if (f.ruleId) result.ruleId = f.ruleId;
  if (f.location) {
    const region = f.location.line !== undefined
      ? { startLine: f.location.line, ...(f.location.col !== undefined ? { startColumn: f.location.col } : {}) }
      : undefined;
    result.locations = [{
      physicalLocation: {
        artifactLocation: { uri: f.location.path },
        ...(region ? { region } : {}),
      },
    }];
  }
  return result;
}

// ── JUnit XML ───────────────────────────────────────────────────────────────────

const xmlEsc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));

/** A finding fails the build when its severity is `error` or `warn`; `info`/`pass`/extended → passing. */
function isFailure(severity: Severity | string): boolean {
  return severity === 'error' || severity === 'warn';
}

/**
 * Report → JUnit XML. One `<testsuite>` per section; one `<testcase>` per finding. An error/warn finding
 * carries a `<failure>` (its `type` is the severity, so a consumer can still tell them apart); info/pass
 * findings are passing cases. Suite + root `tests`/`failures` counts are tallied so a CI runner reads them
 * directly. A section with no findings emits an empty (zero-test) suite so the section set round-trips.
 */
export function toJUnit(report: Report): string {
  const suites = report.sections.map((s) => junitSuite(s));
  const totalTests = report.sections.reduce((n, s) => n + (s.findings?.length ?? 0), 0);
  const totalFailures = report.sections.reduce(
    (n, s) => n + (s.findings ?? []).filter((f) => isFailure(f.severity)).length, 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<testsuites name="${xmlEsc(report.title)}" tests="${totalTests}" failures="${totalFailures}">\n` +
    suites.join('\n') + (suites.length ? '\n' : '') +
    `</testsuites>\n`;
}

function junitSuite(section: ReportSection): string {
  const findings = section.findings ?? [];
  const failures = findings.filter((f) => isFailure(f.severity)).length;
  const cases = findings.map((f) => junitCase(f, section.title)).join('\n');
  return `  <testsuite name="${xmlEsc(section.title)}" tests="${findings.length}" failures="${failures}">\n` +
    (cases ? cases + '\n' : '') +
    `  </testsuite>`;
}

function junitCase(f: Finding, classname: string): string {
  const open = `    <testcase name="${xmlEsc(f.title)}" classname="${xmlEsc(classname)}">`;
  if (!isFailure(f.severity)) return `${open}</testcase>`;
  const loc = f.location ? `${f.location.path}${f.location.line !== undefined ? `:${f.location.line}` : ''} ` : '';
  const msg = `${loc}${f.title}${f.ruleId ? ` (${f.ruleId})` : ''}`;
  const body = f.detail ? xmlEsc(f.detail) : '';
  return `${open}\n` +
    `      <failure message="${xmlEsc(msg)}" type="${xmlEsc(String(f.severity))}">${body}</failure>\n` +
    `    </testcase>`;
}
