/**
 * Conformance suite for DataTableBehavior — the consumable wrapper over the verified reference
 * renderer. Asserts that mounting + interacting preserves the contract: it renders the audited table,
 * click-to-sort advances `aria-sort` via the shared helpers, a polite live region announces, and a
 * `data-table-change` event fires. The wrapper must add NO bespoke sorting/markup — it delegates.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { auditDataTable, type Row, type DataTableConfig } from '../../../renderers/data-table/renderDataTable';
import { serializeGolden } from '../../../renderers/data-table/__fixtures__/data-table-goldens';
import { DataTableBehavior, DataTableElement, registerDataTable } from '../../../renderers/data-table/DataTableBehavior';

// The verifier is a golden-reader (#1467/#899): assert a live table by serializing its projection to a
// golden, then auditing the table against that golden — no backend recompute in the assertion.
const auditLive = (table: HTMLElement) => auditDataTable(table, serializeGolden('behavior', table));

const rows: Row[] = [
  { name: 'Bianca', team: 'Engineering', salary: 120 },
  { name: 'Aaron', team: 'Sales', salary: 90 },
  { name: 'Chloe', team: 'Engineering', salary: 110 },
];
const config: DataTableConfig = {
  columns: [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'team', label: 'Team', sortable: true },
    { field: 'salary', label: 'Salary', sortable: true },
  ],
  sort: { keys: 'single', by: [{ field: 'name', direction: 'ascending' }] },
};

describe('DataTableBehavior', () => {
  let host: HTMLElement;
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); });

  it('renders the audited reference table', () => {
    new DataTableBehavior(host, { rows, config });
    const table = host.querySelector('table')!;
    expect(table).toBeTruthy();
    expect(auditLive(table).ok).toBe(true);
    // initial sort projected onto exactly one header
    expect(host.querySelectorAll('th[aria-sort="ascending"]').length).toBe(1);
  });

  it('click-to-sort advances aria-sort and announces, without re-implementing sort', () => {
    const changes: DataTableConfig[] = [];
    new DataTableBehavior(host, { rows, config, onChange: (c) => changes.push(c) });
    let fired = 0;
    host.addEventListener('data-table-change', () => fired++);

    // click the Team header's sort button → Team becomes the sole sorted header
    const teamBtn = host.querySelector('button[data-action="sort"][data-field="team"]') as HTMLButtonElement;
    teamBtn.click();

    expect(host.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('Team');
    expect(host.querySelectorAll('th[aria-sort="ascending"], th[aria-sort="descending"]').length).toBe(1);
    expect(host.querySelector('.data-table-live')?.textContent).toMatch(/Sorted by Team/i);
    expect(changes.at(-1)?.sort?.by[0]).toMatchObject({ field: 'team' });
    expect(fired).toBe(1);
    // the rendered table still passes the audit under the new config
    expect(auditLive(host.querySelector('table')!).ok).toBe(true);
  });

  it('setRows re-renders with new data', () => {
    const b = new DataTableBehavior(host, { rows, config });
    b.setRows([{ name: 'Zed', team: 'Ops', salary: 50 }]);
    expect(host.querySelectorAll('tbody tr').length).toBe(1);
    expect(host.querySelector('tbody')?.textContent).toContain('Zed');
  });

  it('<data-table> element drives the behavior from JS properties', () => {
    registerDataTable();
    const el = document.createElement('data-table') as DataTableElement;
    el.rows = rows;
    el.config = config;
    document.body.append(el);
    expect(el.querySelector('table')).toBeTruthy();
    expect(auditLive(el.querySelector('table')!).ok).toBe(true);
  });
});
