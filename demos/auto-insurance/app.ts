/**
 * Auto-insurance exercise app (B, #318) — S0 foundation harness.
 *
 * Proves the domain core end-to-end AND makes insurance the SECOND consumer of the standards the loan app
 * drove: a seeded book of policies is rated + underwritten (a per-policy decision-trace), rendered through
 * the shipping data-table + pagination + master-detail blocks, with the policy lifecycle (Web Lifecycle),
 * status chips (Status Indicator), the UW decision (Decision Trace), and an audit timeline (Web Audit) in
 * the detail. A cross-app conformance check; later slices add the quote wizard, coverage tree, and claims.
 */

import { registerDataTable, type DataTableElement } from '../../blocks/renderers/data-table/DataTableBehavior';
import type { Row, DataTableConfig } from '../../blocks/renderers/data-table/renderDataTable';
import { PaginationBehavior, registerPagination } from '../../blocks/renderers/pagination/PaginationBehavior';
import { MasterDetailBehavior } from '../../blocks/master-detail/MasterDetailBehavior';
import { DefaultLifecycleProvider, registerLifecycle, type GuardResolver } from '../../blocks/lifecycle/LifecycleProvider';
import { statusIndicatorHTML } from '../../blocks/renderers/status-indicator/renderStatusIndicator';
import { decisionTraceHTML } from '../../blocks/renderers/decision-trace/renderDecisionTrace';
import { DefaultAuditProvider, registerAudit, auditLifecycle } from '../../blocks/audit/AuditProvider';
import { auditTimelineHTML } from '../../blocks/renderers/audit-timeline/renderAuditTimeline';
import { StepperBehavior } from '../../blocks/stepper/StepperBehavior';
import { TreeSelectBehavior, type TreeNode } from '../../blocks/tree-select/TreeSelectBehavior';

import { generateBook } from './domain/seed';
import { generateClaims } from './domain/claims';
import { rate, FINDING_LABEL, FINDING_TONE } from './domain/rating';
import type { Policy, PolicyState, UwFinding, Claim, ClaimState, PaymentMethod, EndorsementChangeId } from './domain/types';
import { POLICY_LIFECYCLE, CLAIM_LIFECYCLE } from './domain/lifecycle';
import { toDecisionRecord } from './domain/decision';
import { collectPayment, paymentReceived, issuePolicyDocuments } from './domain/binding';
import { availableEndorsements, previewEndorsement, applyEndorsement } from './domain/endorsement';
import {
  NotificationStore, policyStateNotification, claimStateNotification, type AppNotification,
} from './domain/notifications';

// The underwriting business guards (S3) — passed to the lifecycle as its GuardResolver, the first real
// exercise of the weblifecycle authorization-delegation seam. Role-scoping is enforced by the lifecycle
// itself (each edge's `actor` must match); these guards add the business rule on top. In production this
// resolver would delegate to the Web Guards CustomGuardProvider (server-authoritative) — PLATFORM-GAP: #289.
const policyFinding = new Map<string, string>(); // policyNumber → UW finding (populated at boot)
const policyRegistry = new Map<string, Policy>(); // policyNumber → Policy, for guards that read entity state (S4 #415)
const uwGuard: GuardResolver<PolicyState> = (guard, ctx) => {
  const finding = policyFinding.get(ctx.entity.id);
  switch (guard) {
    case 'uw-approve': return finding !== 'decline';                    // UW may clear unless a hard decline
    case 'uw-clean': return finding === 'preferred' || finding === 'accept';
    case 'uw-refer': return finding === 'refer' || finding === 'decline';
    case 'payment-received': return paymentReceived(policyRegistry.get(ctx.entity.id)); // S4 (#415): bind gate
    default: return true;                                              // cancel-reason / reinstate
  }
};
const policyLifecycle = new DefaultLifecycleProvider<PolicyState>(POLICY_LIFECYCLE, uwGuard);
const bookAudit = new DefaultAuditProvider();
const ACTOR = { role: 'agent' as const };

// Claim is a SECOND entity machine on the same Web Lifecycle standard (S7) — proving it generalizes
// beyond the policy. The adjuster guard ('coverage-applies') is permissive in the demo; role-scoping is
// enforced by the lifecycle (each claim edge's actor is 'adjuster').
const claimLifecycle = new DefaultLifecycleProvider<ClaimState>(CLAIM_LIFECYCLE, () => true);
const claimAudit = new DefaultAuditProvider();
const ADJUSTER = { role: 'adjuster' as const };
let claimSeq = 0;

// Phase S10 (#421): event-driven notifications. PLATFORM-GAP: #358 — the `notification` standard is still
// draft (no shipping runtime), so this in-memory store + the topbar bell below hand-roll the surface,
// tagged as the WE gap this app drives (the second consumer after loan app A's S11). Policy lifecycle
// changes (bound / referred / …) and claim status changes each raise a notification to the relevant actor.
const notifications = new NotificationStore();
let notifOpen = false; // dropdown visibility, honored across re-renders

const NOTIF_TONE: Record<AppNotification['severity'], 'info' | 'positive' | 'caution' | 'critical'> = {
  info: 'info', success: 'positive', warning: 'caution', error: 'critical',
};

/** The topbar notification bell + dropdown — a hand-rolled stand-in for the draft notification block (#358). */
function renderNotifications(): string {
  const items = notifications.list();
  const unread = notifications.unreadCount();
  const rows = items.length
    ? items.map((n) => {
        const chip = statusIndicatorHTML({ label: n.to, tone: NOTIF_TONE[n.severity], shape: 'badge' });
        return `<li class="notif-item${n.read ? '' : ' unread'}"><div class="notif-msg">${n.message}</div><div class="notif-meta">${chip} <span class="muted">· ${new Date(n.at).toLocaleTimeString()}</span></div></li>`;
      }).join('')
    : `<li class="notif-empty muted">No notifications yet — bind a policy, refer to underwriting, or advance a claim.</li>`;
  return `<div class="notif" data-open="${notifOpen}">
    <button type="button" class="notif-bell" aria-haspopup="true" aria-expanded="${notifOpen}" aria-label="Notifications">
      🔔${unread ? `<span class="notif-badge">${unread}</span>` : ''}
    </button>
    <div class="notif-panel" role="region" aria-label="Notifications"${notifOpen ? '' : ' hidden'}>
      <div class="notif-hd">Notifications</div>
      <ul class="notif-list">${rows}</ul>
    </div>
  </div>`;
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const FINDINGS: UwFinding[] = ['preferred', 'accept', 'refer', 'decline'];

function distribution(book: Policy[]): Map<UwFinding, number> {
  const d = new Map<UwFinding, number>();
  for (const p of book) { const f = rate(p).finding; d.set(f, (d.get(f) ?? 0) + 1); }
  return d;
}

function renderSummary(book: Policy[], dist: Map<UwFinding, number>): string {
  const stats = FINDINGS.map((f) => {
    const chip = statusIndicatorHTML({ label: FINDING_LABEL[f], tone: FINDING_TONE[f], shape: 'pill' });
    return `<div class="stat"><span class="stat-n">${(dist.get(f) ?? 0).toLocaleString()}</span><span class="stat-l">${chip}</span></div>`;
  }).join('');
  return `<div class="stats"><div class="stat"><span class="stat-n">${book.length.toLocaleString()}</span><span class="stat-l">Policies</span></div>${stats}</div>`;
}

const COLUMNS: DataTableConfig['columns'] = [
  { field: 'policy', label: 'Policy #', sortable: true },
  { field: 'insured', label: 'Named insured', sortable: true },
  { field: 'vehicle', label: 'Vehicle', sortable: true },
  { field: 'territory', label: 'Terr.', sortable: true },
  { field: 'premium', label: '6-mo premium', sortable: true },
  { field: 'state', label: 'State', sortable: true },
  { field: 'finding', label: 'UW', sortable: true },
];

function bookRows(book: Policy[]): Row[] {
  return book.map((p) => {
    const v = p.vehicles[0];
    return {
      policy: p.policyNumber,
      insured: `${p.insured.firstName} ${p.insured.lastName}`,
      vehicle: `${v.year} ${v.make} ${v.model}`,
      territory: p.territory,
      premium: rate(p).premium,
      state: p.state,
      finding: FINDING_LABEL[rate(p).finding],
    };
  });
}

function renderDetail(p: Policy): string {
  const r = rate(p);
  const meta = policyLifecycle.meta(p.state);
  const stateChip = statusIndicatorHTML({ label: meta.label ?? p.state, tone: meta.tone, shape: 'badge' });
  const factorRows = r.factors.map((f) =>
    `<tr><td>${f.label}</td><td class="muted">${f.input}</td><td class="num">×${f.multiplier.toFixed(2)}</td></tr>`).join('');
  const decision = decisionTraceHTML(toDecisionRecord(p, r), { layout: 'table', toneFor: (o) => FINDING_TONE[o as UwFinding] ?? 'neutral' });
  return `<div class="detail-body">
    <h3>${p.policyNumber} &middot; ${p.insured.firstName} ${p.insured.lastName}</h3>
    <p class="muted">${stateChip} &middot; ${p.vehicles.map((v) => `${v.year} ${v.make} ${v.model}`).join(', ')}</p>
    <div class="panel-hd">Premium breakdown</div>
    <table class="rate-table">
      <thead><tr><th>Factor</th><th>Input</th><th class="num">Mult.</th></tr></thead>
      <tbody>${factorRows}</tbody>
      <tfoot><tr><td>Base ${money(r.base)}</td><td></td><td class="num"><b>${money(r.premium)}</b></td></tr></tfoot>
    </table>
    <div class="panel-hd">Underwriting decision</div>
    ${decision}
    ${renderBinding(p, r.premium)}
    ${renderEndorsement(p)}
    <div class="panel-hd">Audit trail</div>
    <div id="md-audit"></div>
  </div>`;
}

/**
 * Phase S5 (#416) — the endorsement (mid-term change) surface for an in-force policy. Each offered change
 * is labelled with its prorated premium impact (re-rated remaining term); applying it records an immutable
 * Endorsement, re-issues the documents, and audits the change. The policy state stays in-force — an
 * endorsement is a within-state sub-flow, not a lifecycle transition.
 */
function renderEndorsement(p: Policy): string {
  if (p.state !== 'in-force') return '';
  const now = new Date().toISOString();
  const opts = availableEndorsements(p).map((c) => {
    const pv = previewEndorsement(p, c.id, now);
    const sign = pv.proratedDelta >= 0 ? '+' : '−';
    return `<option value="${c.id}">${c.label} (${sign}${money(Math.abs(pv.proratedDelta))} prorated)</option>`;
  }).join('');
  const history = (p.endorsements ?? []).map((e) => {
    const sign = e.proratedDelta >= 0 ? '+' : '−';
    return `<li><b>${e.endorsementNumber}</b> — ${e.description} · <span class="num">${sign}${money(Math.abs(e.proratedDelta))}</span> <span class="muted">(${Math.round(e.remainingFraction * 100)}% term remaining · new premium ${money(e.newPremium)} · ${FINDING_LABEL[e.finding]})</span></li>`;
  }).join('');
  return `<div class="panel-hd">Endorsements (mid-term change)</div>
    <div class="detail-body endorse-body">
      <p class="muted">Apply a mid-term change (coverage, driver, or garaging address); the remaining term is re-rated and the difference prorated over the unexpired days.</p>
      <form class="endorse-form">
        <select name="changeId" aria-label="Endorsement change">${opts}</select>
        <button type="submit" class="btn primary">Apply endorsement</button>
      </form>
      ${history ? `<div class="panel-hd">Endorsement history</div><ul class="endorse-history">${history}</ul>` : ''}
    </div>`;
}

/**
 * Phase S4 (#415) — the bind / pay / issue surface for a policy, state-driven:
 *   quoted → collect payment + bind (the payment-received guard gates quoted→bound)
 *   bound  → issue (bound→in-force, generating the declarations page + ID cards)
 *   in-force → show the issued documents.
 * Status chips reuse the Status Indicator block; the guarded transitions are Web Lifecycle.
 */
function renderBinding(p: Policy, premium: number): string {
  if (p.state === 'quoted') {
    return `<div class="panel-hd">Bind &amp; issue</div>
      <div class="detail-body bind-body">
        <p class="muted">Collect the 6-month premium (${money(premium)}) to satisfy the <code>payment-received</code> guard and bind.</p>
        <form class="bind-pay">
          <select name="method" aria-label="Payment method">
            <option value="card">Credit card</option>
            <option value="ach">ACH transfer</option>
            <option value="check">Check</option>
          </select>
          <button type="submit" class="btn primary">Collect ${money(premium)} &amp; bind</button>
        </form>
      </div>`;
  }
  if (p.state === 'bound') {
    const pay = p.payment
      ? statusIndicatorHTML({ label: `Paid ${money(p.payment.amount)} · ${p.payment.method.toUpperCase()} · ${p.payment.reference}`, tone: 'positive', shape: 'badge' })
      : '';
    return `<div class="panel-hd">Bind &amp; issue</div>
      <div class="detail-body bind-body">
        <p>${pay}</p>
        <p class="muted">Premium received — issue the policy to generate the declarations page and ID card(s).</p>
        <button type="button" class="btn primary bind-issue">Issue policy</button>
      </div>`;
  }
  if ((p.state === 'in-force' || p.state === 'lapsed' || p.state === 'cancelled' || p.state === 'expired') && p.issued) {
    const cards = p.issued.idCards
      .map((c) => `<div class="id-card"><div class="id-card-hd">Auto ID Card</div>
        <div class="id-card-row"><b>${c.vehicle}</b></div>
        <div class="id-card-row muted">VIN ${c.vin}</div>
        <div class="id-card-row">Policy ${c.policyNumber}</div>
        <div class="id-card-row muted">${c.effective} – ${c.expires}</div></div>`)
      .join('');
    return `<div class="panel-hd">Issued documents</div>
      <div class="detail-body bind-body">
        <p class="muted">Issued ${new Date(p.issued.issuedAt).toLocaleString()}.</p>
        <pre class="dec-page">${p.issued.declarationsPage}</pre>
        <div class="id-cards">${cards}</div>
      </div>`;
  }
  return '';
}

/**
 * Served under a mounted base path (`/demos/auto-insurance/`), not the origin root. Route patterns are
 * logical (`/book`); the Router block prepends BASE via `base` and maps the entry URL via `entry` (#365).
 * Anything that targets a URL directly — `route:link` hrefs and programmatic redirects — must carry BASE
 * itself (the router does NOT base-qualify those). `routePath()` is the single seam, so a reload of e.g.
 * `/demos/auto-insurance/book` resolves instead of 404-ing at `/book`. Mirror of the loan-origination app.
 */
const BASE = '/demos/auto-insurance';
const routePath = (logical: string) => `${BASE}${logical}`;

const MODULES = [
  { path: '/book', label: 'Book' },
  { path: '/quotes', label: 'Quotes' },
  { path: '/underwriting', label: 'Underwriting' },
  { path: '/claims', label: 'Claims' },
];

function stub(title: string): string {
  return `<div class="ai-workspace"><div class="empty-card"><h2>${title}</h2><p class="muted">Slice not built yet — see the <a route:link="${routePath('/book')}">Book</a>.</p></div></div>`;
}

// ── Quote wizard (S1) — the first consumer of the now-active Stepper block (#053) ───────────────────
const STEP_LABELS = ['Driver', 'Vehicle', 'Coverage', 'Review'];
const VEHICLE_OPTIONS: Array<[string, string, number, number]> = [
  ['Toyota', 'Corolla', 8, 22000], ['Honda', 'Civic', 9, 24000], ['Ford', 'F-150', 14, 42000],
  ['Tesla', 'Model 3', 22, 46000], ['BMW', 'M3', 26, 78000], ['Subaru', 'Outback', 12, 31000],
  ['Porsche', '911', 27, 120000], ['Hyundai', 'Elantra', 7, 21000],
];
let quoteSeq = 0;
// The coverage hierarchy (S2) — consumed by the shipping tree-select block (#296). Base liability is
// pre-selected; physical-damage + add-ons are optional. Cascade lets a group toggle its children.
const COVERAGE_TREE: TreeNode[] = [
  { id: 'liability', label: 'Liability', children: [
    { id: 'bi', label: 'Bodily injury', selectable: true },
    { id: 'pd', label: 'Property damage', selectable: true },
  ] },
  { id: 'medical', label: 'Medical', children: [
    { id: 'pip', label: 'PIP / Med-pay', selectable: true },
  ] },
  { id: 'physical', label: 'Physical damage', children: [
    { id: 'collision', label: 'Collision', selectable: true },
    { id: 'comprehensive', label: 'Comprehensive', selectable: true },
  ] },
  { id: 'addons', label: 'Add-ons', children: [
    { id: 'rental', label: 'Rental reimbursement', selectable: true },
    { id: 'roadside', label: 'Roadside', selectable: true },
  ] },
];
const COVERAGE_LABEL: Record<string, string> = {
  bi: 'Bodily injury', pd: 'Property damage', pip: 'PIP/Med-pay', collision: 'Collision',
  comprehensive: 'Comprehensive', rental: 'Rental', roadside: 'Roadside',
};
// PLATFORM-GAP: #096 — the questionnaire's conditional BRANCHING + cross-field eligibility constraints
// (the Technical Configurator / NL-to-config constraint graph) have no codified standard yet; this S1
// flow is linear-only via the Stepper. PLATFORM-GAP: #015 — directional step view-transitions are not
// codified; the Stepper exposes `transition: directional` but defers the animation to Motion/#015.

// The route-view template is a simple shell (like /book's) — the wizard markup is injected by fillQuote
// into #quote-mount. PLATFORM-GAP: #423 — the router's route-view stamps a complex inline form fragment
// as a silent no-op (a simple shell stamps fine), so we follow the idiomatic fill-an-empty-mount pattern.
function quoteSkeleton(): string {
  return `<div class="ai-workspace"><div class="quote-card">
    <h2>New auto quote</h2>
    <p class="muted">A locked-progression wizard on the shipping <b>Stepper</b> block — per-step validation gates each advance, with a <code>Step N of M</code> announcement.</p>
    <div id="quote-mount"></div>
  </div></div>`;
}

function quoteWizardMarkup(): string {
  const vopts = VEHICLE_OPTIONS.map((v, i) => `<option value="${i}">${v[0]} ${v[1]}</option>`).join('');
  return `<div id="quote-wizard" class="stepper">
      <ol class="step-rail">${STEP_LABELS.map((l, i) => `<li data-step-indicator><span class="step-n">${i + 1}</span>${l}</li>`).join('')}</ol>
      <fieldset data-step class="step"><legend>Primary driver</legend>
        <label>First name<input name="firstName" required></label>
        <label>Last name<input name="lastName" required></label>
        <label>Years licensed<input name="licenseYears" type="number" min="0" max="60" required></label>
        <label>At-fault incidents (5y)<input name="incidents" type="number" min="0" max="10" value="0" required></label>
      </fieldset>
      <fieldset data-step class="step" hidden><legend>Vehicle</legend>
        <label>Model year<input name="year" type="number" min="2000" max="2026" required></label>
        <label>Vehicle<select name="vehicle" required>${vopts}</select></label>
        <label>Annual miles<input name="annualMiles" type="number" min="1000" max="40000" value="12000" required></label>
      </fieldset>
      <fieldset data-step class="step" hidden><legend>Coverage</legend>
        <label>Bodily-injury limit<select name="biLimit"><option>50000</option><option>100000</option><option>250000</option></select></label>
        <p class="muted" style="margin:4px 0 0">Select coverages (tree-select block — keyboard: ↑↓ move, →/← expand/collapse, Space toggle):</p>
        <div id="coverage-tree" class="cov-tree"></div>
      </fieldset>
      <fieldset data-step class="step" hidden><legend>Review &amp; quote</legend>
        <div id="quote-summary" class="muted">Review your details, then get your quote.</div>
      </fieldset>
      <div class="step-controls">
        <button type="button" data-step-prev class="btn-ghost">Back</button>
        <button type="button" data-step-next class="btn-primary">Next</button>
      </div>
    </div>
    <div id="quote-live" class="sr-only" aria-live="polite"></div>
    <div id="quote-result"></div>`;
}

const fieldVal = (host: HTMLElement, name: string): string =>
  (host.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';

function buildPolicyFromForm(host: HTMLElement, coverageIds: string[]): Policy {
  const [make, model, symbol, value] = VEHICLE_OPTIONS[Number(fieldVal(host, 'vehicle')) || 0];
  const driver = { firstName: fieldVal(host, 'firstName'), lastName: fieldVal(host, 'lastName'),
    licenseYears: Number(fieldVal(host, 'licenseYears')), incidents: Number(fieldVal(host, 'incidents')) };
  const ids = new Set(coverageIds);
  const coverages: Policy['coverages'] = [];
  if (ids.has('bi')) coverages.push({ id: 'bi', limit: Number(fieldVal(host, 'biLimit')) });
  if (ids.has('pd')) coverages.push({ id: 'pd', limit: 50000 });
  if (ids.has('pip')) coverages.push({ id: 'pip' });
  if (ids.has('collision')) coverages.push({ id: 'collision', deductible: 500 });
  if (ids.has('comprehensive')) coverages.push({ id: 'comprehensive', deductible: 500 });
  if (ids.has('rental')) coverages.push({ id: 'rental' });
  if (ids.has('roadside')) coverages.push({ id: 'roadside' });
  const at = new Date().toISOString();
  return {
    policyNumber: `PA-Q${String(++quoteSeq).padStart(3, '0')}`,
    state: 'quote', insured: driver, drivers: [driver],
    vehicles: [{ year: Number(fieldVal(host, 'year')), make, model, symbol, annualMiles: Number(fieldVal(host, 'annualMiles')), value }],
    coverages, territory: 'T3', priorLapse: false, term: { start: at, months: 6 },
    audit: [{ at, actor: 'agent', action: 'quote.created' }],
  };
}

function reviewSummary(host: HTMLElement, coverageIds: string[]): string {
  const v = VEHICLE_OPTIONS[Number(fieldVal(host, 'vehicle')) || 0];
  const covs = coverageIds.filter((c) => COVERAGE_LABEL[c]).map((c) => COVERAGE_LABEL[c]).join(' · ') || '—';
  return `<ul class="review-list">
    <li><b>Driver:</b> ${fieldVal(host, 'firstName')} ${fieldVal(host, 'lastName')} · ${fieldVal(host, 'licenseYears')} yrs licensed · ${fieldVal(host, 'incidents')} incidents</li>
    <li><b>Vehicle:</b> ${fieldVal(host, 'year')} ${v[0]} ${v[1]} · ${fieldVal(host, 'annualMiles')} mi/yr</li>
    <li><b>Coverage:</b> ${covs}</li>
  </ul>`;
}

function renderQuoteResult(p: Policy, r: ReturnType<typeof rate>): string {
  const chip = statusIndicatorHTML({ label: FINDING_LABEL[r.finding], tone: FINDING_TONE[r.finding], shape: 'pill' });
  const decision = decisionTraceHTML(toDecisionRecord(p, r), { toneFor: (o) => FINDING_TONE[o as UwFinding] ?? 'neutral' });
  return `<div class="quote-result-card"><h3>${money(r.premium)} <span class="per">/ 6&nbsp;mo</span> &nbsp; ${chip}</h3>
    <div class="panel-hd">Underwriting decision</div>${decision}</div>`;
}

function bookSkeleton(total: number): string {
  return `<div class="ai-workspace">
    <div id="book-summary"></div>
    <div class="ai-grid">
      <div class="ai-main">
        <data-table id="book-table"></data-table>
        <div id="book-pager" class="ai-pager"></div>
      </div>
      <aside id="detail-panel" class="ai-detail"></aside>
    </div>
    <div class="ai-substatus muted">Showing <b>50</b> of <b>${total.toLocaleString()}</b> policies · rate set <b>2026.06.0</b></div>
  </div>`;
}

// ── Underwriting workbench (S3) — referred queue, role-scoped guarded decisions ────────────────────
const UW_COLUMNS: DataTableConfig['columns'] = [
  { field: 'policy', label: 'Policy #', sortable: true },
  { field: 'insured', label: 'Named insured', sortable: true },
  { field: 'premium', label: '6-mo premium', sortable: true },
  { field: 'finding', label: 'UW', sortable: true },
];
function uwRows(book: Policy[]): Row[] {
  return book.map((p) => ({ policy: p.policyNumber, insured: `${p.insured.firstName} ${p.insured.lastName}`,
    premium: rate(p).premium, finding: FINDING_LABEL[rate(p).finding] }));
}
function uwSkeleton(total: number): string {
  return `<div class="ai-workspace">
    <h2 style="margin:0 0 4px">Underwriting workbench</h2>
    <p class="muted" style="margin:0 0 14px">Referred risks awaiting a decision. Acting as <b>D. Okafor · Underwriter</b> — role-scoped guarded transitions (the weblifecycle GuardResolver seam).</p>
    <div class="ai-grid">
      <div class="ai-main">
        <data-table id="uw-table"></data-table>
        <div id="uw-pager" class="ai-pager"></div>
      </div>
      <aside id="uw-detail" class="ai-detail"></aside>
    </div>
    <div class="ai-substatus muted"><b>${total.toLocaleString()}</b> referred policies in queue · underwriter view</div>
  </div>`;
}
function renderUwDetail(p: Policy, moves: PolicyState[]): string {
  const r = rate(p);
  const meta = policyLifecycle.meta(p.state);
  const stateChip = statusIndicatorHTML({ label: meta.label ?? p.state, tone: meta.tone, shape: 'badge' });
  const decision = decisionTraceHTML(toDecisionRecord(p, r), { emphasis: 'deciding', toneFor: (o) => FINDING_TONE[o as UwFinding] ?? 'neutral' });
  const ACTION_LABEL: Record<string, string> = { quoted: 'Approve (clear to quote)', cancelled: 'Decline', suspended: 'Suspend' };
  const actions = moves.length
    ? `<div class="uw-actions">${moves.map((m) => `<button type="button" class="uw-act ${m === 'quoted' ? 'approve' : 'decline'}" data-to="${m}">${ACTION_LABEL[m] ?? loanLabel(m)}</button>`).join('')}</div>`
    : `<p class="muted">No actions available to the underwriter from this state.</p>`;
  return `<div class="detail-body">
    <h3>${p.policyNumber} &middot; ${p.insured.firstName} ${p.insured.lastName}</h3>
    <p class="muted">${stateChip} &middot; ${money(r.premium)} / 6&nbsp;mo</p>
    ${actions}
    <div class="panel-hd">Why referred</div>${decision}
    <div class="panel-hd">Audit trail</div><div id="uw-audit"></div>
  </div>`;
}
const loanLabel = (m: PolicyState): string => policyLifecycle.meta(m).label ?? m;

// ── Claims workbench + FNOL (S7) — the claim lifecycle is a SECOND Web Lifecycle entity machine ─────
const CLAIM_COLUMNS: DataTableConfig['columns'] = [
  { field: 'claim', label: 'Claim #', sortable: true },
  { field: 'policy', label: 'Policy #', sortable: true },
  { field: 'loss', label: 'Loss', sortable: true },
  { field: 'reserve', label: 'Reserve', sortable: true },
  { field: 'state', label: 'Status', sortable: true },
];
function claimRows(claims: Claim[]): Row[] {
  return claims.map((c) => ({ claim: c.claimNumber, policy: c.policyNumber, loss: c.lossType,
    reserve: money(c.reserve), state: claimLifecycle.meta(c.state).label ?? c.state }));
}
const LOSS_TYPES = ['collision', 'comprehensive', 'liability', 'theft', 'glass'];
// Shell only (the FNOL <form> trips the route-view stamping bug #423) — fillClaims injects claimsMarkup.
function claimsSkeleton(): string {
  return `<div class="ai-workspace"><div id="claims-mount"></div></div>`;
}
function claimsMarkup(total: number): string {
  return `<div class="fnol-card">
      <h2 style="margin:0 0 2px">File a claim (FNOL)</h2>
      <p class="muted" style="margin:0 0 12px">First notice of loss creates a <b>Claim</b> — a second entity on the Web Lifecycle standard.</p>
      <form id="fnol-form" class="fnol-form">
        <label>Policy #<input name="policyNumber" placeholder="PA-100001" required></label>
        <label>Loss type<select name="lossType" required>${LOSS_TYPES.map((l) => `<option>${l}</option>`).join('')}</select></label>
        <label>Loss date<input name="lossDate" type="date" required></label>
        <label class="wide">What happened?<input name="description" placeholder="Brief description" required></label>
        <label class="wide">Photos / documents <span class="muted">(native file input — richer upload UX is gap #007)</span><input name="photos" type="file" accept="image/*" multiple></label>
        <button type="submit" class="btn-primary">File claim</button>
      </form>
    </div>
    <div class="ai-grid" style="margin-top:18px">
      <div class="ai-main">
        <data-table id="claims-table"></data-table>
        <div id="claims-pager" class="ai-pager"></div>
      </div>
      <aside id="claim-detail" class="ai-detail"></aside>
    </div>
    <div class="ai-substatus muted"><b id="claims-count">${total.toLocaleString()}</b> claims · adjuster view</div>`;
}
function renderClaimDetail(c: Claim, moves: ClaimState[]): string {
  const meta = claimLifecycle.meta(c.state);
  const chip = statusIndicatorHTML({ label: meta.label ?? c.state, tone: meta.tone, shape: 'badge' });
  const CLAIM_ACTION: Record<string, string> = { triage: 'Begin triage', investigating: 'Investigate', approved: 'Approve', denied: 'Deny', paying: 'Issue payment', paid: 'Mark paid', closed: 'Close' };
  const actions = moves.length
    ? `<div class="uw-actions">${moves.map((m) => `<button type="button" class="uw-act ${m === 'denied' ? 'decline' : m === 'approved' || m === 'paid' ? 'approve' : ''}" data-to="${m}">${CLAIM_ACTION[m] ?? m}</button>`).join('')}</div>`
    : `<p class="muted">Claim is closed — no further adjuster actions.</p>`;
  const docs = c.documents.length ? c.documents.map((d) => `<code>${d}</code>`).join(' ') : '<span class="muted">none</span>';
  return `<div class="detail-body">
    <h3>${c.claimNumber} &middot; ${c.lossType}</h3>
    <p class="muted">${chip} &middot; policy ${c.policyNumber} &middot; reserve ${money(c.reserve)}</p>
    ${actions}
    <div class="panel-hd">Loss</div><p style="font-size:13px">${c.description} <span class="muted">(${c.lossDate.slice(0, 10)})</span></p>
    <div class="panel-hd">Documents</div><p style="font-size:12px">${docs}</p>
    <div class="panel-hd">Audit trail</div><div id="claim-audit"></div>
  </div>`;
}

function boot() {
  const root = document.getElementById('app');
  if (!root) return;

  console.time('generate+rate book');
  const book = generateBook(4000);
  const dist = distribution(book);
  book.forEach((p) => { policyFinding.set(p.policyNumber, rate(p).finding); policyRegistry.set(p.policyNumber, p); }); // for the UW + payment GuardResolver
  console.timeEnd('generate+rate book');

  const allRows = bookRows(book);
  const referred = book.filter((p) => p.state === 'referred');
  const byPolicy = new Map(book.map((p) => [p.policyNumber, p]));
  const claims = generateClaims(book);
  const byClaim = new Map(claims.map((c) => [c.claimNumber, c]));
  registerDataTable();
  registerPagination();
  const lcReg = registerLifecycle();
  lcReg.define('policy', policyLifecycle);
  lcReg.define('claim', claimLifecycle); // a second entity machine on the same registry
  const auReg = registerAudit();
  auReg.define('policy', bookAudit);
  auReg.define('claim', claimAudit);
  auditLifecycle(policyLifecycle, bookAudit, 'policy'); // policy transitions auto-log
  auditLifecycle(claimLifecycle, claimAudit, 'claim');  // claim transitions auto-log (same standard)

  const seedAudit = async (p: Policy) => {
    if ((await bookAudit.queryByEntity(p.policyNumber)).length) return;
    for (const e of p.audit) await bookAudit.append({ target: { type: 'policy', id: p.policyNumber }, action: e.action, actor: { role: e.actor }, at: e.at });
  };
  const seedClaimAudit = async (c: Claim) => {
    if ((await claimAudit.queryByEntity(c.claimNumber)).length) return;
    for (const e of c.audit) await claimAudit.append({ target: { type: 'claim', id: c.claimNumber }, action: e.action, actor: { role: e.actor }, at: e.at });
  };

  // Entry-URL normalization is handled by the route-view's `entry` attribute (#365) — no hand-rolled shim.
  const templates = [
    `<template route="/book">${bookSkeleton(book.length)}</template>`,
    `<template route="/quotes">${quoteSkeleton()}</template>`,
    `<template route="/underwriting">${uwSkeleton(referred.length)}</template>`,
    `<template route="/claims">${claimsSkeleton()}</template>`,
  ].join('');

  root.innerHTML = `
    <div class="ai-topbar">
      <div class="brand"><span class="logo">◆</span> <b>Beacon</b> <span>Auto Insurance</span></div>
      <div class="right"><span class="env">DEMO</span><span id="ai-notif"></span><span class="user"><span class="av">AG</span> R. Lindqvist · Agent</span></div>
    </div>
    <nav class="ai-tabs">${MODULES.map((m) => `<a route:link="${routePath(m.path)}">${m.label}</a>`).join('')}</nav>
    <route-view base="${BASE}" entry="/book">${templates}</route-view>
    <div class="ai-statusbar"><span>Rate set <b>2026.06.0</b></span><span class="sep">·</span><span>Exercise app B · backlog #318 · second consumer of the loan-app standards</span></div>`;

  const attrs = (window as unknown as { attributes?: { upgrade(root: ParentNode): void } }).attributes;
  attrs?.upgrade(document.body);

  // S10 (#421): keep the topbar bell in sync, and toggle the dropdown (marking read on open).
  const notifMount = document.getElementById('ai-notif');
  const refreshNotif = () => { if (notifMount) notifMount.innerHTML = renderNotifications(); };
  notifications.subscribe(refreshNotif);
  refreshNotif();
  notifMount?.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.notif-bell')) return;
    notifOpen = !notifOpen;
    if (notifOpen) notifications.markAllRead();
    refreshNotif();
  });
  const notify = (kind: 'policy' | 'claim', ref: string, draft: ReturnType<typeof policyStateNotification>) =>
    notifications.push(kind, ref, draft, new Date().toISOString());

  const fillBook = () => {
    const summary = document.getElementById('book-summary');
    if (summary) summary.innerHTML = renderSummary(book, dist);
    const table = document.getElementById('book-table') as DataTableElement | null;
    const panel = document.getElementById('detail-panel');
    const pager = document.getElementById('book-pager');
    if (!table || !panel || !pager) return;

    const PAGE_SIZE = 50;
    table.config = { columns: COLUMNS, sort: { keys: 'single', by: [{ field: 'policy', direction: 'ascending' }] } };
    let md: MasterDetailBehavior | undefined;
    const showPage = (i: number) => { table.rows = allRows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE); md?.refresh(); };
    showPage(0);

    // Master-detail block coordinates row → detail; it composes the selection block. On select we render
    // the policy detail (premium + UW decision-trace + status), the bind/issue surface, and the audit timeline.
    let current: Policy | undefined;
    const showPolicy = async (p: Policy, el: HTMLElement) => {
      current = p;
      el.innerHTML = renderDetail(p);
      await seedAudit(p);
      const audit = el.querySelector('#md-audit');
      if (audit) audit.innerHTML = auditTimelineHTML(await bookAudit.queryByEntity(p.policyNumber), { density: 'compact', detail: 'expanded' });
    };
    md = new MasterDetailBehavior(table, {
      itemSelector: 'tbody tr',
      detailEl: panel,
      detailLabel: 'Policy detail',
      keyOf: (row) => row.querySelector('td')?.textContent,
      renderDetail: async (policyNumber, el) => {
        const p = byPolicy.get(policyNumber);
        if (p) await showPolicy(p, el);
      },
    });

    // Phase S4 (#415): bind / pay / issue. Collecting payment then firing the guarded quoted→bound
    // transition (the payment-received guard now passes), and issuing fires bound→in-force and generates
    // the declarations page + ID cards. Both transitions auto-audit via auditLifecycle; we add the
    // payment + issuance events. Guard against double-binding on a re-stamped panel.
    if (!panel.dataset.biWired) {
      panel.dataset.biWired = '1';
      const at = () => new Date().toISOString();
      panel.addEventListener('submit', async (e) => {
        const target = e.target as HTMLElement;
        // S5 (#416): apply a mid-term endorsement on an in-force policy — re-rate + prorate, record, re-issue.
        const endorseForm = target.closest<HTMLFormElement>('form.endorse-form');
        if (endorseForm && current) {
          e.preventDefault();
          const changeId = new FormData(endorseForm).get('changeId') as EndorsementChangeId | null;
          if (!changeId) return;
          const endorsement = applyEndorsement(current, changeId, at(), ACTOR.role);
          const sign = endorsement.proratedDelta >= 0 ? '+' : '−';
          await bookAudit.append({ target: { type: 'policy', id: current.policyNumber }, action: `endorsement.applied — ${endorsement.endorsementNumber}: ${endorsement.description} (${sign}${money(Math.abs(endorsement.proratedDelta))} prorated)`, actor: ACTOR, at: endorsement.at });
          await showPolicy(current, panel);
          return;
        }
        const form = target.closest<HTMLFormElement>('form.bind-pay');
        if (!form || !current) return;
        e.preventDefault();
        const method = (new FormData(form).get('method') as PaymentMethod) ?? 'card';
        const premium = rate(current).premium;
        const payment = collectPayment(current, method, premium, at());
        await bookAudit.append({ target: { type: 'policy', id: current.policyNumber }, action: `payment.collected — ${money(payment.amount)} (${method})`, actor: ACTOR, at: payment.collectedAt });
        const entity = { id: current.policyNumber, state: current.state };
        await policyLifecycle.transition(entity, 'bound', ACTOR); // guard now satisfied
        current.state = entity.state;
        notify('policy', current.policyNumber, policyStateNotification(current.policyNumber, 'bound')); // S10 (#421)
        await showPolicy(current, panel);
      });
      panel.addEventListener('click', async (e) => {
        if (!(e.target as HTMLElement).closest('button.bind-issue') || !current) return;
        const entity = { id: current.policyNumber, state: current.state };
        await policyLifecycle.transition(entity, 'in-force', ACTOR);
        current.state = entity.state;
        const docs = issuePolicyDocuments(current, rate(current).premium, at());
        await bookAudit.append({ target: { type: 'policy', id: current.policyNumber }, action: `policy.issued — declarations + ${docs.idCards.length} ID card(s)`, actor: ACTOR, at: docs.issuedAt });
        notify('policy', current.policyNumber, policyStateNotification(current.policyNumber, 'in-force')); // S10 (#421)
        await showPolicy(current, panel);
      });
    }

    new PaginationBehavior(pager, {
      state: { pageIndex: 0, pageSize: PAGE_SIZE, total: allRows.length },
      options: { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' },
      onChange: (s) => showPage(s.pageIndex),
    });
  };

  // Underwriting workbench (S3): the referred queue → role-scoped guarded decisions. Approve/Decline fire
  // real lifecycle transitions as the UNDERWRITER actor; an agent role would be rejected by the lifecycle
  // (edge.actor match) and the uwGuard business rule — the first exercise of the weblifecycle guard seam.
  const UW = { role: 'underwriter' as const };
  const fillUnderwriting = () => {
    const table = document.getElementById('uw-table') as DataTableElement | null;
    const panel = document.getElementById('uw-detail');
    const pager = document.getElementById('uw-pager');
    if (!table || !panel || !pager) return;
    const uwAll = uwRows(referred);
    const PAGE_SIZE = 50;
    table.config = { columns: UW_COLUMNS, sort: { keys: 'single', by: [{ field: 'policy', direction: 'ascending' }] } };
    let md: MasterDetailBehavior | undefined;
    let current: Policy | undefined;
    const showPage = (i: number) => { table.rows = uwAll.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE); md?.refresh(); };
    showPage(0);
    const renderInto = async (p: Policy, el: HTMLElement) => {
      current = p;
      const moves = await policyLifecycle.available({ id: p.policyNumber, state: p.state }, UW);
      el.innerHTML = renderUwDetail(p, moves);
      await seedAudit(p);
      const audit = el.querySelector('#uw-audit');
      if (audit) audit.innerHTML = auditTimelineHTML(await bookAudit.queryByEntity(p.policyNumber), { density: 'compact', detail: 'expanded' });
    };
    md = new MasterDetailBehavior(table, {
      itemSelector: 'tbody tr', detailEl: panel, detailLabel: 'Referred policy',
      keyOf: (row) => row.querySelector('td')?.textContent,
      renderDetail: (policyNumber, el) => { const p = byPolicy.get(policyNumber); if (p) return renderInto(p, el); },
    });
    if (!panel.dataset.uwWired) {
      panel.dataset.uwWired = '1';
      panel.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.uw-act');
        if (!btn || !current) return;
        await policyLifecycle.transition({ id: current.policyNumber, state: current.state }, btn.dataset.to as PolicyState, UW);
        current.state = btn.dataset.to as PolicyState; // reflect the decision
        notify('policy', current.policyNumber, policyStateNotification(current.policyNumber, current.state)); // S10 (#421)
        await renderInto(current, panel);
      });
    }
    new PaginationBehavior(pager, {
      state: { pageIndex: 0, pageSize: PAGE_SIZE, total: uwAll.length },
      options: { mode: 'paged', advance: 'manual', urlSync: 'none', rangeLabel: 'range' },
      onChange: (s) => showPage(s.pageIndex),
    });
  };

  // Claims workbench + FNOL (S7): the claim lifecycle is a SECOND Web Lifecycle entity machine. The
  // adjuster's guarded transitions and the FNOL "file a claim" form both run the standard for claims.
  const fillClaims = () => {
    const mount = document.getElementById('claims-mount');
    if (!mount) return;
    mount.innerHTML = claimsMarkup(claims.length); // inject (route-view can't stamp the FNOL form — #423)
    const table = document.getElementById('claims-table') as DataTableElement | null;
    const panel = document.getElementById('claim-detail');
    const pager = document.getElementById('claims-pager');
    const form = document.getElementById('fnol-form') as HTMLFormElement | null;
    if (!table || !panel || !pager) return;
    const PAGE_SIZE = 50;
    let rows = claimRows(claims);
    table.config = { columns: CLAIM_COLUMNS, sort: { keys: 'single', by: [{ field: 'claim', direction: 'descending' }] } };
    let md: MasterDetailBehavior | undefined;
    let current: Claim | undefined;
    let page = 0;
    const showPage = (i: number) => { page = i; table.rows = rows.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE); md?.refresh(); };
    showPage(0);
    const renderInto = async (c: Claim, el: HTMLElement) => {
      current = c;
      const moves = await claimLifecycle.available({ id: c.claimNumber, state: c.state }, ADJUSTER);
      el.innerHTML = renderClaimDetail(c, moves);
      await seedClaimAudit(c);
      const audit = el.querySelector('#claim-audit');
      if (audit) audit.innerHTML = auditTimelineHTML(await claimAudit.queryByEntity(c.claimNumber), { density: 'compact', detail: 'expanded' });
    };
    md = new MasterDetailBehavior(table, {
      itemSelector: 'tbody tr', detailEl: panel, detailLabel: 'Claim',
      keyOf: (row) => row.querySelector('td')?.textContent,
      renderDetail: (claimNumber, el) => { const c = byClaim.get(claimNumber); if (c) return renderInto(c, el); },
    });
    if (!panel.dataset.clWired) {
      panel.dataset.clWired = '1';
      panel.addEventListener('click', async (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.uw-act');
        if (!btn || !current) return;
        await claimLifecycle.transition({ id: current.claimNumber, state: current.state }, btn.dataset.to as ClaimState, ADJUSTER);
        current.state = btn.dataset.to as ClaimState;
        notify('claim', current.claimNumber, claimStateNotification(current.claimNumber, current.state)); // S10 (#421)
        await renderInto(current, panel);
      });
    }
    // FNOL: file a new claim (native file input — the richer upload UX is gap #007).
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const files = (form.querySelector('[name="photos"]') as HTMLInputElement | null)?.files;
      const at = new Date().toISOString();
      const claim: Claim = {
        claimNumber: `CLM-NEW${String(++claimSeq).padStart(2, '0')}`,
        policyNumber: String(fd.get('policyNumber') || ''),
        state: 'fnol',
        lossType: (String(fd.get('lossType')) as Claim['lossType']) || 'collision',
        lossDate: String(fd.get('lossDate') || at.slice(0, 10)),
        description: String(fd.get('description') || ''),
        reserve: 0,
        documents: files ? [...files].map((f) => f.name) : [],
        audit: [{ at, actor: 'policyholder', action: 'fnol.filed' }],
      };
      claims.unshift(claim);
      byClaim.set(claim.claimNumber, claim);
      rows = claimRows(claims);
      const count = document.getElementById('claims-count');
      if (count) count.textContent = claims.length.toLocaleString();
      form.reset();
      showPage(0);
      void renderInto(claim, panel);
    });
  };

  // Quote wizard (S1): the Stepper block drives a locked, per-step-validated flow. flow-complete rates
  // the assembled policy and renders the premium + underwriting decision-trace.
  const fillQuote = () => {
    const mount = document.getElementById('quote-mount');
    if (!mount) return;
    mount.innerHTML = quoteWizardMarkup();
    const host = document.getElementById('quote-wizard');
    if (!host) return;
    // Coverage builder (S2): the shipping tree-select block renders the coverage hierarchy.
    const covHost = host.querySelector<HTMLElement>('#coverage-tree');
    const coverageTree = covHost
      ? new TreeSelectBehavior(covHost, COVERAGE_TREE, { model: 'multiple', cascade: true, defaultExpanded: true })
      : null;
    coverageTree?.setSelected(['bi', 'pd']); // base liability pre-selected
    const coverageIds = () => coverageTree?.getSelected() ?? ['bi', 'pd'];
    const live = document.getElementById('quote-live') ?? undefined;
    const result = document.getElementById('quote-result');
    const summary = host.querySelector('#quote-summary');
    const nextBtn = host.querySelector<HTMLButtonElement>('[data-step-next]');
    const stepFs = (i: number) => host.querySelectorAll<HTMLFieldSetElement>('[data-step]')[i];
    new StepperBehavior(host, {
      liveRegion: live as HTMLElement | undefined,
      stepLabel: (i) => STEP_LABELS[i],
      // withStepValidation: a <fieldset> is barred from constraint validation (its own checkValidity is
      // always true), so gate on the step's child controls and report the first invalid one.
      canAdvance: (i) => {
        const invalid = [...stepFs(i).querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select,textarea')]
          .find((c) => !c.checkValidity());
        if (invalid) { invalid.reportValidity(); return false; }
        return true;
      },
    });
    host.addEventListener('step-change', (e) => {
      const to = (e as CustomEvent).detail.to as number;
      if (to === 3 && summary) summary.innerHTML = reviewSummary(host, coverageIds());
      if (nextBtn) nextBtn.textContent = to === 3 ? 'Get quote' : 'Next';
    });
    host.addEventListener('flow-complete', () => {
      const p = buildPolicyFromForm(host, coverageIds());
      if (result) result.innerHTML = renderQuoteResult(p, rate(p));
    });
  };

  const routeView = document.querySelector('route-view');
  // `path` is the live, base-qualified pathname; compare against base-qualified link targets. The
  // bare-base → /book redirect is owned by the route-view `entry` attribute (#365).
  const onRoute = (path: string) => {
    document.querySelectorAll('.ai-tabs a').forEach((a) => a.classList.toggle('active', a.getAttribute('route:link') === path));
    if (path === routePath('/book')) requestAnimationFrame(fillBook);
    if (path === routePath('/quotes')) requestAnimationFrame(fillQuote);
    if (path === routePath('/underwriting')) requestAnimationFrame(fillUnderwriting);
    if (path === routePath('/claims')) requestAnimationFrame(fillClaims);
  };
  routeView?.addEventListener('route-change', (e) => onRoute((e as CustomEvent).detail?.to?.path ?? location.pathname));
  onRoute(location.pathname);
}

boot();
