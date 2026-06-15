/**
 * buildReport — the shared plain-object constructor for the Web Reporting report model (#431 contract;
 * #350 phase 5, slice A of #435). Producers call these factories to emit a model-valid {@link Report}
 * that pipes through the #432 renderers (`renderFindingsTable` / `renderCoverageMatrix`) and the #434
 * export adapters (`toSarif` / `toJUnit`) with no per-producer reshaping.
 *
 * Pure JS, NO TS import: the report model IS a plain-object contract (the TS renderers/adapters are
 * downstream JSON consumers), so the producer side stays runnable from a plain `.mjs` check script. The
 * field shapes mirror `blocks/renderers/report/renderReport.ts` exactly — keep the two in step.
 *
 * The sibling reporter slices reuse this helper:
 *   - B  check:readiness          → ranked selection + batch pack as a `section` with `scores[]`
 *   - C  check:app-conformance    → coverage-matrix `section` + the `--burndown` `series[]`
 *   - D  capability-manifest      → adherence `section`
 *
 * Every factory drops `undefined` optional keys (so the emitted JSON carries only present fields) and
 * asserts the model's required fields, so a malformed producer fails loudly here rather than producing a
 * silently invalid report downstream.
 */

/** Drop keys whose value is `undefined` so optional fields stay absent in the emitted JSON. */
const compact = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
};

const need = (cond, msg) => {
  if (!cond) throw new Error(`buildReport: ${msg}`);
};

/** A producer/run the findings trace back to. → {@link ReportSource}. */
export function source({ id, name, kind, at, meta }) {
  need(id, 'source.id is required');
  need(name, `source.name is required (id="${id}")`);
  return compact({ id, name, kind, at, meta });
}

/** One normalized finding. `source` references a {@link source}'s id. → {@link Finding}. */
export function finding({ id, severity, title, detail, location, ruleId, source }) {
  need(id, 'finding.id is required');
  need(severity, `finding.severity is required (id="${id}")`);
  need(title, `finding.title is required (id="${id}")`);
  need(source, `finding.source (a source id) is required (id="${id}")`);
  return compact({ id, severity, title, detail, location, ruleId, source });
}

/** A scalar metric. → {@link Score}. */
export function score({ id, label, value, max, unit }) {
  need(id, 'score.id is required');
  need(label, `score.label is required (id="${id}")`);
  need(typeof value === 'number', `score.value must be a number (id="${id}")`);
  return compact({ id, label, value, max, unit });
}

/** A time/ordered series (e.g. a burndown). → {@link Series}. */
export function series({ id, label, points, unit }) {
  need(id, 'series.id is required');
  need(label, `series.label is required (id="${id}")`);
  need(Array.isArray(points), `series.points must be an array (id="${id}")`);
  return compact({ id, label, points, unit });
}

/** A grouping of findings / scores / series. → {@link ReportSection}. */
export function section({ id, title, findings, scores, series }) {
  need(id, 'section.id is required');
  need(title, `section.title is required (id="${id}")`);
  return compact({ id, title, findings, scores, series });
}

/** Assemble a complete model-valid {@link Report}. */
export function buildReport({ id, title, sources, sections, generatedAt }) {
  need(id, 'report.id is required');
  need(title, `report.title is required (id="${id}")`);
  need(Array.isArray(sources), `report.sources must be an array (id="${id}")`);
  need(Array.isArray(sections), `report.sections must be an array (id="${id}")`);
  // Every finding's `source` must resolve to a declared source — the same invariant the export
  // adapters lean on (one SARIF run per source). Catch the dangling ref at production time.
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const sec of sections)
    for (const f of sec.findings ?? [])
      need(sourceIds.has(f.source), `finding "${f.id}" references unknown source "${f.source}"`);
  return compact({ id, title, sources, sections, generatedAt });
}
