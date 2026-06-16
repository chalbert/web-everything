/**
 * conformanceReport — map check:app-conformance output onto the #431 report model (slice C of #435's
 * reporter-migration fan-out; #711). Built via the shared #435 `buildReport()` so app-conformance pipes
 * through the #432 renderers + #434 export adapters like every other reporter.
 *
 * Two sections:
 *   - `coverage` — a coverage-matrix `section` (#432 `coverageFromScores` pivots it): one `score` per
 *     Layer-1 standard, id `"<standardId>/conformance"` (the `row/col` convention), `value` mapping the
 *     severity onto a 0..1 scale (OK → 1, GAP → 0.5, FAIL → 0) against `max: 1`, so the matrix tones each
 *     cell positive / caution / critical. `findings[]` carries each non-conformant standard as a finding
 *     (FAIL → error, GAP → warn) so the gap survives into SARIF/JUnit.
 *   - `trend` — the `--burndown` history as `series[]` (score% + fail/gap counts over time). The burndown
 *     series is PART of this reporter (not a standalone one) — the #435 split note's correction.
 *
 * Pure (no fs/process), so the CLI injects the loaded burndown entries and it stays testable against
 * in-memory fixtures. The CLI's terminal/ANSI path stays bespoke; only the structured view migrates.
 */
import { buildReport, source as reportSource, section as reportSection, score as reportScore, finding as reportFinding, series as reportSeries } from './buildReport.mjs';

/** Severity → a 0..1 coverage value (against max 1): conformant full, gap partial, fail none. */
const severityValue = (sev) => (sev === 'OK' ? 1 : sev === 'GAP' ? 0.5 : 0);

/**
 * @param {string} appRel  The app path (e.g. `demos/<id>`).
 * @param {Array<{id:string,status:string,severity:string,kind?:string,stdStatus?:string,at?:string|null}>} conformance
 *   The `layer1_conformance` rows.
 * @param {Array<{date:string,score:number,fails:number,gaps:number,candidates?:number}>} burndown
 *   The burndown history for this app (`reports/app-conformance-burndown.json`[appRel]); may be empty.
 * @returns {object} A #431 model-valid Report.
 */
export function buildConformanceReport(appRel, conformance, burndown = []) {
  const sourceId = 'check-app-conformance';
  const coverageScores = conformance.map((c) => reportScore({
    id: `${c.id}/conformance`,
    label: c.status,
    value: severityValue(c.severity),
    max: 1,
  }));
  // Non-conformant standards as findings (FAIL → error, GAP → warn) so the gap reaches SARIF/JUnit.
  const coverageFindings = conformance
    .filter((c) => c.severity !== 'OK')
    .map((c) => reportFinding({
      id: `conformance/${c.id}`,
      severity: c.severity === 'GAP' ? 'warn' : 'error',
      title: `${c.id}: ${c.status}`,
      ruleId: c.status,
      location: c.at ? { path: c.at.split(':')[0], line: Number(c.at.split(':')[1]) || undefined } : undefined,
      source: sourceId,
    }));

  const seriesFrom = (id, label, key, unit) => reportSeries({
    id, label, unit,
    points: burndown.map((e) => ({ at: e.date, value: e[key] })),
  });
  const trendSeries = burndown.length
    ? [
        seriesFrom('score', 'Conformance score', 'score', '%'),
        seriesFrom('fails', 'FAIL count', 'fails'),
        seriesFrom('gaps', 'GAP count', 'gaps'),
      ]
    : [];

  return buildReport({
    id: 'check-app-conformance',
    title: `Web Everything — app conformance: ${appRel}`,
    sources: [reportSource({ id: sourceId, name: `check:app-conformance ${appRel}`, kind: 'validator' })],
    sections: [
      reportSection({ id: 'coverage', title: `Layer-1 conformance (${conformance.length} standard(s))`, scores: coverageScores, findings: coverageFindings }),
      reportSection({ id: 'trend', title: `Burndown (${burndown.length} run(s))`, series: trendSeries }),
    ],
  });
}
