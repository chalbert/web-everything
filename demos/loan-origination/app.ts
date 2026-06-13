/**
 * Loan-origination exercise app — S0 foundation harness.
 *
 * This is a thin vanilla shell that proves the domain core works end-to-end: it generates the 5k-app
 * pipeline, runs the rules engine over all of them (proving the engine at scale), shows the finding
 * distribution, and renders a sample of the pipeline with a per-application proof-of-compliance trace.
 *
 * The real UI slices (S3 borrower wizard on the SPA shell, S10 windowed pipeline with the standard's
 * collection operations + pagination) replace this harness incrementally — see backlog #317.
 */

import { generatePipeline } from './domain/seed';
import { evaluate, type EvaluationResult } from './domain/rules';
import { deriveFacts } from './domain/facts';
import { getProduct } from './domain/catalog';
import type { Application, Finding } from './domain/types';
import { registerDataTable, type DataTableElement } from '../../blocks/renderers/data-table/DataTableBehavior';
import type { Row, DataTableConfig } from '../../blocks/renderers/data-table/renderDataTable';
import { PaginationBehavior, registerPagination } from '../../blocks/renderers/pagination/PaginationBehavior';
import { MasterDetailBehavior } from '../../blocks/master-detail/MasterDetailBehavior';
import { DefaultLifecycleProvider, registerLifecycle } from '../../blocks/lifecycle/LifecycleProvider';
import { statusIndicatorHTML } from '../../blocks/renderers/status-indicator/renderStatusIndicator';
import type { ApplicationState } from './domain/types';
import { LOAN_LIFECYCLE, FINDING_TONE } from './domain/lifecycle';
import { DefaultAuditProvider, registerAudit, auditLifecycle } from '../../blocks/audit/AuditProvider';
import { auditTimelineHTML } from '../../blocks/renderers/audit-timeline/renderAuditTimeline';
import { decisionTraceHTML } from '../../blocks/renderers/decision-trace/renderDecisionTrace';
import { toDecisionRecord } from './domain/decision';

// Web Lifecycle block (active): the loan's status machine is the data-defined LOAN_LIFECYCLE driving the
// shipping DefaultLifecycleProvider — we no longer hand-roll transitions. The Status Indicator render
// (statusIndicatorHTML) owns every status chip. Registered once at boot as the 'loan' provider.
const loanLifecycle = new DefaultLifecycleProvider<ApplicationState>(LOAN_LIFECYCLE);

// Web Audit block (active): the entity's immutable history. The headline composition — auditLifecycle()
// (wired at boot) — subscribes the lifecycle provider so every transition auto-appends one AuditEvent.
// The audit-timeline render owns the history panel. Registered once at boot as the 'loan' provider.
const loanAudit = new DefaultAuditProvider();
const ACTOR = { role: 'underwriter' as const }; // the signed-in user (D. Okafor)

const FINDING_LABEL: Record<Finding, string> = {
  'approve-eligible': 'Approve / Eligible',
  'refer': 'Refer',
  'refer-with-caution': 'Refer w/ Caution',
  'ineligible': 'Ineligible',
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function findingDistribution(apps: Application[]): Map<Finding, number> {
  const dist = new Map<Finding, number>();
  for (const app of apps) {
    const f = evaluate(app).finding;
    dist.set(f, (dist.get(f) ?? 0) + 1);
  }
  return dist;
}

function renderSummary(apps: Application[], dist: Map<Finding, number>): string {
  const rows = (['approve-eligible', 'refer', 'refer-with-caution', 'ineligible'] as Finding[])
    .map((f) => {
      const n = dist.get(f) ?? 0;
      const chip = statusIndicatorHTML({ label: FINDING_LABEL[f], tone: FINDING_TONE[f], shape: 'pill' });
      return `<div class="stat"><span class="stat-n finding-${f}">${n.toLocaleString()}</span><span class="stat-l">${chip}</span></div>`;
    }).join('');
  return `<div class="stats"><div class="stat"><span class="stat-n">${apps.length.toLocaleString()}</span><span class="stat-l">Applications</span></div>${rows}</div>`;
}

// The pipeline table is now the data-table block (active): each loan is projected to a flat Row and the
// block's verified renderer owns the <table> / <th scope> / aria-sort / Intl.Collator contract plus
// click-to-sort + the polite announcement. We do NOT hand-roll the table any more.
// PLATFORM-GAP: #368 — data-table has no per-column cell formatter, so the State/Finding *columns* still
// render plain text; the conformant Status Indicator chips live in the summary + trace panel (which we
// control). Wiring chips into table cells needs the cell-formatter gap (#368) closed first.
const PIPELINE_COLUMNS: DataTableConfig['columns'] = [
  { field: 'loan', label: 'Loan #', sortable: true },
  { field: 'borrower', label: 'Borrower', sortable: true },
  { field: 'product', label: 'Product', sortable: true },
  { field: 'amount', label: 'Amount', sortable: true },
  { field: 'state', label: 'State', sortable: true },
  { field: 'finding', label: 'Finding', sortable: true },
];
function pipelineRows(apps: Application[]): Row[] {
  return apps.map((app) => ({
    loan: app.loanNumber,
    borrower: `${app.borrowers[0].firstName} ${app.borrowers[0].lastName}`,
    product: getProduct(app.loan.productId)?.name ?? app.loan.productId,
    amount: app.loan.loanAmount,
    state: app.state,
    finding: FINDING_LABEL[evaluate(app).finding],
  }));
}

function renderTrace(
  app: Application,
  result: EvaluationResult,
  available: ApplicationState[] = [],
  historyHTML = '',
): string {
  const facts = deriveFacts(app);
  const b = app.borrowers[0];
  // The proof-of-compliance trace is now the decision-trace block (active): the rules-engine result is
  // mapped to the standard DecisionRecord and rendered by renderDecisionTrace (which composes the
  // status-indicator block for the outcome). We no longer hand-roll the trace table.
  const decisionHTML = decisionTraceHTML(toDecisionRecord(app, result, formatFact), { layout: 'table' });
  const cell = (k: string, v: string) => `<div class="cell"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const stateMeta = loanLifecycle.meta(app.state);
  const stateChip = statusIndicatorHTML({ label: stateMeta.label ?? app.state, tone: stateMeta.tone, shape: 'badge' });
  // The available next moves for the underwriter — actionable (status-indicator `affordance`). Firing one
  // calls loanLifecycle.transition(); the audit provider (subscribed via auditLifecycle) auto-logs it.
  const nextActions = available.length
    ? `<div class="lc-actions"><span class="muted">Advance (underwriter):</span> ${available
        .map((s) => `<button type="button" class="lc-advance" data-to="${s}">${loanLifecycle.meta(s).label ?? s}</button>`).join(' ')}</div>`
    : '';
  return `<div class="trace-body">
    <h3>${app.loanNumber} &middot; ${b.firstName} ${b.lastName}</h3>
    <p class="muted">${stateChip} &middot; rule set ${result.ruleSetVersion}</p>
    ${nextActions}
    <div class="snapshot">
      ${cell('Finding', statusIndicatorHTML({ label: FINDING_LABEL[result.finding], tone: FINDING_TONE[result.finding], shape: 'pill' }))}
      ${cell('Loan amount', money(app.loan.loanAmount))}
      ${cell('Note rate', pct(app.loan.noteRate))}
      ${cell('Back-end DTI', pct(facts.backEndDTI))}
      ${cell('LTV', pct(facts.ltv))}
      ${cell('Credit score', String(facts.representativeCreditScore))}
    </div>
    <div class="panel-hd" style="border-radius:3px 3px 0 0">Proof-of-compliance trace</div>
    ${decisionHTML}
    <div class="panel-hd" style="border-radius:3px 3px 0 0">Audit trail</div>
    ${historyHTML}
  </div>`;
}

function formatFact(name: string, value: number): string {
  if (name.endsWith('DTI') || name === 'ltv' || name === 'cltv') return pct(value);
  if (name === 'downPaymentCovered') return value >= 1 ? 'yes' : 'no';
  if (name.includes('Months') || name === 'representativeCreditScore') return String(Math.round(value));
  if (name.includes('Assets') || name.includes('Income') || name.includes('Payment') || name.includes('Debt')) return money(value);
  return value.toFixed(2);
}

/**
 * The module bar is the app's navigation. Each tab is a real client-side route, served by the
 * shipping Router block (active) — the app is its first enterprise consumer. We do NOT hand-roll
 * navigation: tabs are `route:link` anchors and the workspace is a `<route-view>` of per-module
 * `<template route>`s. The pipeline module is the one built out; the rest are routed placeholders
 * (the WE surface under test this turn is the router, not these modules' features — backlog #317).
 */
/**
 * The app is served under a mounted base path (`/demos/loan-origination/`), not at the origin root.
 * Route patterns are logical (`/pipeline`); the Router block prepends BASE to them via the `base`
 * attribute, and maps the entry URL into that space via `entry` (#365). Anything that targets a URL
 * directly — `route:link` hrefs and programmatic redirects — must carry BASE itself, since those do
 * NOT inherit the base. `routePath()` is the single seam that builds a base-qualified URL, so a
 * reload of e.g. `/demos/loan-origination/pipeline` resolves instead of 404-ing at `/pipeline`.
 */
const BASE = '/demos/loan-origination';
const routePath = (logical: string) => `${BASE}${logical}`;

const MODULES = [
  { path: '/pipeline', label: 'Pipeline' },
  { path: '/application', label: 'Application' },
  { path: '/processing', label: 'Processing' },
  { path: '/underwriting', label: 'Underwriting' },
  { path: '/admin', label: 'Admin' },
];

/** A routed placeholder module — honest about being navigation-only, not a built feature. */
function stubView(title: string): string {
  return `<div class="lo-workspace">
    <div class="page-row"><div><h1>${title}</h1><div class="sub">Routed module</div></div></div>
    <div class="panel"><div class="panel-hd">${title}</div>
      <div class="trace-body"><p class="muted">This module is a routed placeholder in exercise app A — the Router block (client-side navigation) is the Web Everything surface under test this turn, not this module's features. See backlog #317.</p></div>
    </div>
  </div>`;
}

/** The pipeline workspace skeleton — dynamic regions (#pipeline-summary, #pipeline-body, #trace-panel) are filled on route entry. */
function pipelineSkeleton(total: number): string {
  return `<div class="lo-workspace">
    <div class="page-row">
      <div>
        <h1>Loan Pipeline</h1>
        <div class="sub">All applications · rules engine evaluated across the full book · windowed via the pagination block</div>
      </div>
      <div class="toolbar">
        <button class="btn">Filter</button>
        <button class="btn">Saved views</button>
        <button class="btn primary">New application</button>
      </div>
    </div>
    <div id="pipeline-summary"></div>
    <div class="lo-grid">
      <div class="panel">
        <div class="panel-hd">Applications</div>
        <data-table id="pipeline-table" class="pipeline"></data-table>
        <div id="pipeline-pager" class="lo-pager"></div>
      </div>
      <aside id="trace-panel" class="panel"><div class="trace-body"><p class="muted">Select an application to view its underwriting snapshot and proof-of-compliance trace.</p></div></aside>
    </div>
    <div class="lo-substatus muted">Showing <b>50</b> of <b>${total.toLocaleString()}</b> applications · rule set <b>2026.06.0</b></div>
  </div>`;
}

function boot() {
  const root = document.getElementById('app');
  if (!root) return;

  console.time('generate+evaluate 5k');
  const pipeline = generatePipeline(5000);
  const dist = findingDistribution(pipeline);
  console.timeEnd('generate+evaluate 5k');

  const allRows = pipelineRows(pipeline);                         // project the full book once
  const byLoan = new Map(pipeline.map((a) => [a.loanNumber, a])); // selection lookup across pages
  registerDataTable();   // active block: <data-table>
  registerPagination();  // active block: <page-nav> / PaginationBehavior
  registerLifecycle().define('loan', loanLifecycle); // active block: window.customLifecycles['loan']
  registerAudit().define('loan', loanAudit);         // active block: window.customAudit['loan']
  auditLifecycle(loanLifecycle, loanAudit, 'loan');  // headline composition: transitions auto-log

  // Seed an entity's prior history into the audit log the first time it's inspected (idempotent).
  const seedAudit = async (app: Application) => {
    if ((await loanAudit.queryByEntity(app.loanNumber)).length) return;
    for (const e of app.audit) {
      await loanAudit.append({ target: { type: 'loan', id: app.loanNumber }, action: e.action, actor: { role: e.actor }, at: e.at });
    }
  };
  // Render the full master-detail trace for a loan: available moves + proof trace + audit timeline.
  const showTrace = async (app: Application, panel: HTMLElement) => {
    await seedAudit(app);
    const next = await loanLifecycle.available({ id: app.loanNumber, state: app.state }, ACTOR);
    const history = await loanAudit.queryByEntity(app.loanNumber);
    const timeline = auditTimelineHTML(history, { density: 'compact', detail: 'expanded' });
    panel.innerHTML = renderTrace(app, evaluate(app), next, timeline);
  };

  // Entry-URL normalization is handled by the route-view's `entry` attribute (#365) — no hand-rolled
  // `history.replaceState` shim here. Routes are authored logical; `base` qualifies them at match time.
  const templates = [
    `<template route="/pipeline">${pipelineSkeleton(pipeline.length)}</template>`,
    `<template route="/application">${stubView('Application Intake')}</template>`,
    `<template route="/processing">${stubView('Processing')}</template>`,
    `<template route="/underwriting">${stubView('Underwriting')}</template>`,
    `<template route="/admin">${stubView('Admin')}</template>`,
  ].join('');

  root.innerHTML = `
    <div class="lo-topbar">
      <div class="brand"><b>MERIDIAN</b><span>Loan Origination System</span></div>
      <div class="right">
        <span class="env-badge">DEMO</span>
        <span class="user-chip"><span class="av">UW</span> D. Okafor · Underwriter</span>
      </div>
    </div>
    <nav class="lo-tabs">
      ${MODULES.map((m) => `<a route:link="${routePath(m.path)}">${m.label}</a>`).join('')}
    </nav>
    <route-view base="${BASE}" entry="/pipeline">${templates}</route-view>
    <div class="lo-statusbar">
      <span>Rule set <b>2026.06.0</b></span>
      <span class="sep">|</span><span>Environment: <b>DEMO</b></span>
      <span class="sep">|</span><span>Router: shipping block · Exercise app A · backlog #317</span>
    </div>`;

  // Activate the route:link behaviors (the route-view custom element self-upgrades on insertion).
  const attrs = (window as unknown as { attributes?: { upgrade(root: ParentNode): void } }).attributes;
  attrs?.upgrade(document.body);

  // Fill the Applications table + wire master-detail selection — re-run on every entry into /pipeline,
  // since the route-view re-stamps the template each navigation.
  const fillPipeline = () => {
    const summary = document.getElementById('pipeline-summary');
    if (summary) summary.innerHTML = renderSummary(pipeline, dist);
    const table = document.getElementById('pipeline-table') as DataTableElement | null;
    const panel = document.getElementById('trace-panel');
    const pager = document.getElementById('pipeline-pager');
    if (!table || !panel || !pager) return;

    const PAGE_SIZE = 50;
    table.config = { columns: PIPELINE_COLUMNS, sort: { keys: 'single', by: [{ field: 'loan', direction: 'ascending' }] } };
    let md: MasterDetailBehavior | undefined;
    const showPage = (i: number) => { table.rows = allRows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE); md?.refresh(); };
    showPage(0);

    // Master-detail block (active) coordinates the row → trace detail (#356 → master-detail). It COMPOSES
    // the selection block (aria-selected + roving tabindex + click/keyboard) and owns the detail region,
    // focus flow, and empty state — we no longer hand-wire selection → panel. We map the row to its loan
    // via the Loan# cell (the master-detail coordination seam).
    let current: Application | undefined;
    md = new MasterDetailBehavior(table, {
      itemSelector: 'tbody tr',
      detailEl: panel,
      detailLabel: 'Loan detail',
      keyOf: (row) => row.querySelector('td')?.textContent,
      renderDetail: async (loanNumber, el) => {
        const app = byLoan.get(loanNumber);
        if (!app) return;
        current = app;
        await showTrace(app, el);
      },
    });

    // Delegate advance-button clicks: fire a real lifecycle transition (the audit provider, subscribed
    // via auditLifecycle, auto-logs it), reflect the new state on the entity, and re-render the trace.
    // Guard against double-binding — fillPipeline can run more than once on the same stamped panel.
    if (!panel.dataset.lcWired) {
      panel.dataset.lcWired = '1';
      panel.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.lc-advance');
        if (!btn || !current) return;
        const entity = { id: current.loanNumber, state: current.state };
        await loanLifecycle.transition(entity, btn.dataset.to as ApplicationState, ACTOR);
        current.state = entity.state; // reflect the applied move back onto the pipeline entity
        await showTrace(current, panel);
      });
    }

    // Pagination block windows the full 5k book; on page change, re-slice into the data-table.
    new PaginationBehavior(pager, {
      state: { pageIndex: 0, pageSize: PAGE_SIZE, total: allRows.length },
      options: { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' },
      onChange: (s) => showPage(s.pageIndex),
    });
  };

  const routeView = document.querySelector('route-view');
  // `path` is the live, base-qualified pathname (e.g. `/demos/loan-origination/pipeline`), so compare
  // against base-qualified link targets. The bare-base → pipeline redirect is owned by `entry` (#365).
  const onRoute = (path: string) => {
    document.querySelectorAll('.lo-tabs a').forEach((a) =>
      a.classList.toggle('active', a.getAttribute('route:link') === path),
    );
    if (path === routePath('/pipeline')) requestAnimationFrame(fillPipeline);
  };
  routeView?.addEventListener('route-change', (e) => onRoute((e as CustomEvent).detail?.to?.path ?? location.pathname));
  // Initial fill — the route-view stamps the current route on connect; route-change may not fire for it.
  onRoute(location.pathname);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
