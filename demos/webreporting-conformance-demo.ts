/**
 * Web Reporting conformance demo (#1063, finish slice of #1023) — the runnable proof of the report-model
 * protocol (#431) end-to-end: ingest a foreign producer's output (SARIF / JUnit / Istanbul coverage) →
 * the normalized `Report` pivot → the shared v1 renderers (findings table, coverage matrix).
 *
 * The core conformance claim is the **lossy-normalization-hub** ([[feedback_adapter_normalization_hub]]):
 * three unrelated producer formats all ingest INTO one `Report` schema the project never ships as a
 * format, so a single set of renderers displays every tool's results — no bespoke viewer per producer.
 * The export adapters (toSarif / toJUnit) close the loop: an export-then-ingest round-trips on the base
 * vocabulary. Everything here is the WE-side impl (#432 renderers, #433 ingest, #434 export); the demo
 * imports them as plain libraries and asserts each invariant live, then `setPlaygroundReady` reports the
 * pass count the e2e smoke reads.
 */
import { fromSarif, fromJUnit, fromCoverage } from '/blocks/adapters/report/ingestReport.ts';
import { toSarif, toJUnit } from '/blocks/adapters/report/exportReport.ts';
import {
  renderFindingsTable,
  renderCoverageMatrix,
  coverageFromScores,
  type Report,
} from '/blocks/renderers/report/renderReport.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

// ── Sample producer outputs (the three ingest fixtures) ──────────────────────────────────────────────

const SARIF = {
  $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
  version: '2.1.0' as const,
  runs: [
    {
      tool: { driver: { name: 'eslint', rules: [{ id: 'no-unused-vars' }, { id: 'eqeqeq' }] } },
      results: [
        {
          ruleId: 'no-unused-vars',
          level: 'error' as const,
          message: { text: "'config' is defined but never used" },
          locations: [{ physicalLocation: { artifactLocation: { uri: 'src/app.ts' }, region: { startLine: 12 } } }],
        },
        {
          ruleId: 'eqeqeq',
          level: 'warning' as const,
          message: { text: 'Expected === and instead saw ==' },
          locations: [{ physicalLocation: { artifactLocation: { uri: 'src/util.ts' }, region: { startLine: 4, startColumn: 9 } } }],
        },
      ],
    },
  ],
};

const JUNIT = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="auth.spec.ts">
    <testcase name="logs a user in" />
    <testcase name="rejects a bad password"><failure type="error" message="expected 401">AssertionError: 200 !== 401</failure></testcase>
  </testsuite>
</testsuites>`;

const COVERAGE = {
  total: { lines: { total: 100, covered: 92, pct: 92 }, branches: { total: 40, covered: 30, pct: 75 } },
  'src/app.ts': { lines: { total: 50, covered: 50, pct: 100 }, branches: { total: 20, covered: 14, pct: 70 } },
};

// ── Conformance checks — each asserts one report-model invariant live ────────────────────────────────

interface Check {
  title: string;
  run(): boolean;
}

const CHECKS: Check[] = [
  {
    title: 'SARIF ingest → normalized Report (level → severity, location preserved)',
    run: () => {
      const report = fromSarif(SARIF, { id: 'r-sarif', title: 'ESLint' });
      const all = report.sections.flatMap((s) => s.findings ?? []);
      const err = all.find((f) => f.ruleId === 'no-unused-vars');
      const warn = all.find((f) => f.ruleId === 'eqeqeq');
      return all.length === 2
        && err?.severity === 'error'
        && warn?.severity === 'warn'
        && err?.location?.path === 'src/app.ts'
        && err?.location?.line === 12;
    },
  },
  {
    title: 'JUnit ingest → Report (a <failure> → its severity, a passing case → "pass")',
    run: () => {
      const report = fromJUnit(JUNIT, { id: 'r-junit' });
      const findings = report.sections.flatMap((s) => s.findings ?? []);
      const pass = findings.find((f) => f.title.includes('logs a user in'));
      const fail = findings.find((f) => f.title.includes('rejects a bad password'));
      return findings.length === 2 && pass?.severity === 'pass' && fail?.severity === 'error';
    },
  },
  {
    title: 'Coverage ingest → Scores keyed "file/metric" → pivots into a coverage matrix',
    run: () => {
      const report = fromCoverage(COVERAGE, { id: 'r-cov', title: 'Coverage' });
      const scores = report.sections.flatMap((s) => s.scores ?? []);
      const matrix = coverageFromScores(scores);
      // total + src/app.ts rows; a covered metric cell resolves, an absent one is undefined.
      const totalLines = matrix.cell('total', 'lines');
      return scores.length > 0
        && matrix.rows.some((r) => r.id === 'total')
        && matrix.rows.some((r) => r.id === 'app.ts')
        && totalLines?.label === '92%';
    },
  },
  {
    title: 'One pivot, many producers — SARIF + JUnit normalize to the SAME Report shape',
    run: () => {
      const a = fromSarif(SARIF, { id: 'a' });
      const b = fromJUnit(JUNIT, { id: 'b' });
      const shaped = (r: Report) =>
        Array.isArray(r.sources) && Array.isArray(r.sections)
        && r.sections.every((s) => typeof s.id === 'string' && typeof s.title === 'string');
      return shaped(a) && shaped(b);
    },
  },
  {
    title: 'renderFindingsTable produces an accessible table with a row per finding',
    run: () => {
      const report = fromSarif(SARIF, { id: 'r' });
      const findings = report.sections.flatMap((s) => s.findings ?? []);
      const html = renderFindingsTable(findings);
      const host = el('div');
      host.innerHTML = html;
      const table = host.querySelector('table.report-findings');
      const rows = host.querySelectorAll('tbody tr');
      return !!table && table.getAttribute('aria-label') === 'Findings' && rows.length === 2;
    },
  },
  {
    title: 'renderCoverageMatrix produces a grid of status cells from the pivoted scores',
    run: () => {
      const report = fromCoverage(COVERAGE, { id: 'r' });
      const matrix = coverageFromScores(report.sections.flatMap((s) => s.scores ?? []));
      const html = renderCoverageMatrix(matrix);
      const host = el('div');
      host.innerHTML = html;
      return !!host.querySelector('table.report-coverage') && host.querySelectorAll('tbody tr').length >= 2;
    },
  },
  {
    title: 'Export round-trips — toSarif(fromSarif(x)) preserves the findings',
    run: () => {
      const report = fromSarif(SARIF, { id: 'r' });
      const back = toSarif(report);
      const results = back.runs.flatMap((run) => run.results);
      return results.length === 2 && results.some((r) => r.ruleId === 'no-unused-vars' && r.level === 'error');
    },
  },
  {
    title: 'toJUnit emits a testsuite for the normalized Report (cross-format export)',
    run: () => {
      const report = fromJUnit(JUNIT, { id: 'r' });
      const xml = toJUnit(report);
      return xml.includes('<testsuite') && xml.includes('<testcase');
    },
  },
];

function runConformance(host: HTMLElement): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card rp-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'rp-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webreporting report-model invariants hold`;
  return pass;
}

/** Render a live ingested report (findings + coverage) so the normalization-hub claim is visible, not just asserted. */
function renderLive(host: HTMLElement): void {
  const findings = fromSarif(SARIF, { id: 'live-sarif', title: 'ESLint' }).sections.flatMap((s) => s.findings ?? []);
  const junit = fromJUnit(JUNIT, { id: 'live-junit' }).sections.flatMap((s) => s.findings ?? []);
  const cov = coverageFromScores(fromCoverage(COVERAGE, { id: 'live-cov' }).sections.flatMap((s) => s.scores ?? []));

  const findingsWrap = el('div', { class: 'rp-render' });
  findingsWrap.innerHTML = `<h3>Findings (SARIF + JUnit, one renderer)</h3>${renderFindingsTable([...findings, ...junit])}`;
  const coverageWrap = el('div', { class: 'rp-render' });
  coverageWrap.innerHTML = `<h3>Coverage (Istanbul summary, pivoted)</h3>${renderCoverageMatrix(cov)}`;
  host.append(findingsWrap, coverageWrap);
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'rp-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — report-model ingest → pivot → render'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  const live = el('section', { class: 'rp-card' });
  live.append(el('h2', {}, 'Live render — every producer through the shared renderers'));
  renderLive(live);
  root.append(live);

  setPlaygroundReady(passCount);
}

main();
