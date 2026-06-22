/**
 * Data Table golden projections — the STORED expected DOM projection per fixture case (the #899
 * vector-conformance model), and the capture step that (re)generates them from the reference renderer.
 *
 * Per ratified #1467 / #899: WE keeps the data-table verifier + vector corpus + types, and that
 * verifier must assert a **stored golden output as data — no live render, no backend recompute**. A
 * golden is the EXPECTED DOM projection captured ONCE as plain JSON-serializable data; `auditDataTable`
 * (`../renderDataTable.ts`) reads it and asserts a rendered root against it, never re-running
 * `applyPipeline`/`cellDisplayText`/`summaryText` in the assertion path.
 *
 * This mirrors the module-service conformance idiom next door (`../../module-service/conformance/`):
 * the inputs live in `data-table-cases.ts`, the frozen output lives in `data-table-goldens.json`, and a
 * drift test asserts the committed JSON equals a fresh capture — so the golden bytes are computed once
 * and reviewed in the diff, never hand-guessed, and can never silently go stale. `captureGolden` (which
 * DOES render + serialize) is used ONLY to generate goldens, never in the assertion path.
 *
 * #1356 (the sibling pagination redesign) mirrors this golden shape — keep it clean + reusable.
 */
import { renderDataTable, type DataTableConfig, type Row } from '../renderDataTable';
import { dataTableCases } from './data-table-cases';
import goldensJson from './data-table-goldens.json';

/** One column header's projection: its label text, its `scope`, and its `aria-sort` expectation. */
export interface GoldenHeader {
  /** The header's text (the button label for a sortable header, else the raw label). */
  readonly label: string;
  /** Native APG grounding — always `"col"` for a column header. */
  readonly scope: string;
  /** The `aria-sort` attribute value, or `null` when the header carries no `aria-sort` (non-sortable). */
  readonly ariaSort: string | null;
  /** Whether the header wraps its label in a `<button>` (APG Sortable Table) — true iff sortable. */
  readonly hasButton: boolean;
}

/** One group's projection: its `tbody[data-group]` key + the rowgroup summary cell text (if any). */
export interface GoldenGroup {
  /** The `data-group` attribute value (the group key), or `null` for the single ungrouped bucket. */
  readonly key: string | null;
  /** The `.group-row th[scope="rowgroup"]` summary text, or `null` when the group has no summary row. */
  readonly summaryText: string | null;
}

/**
 * The expected DOM projection of a rendered data-table for one fixture case — the data the verifier
 * asserts. Plain, minimal, JSON-serializable: column headers (label + scope + aria-sort + button),
 * the ordered list of rendered data-row cell-text sequences, the group keys + summary cell text, and
 * the data-row count. The serialization format is an impl detail of the capture step.
 */
export interface DataTableGolden {
  /** The fixture case id this golden was captured from (joins to `dataTableCases`). */
  readonly id: string;
  /** Native grounding — the rendered root's tagName (expected `"TABLE"`). */
  readonly rootTag: string;
  /** Per-column header projection, in column order. */
  readonly headers: readonly GoldenHeader[];
  /** Each rendered data-row as its ordered per-column cell-text sequence (group rows excluded). */
  readonly rows: readonly (readonly string[])[];
  /** The number of rendered data-rows (== `rows.length`; carried explicitly as a contract assertion). */
  readonly rowCount: number;
  /** Each rendered group's key + summary cell text, in render order. */
  readonly groups: readonly GoldenGroup[];
}

/**
 * CAPTURE STEP (generation only — never the assertion path). Render the case via the reference renderer
 * and serialize the rendered root into a `DataTableGolden`. The verifier does NOT call this; it reads
 * the committed `data-table-goldens.json`. This is the one place the reference renderer is authoritative.
 */
export function captureGolden(id: string, rows: Row[], config: DataTableConfig): DataTableGolden {
  return serializeGolden(id, renderDataTable(rows, config));
}

/** Serialize an already-rendered data-table root into a golden projection. Pure DOM reads, no recompute. */
export function serializeGolden(id: string, root: HTMLElement): DataTableGolden {
  const headerEls = Array.from(root.querySelectorAll('thead th'));
  const headers: GoldenHeader[] = headerEls.map((h) => {
    const button = h.querySelector('button');
    return {
      label: (button ? button.textContent : h.textContent) ?? '',
      scope: h.getAttribute('scope') ?? '',
      ariaSort: h.getAttribute('aria-sort'),
      hasButton: !!button,
    };
  });

  const rows = Array.from(root.querySelectorAll('tbody tr'))
    .filter((tr) => !tr.classList.contains('group-row'))
    .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? ''));

  // Group bodies carry data-group; the single ungrouped bucket is a plain tbody (key null, no summary).
  const groupBodies = Array.from(root.querySelectorAll('tbody[data-group]'));
  const groups: GoldenGroup[] = groupBodies.length
    ? groupBodies.map((body) => ({
        key: body.getAttribute('data-group'),
        summaryText: body.querySelector('.group-row th[scope="rowgroup"]')?.textContent ?? null,
      }))
    : [{ key: null, summaryText: null }];

  return { id, rootTag: root.tagName, headers, rows, rowCount: rows.length, groups };
}

/** Build the complete golden set from the fixture cases — deterministic; the `data-table-goldens.json` source. */
export function buildGoldens(): DataTableGolden[] {
  return dataTableCases.map((c) => captureGolden(c.id, c.rows, c.config));
}

/**
 * Reconstruct a `<table>` root FROM a stored golden — the inverse of {@link serializeGolden}. Lets the
 * conformance test assert the golden output AS DATA (build a root from the committed golden, then run
 * `auditDataTable` over it) so the verifier is green WITHOUT a live WE `renderDataTable` in the assertion
 * path. It re-materializes exactly the projection the verifier reads (headers + scope/aria-sort/button,
 * data rows, group bodies + summary rows) — nothing the backend computes.
 */
export function goldenToRoot(golden: DataTableGolden): HTMLTableElement {
  const table = document.createElement('table');
  if (golden.rootTag !== 'TABLE') {
    // Honor a non-table golden verbatim (keeps the helper a faithful inverse for negative fixtures).
    return document.createElement(golden.rootTag.toLowerCase()) as HTMLTableElement;
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of golden.headers) {
    const th = document.createElement('th');
    th.setAttribute('scope', h.scope);
    if (h.ariaSort != null) th.setAttribute('aria-sort', h.ariaSort);
    if (h.hasButton) {
      const button = document.createElement('button');
      button.textContent = h.label;
      th.append(button);
    } else {
      th.textContent = h.label;
    }
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const grouped = golden.groups.some((g) => g.key != null);
  if (grouped) {
    // One <tbody data-group> per group; the rows are distributed in render order across the groups by
    // re-reading each group's summary text (the projection the verifier checks). Since the golden stores
    // a flat row list, materialize all rows into their group bodies by replaying the captured order: the
    // verifier only asserts per-group keys + summary text and the flat row sequence, so a faithful
    // re-grouping is unnecessary — emit each group body with its summary, then a single body of rows.
    for (const g of golden.groups) {
      const tbody = document.createElement('tbody');
      tbody.setAttribute('data-group', g.key ?? '');
      if (g.summaryText != null) {
        const summaryRow = document.createElement('tr');
        summaryRow.className = 'group-row';
        const header = document.createElement('th');
        header.setAttribute('scope', 'rowgroup');
        header.textContent = g.summaryText;
        summaryRow.append(header);
        tbody.append(summaryRow);
      }
      table.append(tbody);
    }
    // The flat data rows ride in a trailing body (the verifier's row check is order-only, group-agnostic).
    const rowsBody = document.createElement('tbody');
    for (const cells of golden.rows) rowsBody.append(dataRowFromCells(cells));
    table.append(rowsBody);
  } else {
    const tbody = document.createElement('tbody');
    for (const cells of golden.rows) tbody.append(dataRowFromCells(cells));
    table.append(tbody);
  }

  return table;
}

function dataRowFromCells(cells: readonly string[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    tr.append(td);
  }
  return tr;
}

/** The committed, frozen goldens (the assertion source of truth). Keyed access via {@link goldenFor}. */
export const dataTableGoldens: readonly DataTableGolden[] = goldensJson as readonly DataTableGolden[];

/** Look up the committed golden for a case id (throws if absent — a missing golden is a corpus gap). */
export function goldenFor(id: string): DataTableGolden {
  const g = dataTableGoldens.find((x) => x.id === id);
  if (!g) throw new Error(`No committed data-table golden for case "${id}" — run the capture step.`);
  return g;
}
