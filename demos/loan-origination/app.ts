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

import { applicationWizardSkeleton, mountApplicationWizard } from './wizard/applicationWizardView';
import { productConfiguratorSkeleton, mountProductConfigurator } from './configurator/productConfiguratorView';
import { generatePipeline } from './domain/seed';
import { evaluate, type EvaluationResult } from './domain/rules';
import { deriveFacts } from './domain/facts';
import { getProduct } from './domain/catalog';
import type { Application, Finding, Disclosure } from './domain/types';
import { registerDataTable, type DataTableElement } from '../../blocks/renderers/data-table/DataTableBehavior';
import type { Row, DataTableConfig } from '../../blocks/renderers/data-table/renderDataTable';
import { PaginationBehavior, registerPagination } from '../../blocks/renderers/pagination/PaginationBehavior';
import { MasterDetailBehavior } from '../../blocks/master-detail/MasterDetailBehavior';
import { DefaultLifecycleProvider, registerLifecycle, type GuardResolver } from '../../blocks/lifecycle/LifecycleProvider';
import { statusIndicatorHTML } from '../../blocks/renderers/status-indicator/renderStatusIndicator';
import type { ApplicationState } from './domain/types';
import { LOAN_LIFECYCLE, FINDING_TONE } from './domain/lifecycle';
import { identitySignal, currentActor, ROLE_LABEL, type LoanRole } from './domain/identity';
import { DefaultAuditProvider, registerAudit, auditLifecycle } from '../../blocks/audit/AuditProvider';
import { auditTimelineHTML } from '../../blocks/renderers/audit-timeline/renderAuditTimeline';
import { decisionTraceHTML } from '../../blocks/renderers/decision-trace/renderDecisionTrace';
import { toDecisionRecord } from './domain/decision';
import {
  generateInitialDisclosures,
  signDisclosure,
  initialPackageSigned,
  tridClock,
  DISCLOSURE_LABEL,
} from './domain/disclosures';
import {
  NotificationStore,
  stateChangeNotification,
  conditionAddedNotification,
  docRejectedNotification,
  type AppNotification,
} from './domain/notifications';
import type { Condition } from './domain/types';
import {
  requiredDocuments,
  uploadDocument,
  acceptDocument,
  rejectDocument,
  openGaps,
  validateUpload,
  DEFAULT_UPLOAD_CONSTRAINTS,
} from './domain/documents';
import type { LoanDocument } from './domain/types';
import {
  clearCondition,
  waiveCondition,
  openConditionCounts,
  DECISION_OUTCOMES,
  suggestedReasonCodes,
  issueDecision,
} from './domain/underwriting';
import { snapshotDraft, applyDraft, reconcile, coEditMessage, type DraftSnapshot } from './domain/drafts';

// Web Lifecycle block (active): the loan's status machine is the data-defined LOAN_LIFECYCLE driving the
// shipping DefaultLifecycleProvider — we no longer hand-roll transitions. The Status Indicator render
// (statusIndicatorHTML) owns every status chip. Registered once at boot as the 'loan' provider.
//
// Phase S2 (#380): the named guards on the definition's edges are now REALLY evaluated against the loan's
// domain state (not the permissive default). Authorization (whether a role may fire an edge) stays the
// provider's actor check; these guards are the *business* preconditions, the Web Guards composition seam.
//   - `meets-eligibility`     → the rules engine has not found the file ineligible (underwriting → approved).
//   - `conditions-cleared`    → every PTD/PTC condition is cleared or waived (approved → clear-to-close).
// The resolver looks the entity up by loan number through `lookupApp`, populated at boot from the pipeline.
let lookupApp: (id: string) => Application | undefined = () => undefined;
const loanGuards: GuardResolver<ApplicationState> = (guard, { entity }) => {
  const app = lookupApp(entity.id);
  if (!app) return false; // unknown entity → deny (safe: a guard never passes without its subject)
  switch (guard) {
    case 'meets-eligibility':
      return evaluate(app).finding !== 'ineligible';
    case 'conditions-cleared':
      return app.conditions.every((c) => c.status === 'cleared' || c.status === 'waived');
    default:
      return false; // unknown guard → deny (the standard's guards are named; an unmapped one is a bug, not a pass)
  }
};
const loanLifecycle = new DefaultLifecycleProvider<ApplicationState>(LOAN_LIFECYCLE, loanGuards);

// Web Audit block (active): the entity's immutable history. The headline composition — auditLifecycle()
// (wired at boot) — subscribes the lifecycle provider so every transition auto-appends one AuditEvent.
// The audit-timeline render owns the history panel. Registered once at boot as the 'loan' provider.
const loanAudit = new DefaultAuditProvider();
// S1a (#686): the acting actor is now read live from the web-identity signal (domain/identity.ts) —
// a real signed-in user (D. Okafor) carrying a role set, switchable via the topbar act-as control —
// instead of the prior hardcoded `{ role: 'underwriter' }`. Re-read on each use so a role switch takes
// effect immediately for both the lifecycle actor check and the audit `actor`.

// Phase S11 (#387): event-driven notifications. PLATFORM-GAP: #358 — the `notification` standard is
// still draft (no shipping runtime), so this in-memory store + the topbar region below hand-roll the
// surface, tagged as the WE gap this app drives. Every state change / condition / doc-rejection routes
// a notification to the relevant actor.
const loanNotifications = new NotificationStore();
let notifOpen = false; // dropdown visibility, honored by renderNotifications across re-renders

const NOTIF_TONE: Record<AppNotification['severity'], 'info' | 'positive' | 'caution' | 'critical'> = {
  info: 'info',
  success: 'positive',
  warning: 'caution',
  error: 'critical',
};

/** The topbar notification bell + dropdown — a hand-rolled stand-in for the draft notification block (#358). */
function renderNotifications(): string {
  const items = loanNotifications.list();
  const unread = loanNotifications.unreadCount();
  const rows = items.length
    ? items
        .map((n) => {
          const chip = statusIndicatorHTML({ label: n.to, tone: NOTIF_TONE[n.severity], shape: 'badge' });
          return `<li class="notif-item${n.read ? '' : ' unread'}"><div class="notif-msg">${n.message}</div><div class="notif-meta">${chip} <span class="muted">· ${new Date(n.at).toLocaleTimeString()}</span></div></li>`;
        })
        .join('')
    : `<li class="notif-empty muted">No notifications yet — advance a loan, add a condition, or reject a document.</li>`;
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

/**
 * The topbar identity chip + act-as role switcher (S1a #686). Renders the signed-in user from
 * the web-identity signal (`identitySignal.state` / `.identity`) — not ad-hoc local session — and
 * a `<select>` to switch the acting role among the user's role set. Switching re-scopes the
 * available lifecycle moves (see the subscriber in fillPipeline).
 */
function renderIdentityChip(): string {
  const u = identitySignal.user;
  const initials = u.label.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const options = u.roles
    .map((r) => `<option value="${r}"${r === u.activeRole ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`)
    .join('');
  return `<span class="user-chip" title="Signed in — web-identity authState: ${identitySignal.state}">
    <span class="av">${initials}</span> ${escHtml(u.label)} ·
    <label class="act-as">Acting as <select id="act-as" aria-label="Act as role">${options}</select></label>
  </span>`;
}

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

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Phase S9 (#386) — the disclosures + e-sign + TRID-clock surface for a loan. Reuses the shipping
 * Status Indicator block for every chip (clock state, per-disclosure state); the e-signature capture,
 * the business-day deadline clock, and the disclosure-package generation are app-side policy with no
 * governing WE standard yet (Layer-2 candidates — see conformance.json). The file cannot advance past
 * submission until the borrower e-signs the initial package (the lifecycle gate this enforces).
 */
function renderDisclosures(app: Application): string {
  const clock = tridClock(app, new Date());
  const signed = initialPackageSigned(app);
  const clockChip = !clock
    ? ''
    : statusIndicatorHTML(
        signed
          ? { label: 'Signed — TRID satisfied', tone: 'positive', shape: 'pill' }
          : clock.overdue
            ? { label: `TRID overdue — due ${shortDate(clock.due)}`, tone: 'critical', shape: 'pill' }
            : { label: `${clock.businessDaysRemaining} business day(s) to sign · due ${shortDate(clock.due)}`, tone: 'caution', shape: 'pill' },
      );

  const rows = app.disclosures
    .map((d: Disclosure) => {
      const chip = d.signedAt
        ? statusIndicatorHTML({ label: `Signed ${shortDate(d.signedAt)}`, tone: 'positive', shape: 'badge' })
        : statusIndicatorHTML({ label: 'Awaiting e-signature', tone: 'caution', shape: 'badge' });
      const signer = d.signedBy ? `<span class="muted"> · ${d.signedBy}</span>` : '';
      return `<div class="cell"><div class="k">${DISCLOSURE_LABEL[d.type]}</div><div class="v">${chip}${signer}</div></div>`;
    })
    .join('');

  const esign = signed
    ? `<p class="muted">Initial package e-signed — the file may advance.</p>`
    : `<form class="disc-esign" autocomplete="off">
        <label class="muted" for="disc-signer">Borrower e-signature (type full legal name)</label>
        <div class="disc-esign-row">
          <input type="text" id="disc-signer" name="signer" placeholder="e.g. ${app.borrowers[0].firstName} ${app.borrowers[0].lastName}" required />
          <button type="submit" class="btn primary">E-sign initial package</button>
        </div>
        <p class="muted">A timestamped audit record is written on signature; advance is gated until then.</p>
      </form>`;

  return `<div class="panel-hd" style="border-radius:3px 3px 0 0">Disclosures &amp; e-sign <span class="muted">· TRID</span></div>
    <div class="trace-body disc-body">
      <p>${clockChip}</p>
      <div class="snapshot">${rows}</div>
      ${esign}
    </div>`;
}

/** One available move + the role the lifecycle permits to fire it (the lifecycle is role-scoped). */
interface Move { to: ApplicationState; actor: string; }

// The moves out of the current state, across ALL permitted roles — each edge's `actor` is surfaced so
// the demo shows WHO advances it (draft→submitted is the borrower's, processing→underwriting the
// processor's), and firing one passes that role to the provider's actor check. Guarded edges only appear
// when their guard passes (meets-eligibility / conditions-cleared), so the gating is visible in the UI.
async function availableMoves(app: Application): Promise<Move[]> {
  const entity = { id: app.loanNumber, state: app.state };
  // S1a (#686): moves are scoped to the signed-in user's *active* role (act-as), not surfaced across
  // all roles — switching the role-switcher changes which lifecycle edges are offered (the demoable).
  const role = identitySignal.activeRole;
  const moves: Move[] = [];
  for (const to of await loanLifecycle.available(entity, { role })) {
    if (!moves.some((m) => m.to === to)) moves.push({ to, actor: role });
  }
  return moves;
}

// Phase S5 (#383): the document checklist is RULES-DRIVEN — derived from the application shape
// (wage-earner → paystub/W-2; self-employed → business returns/P&L; per asset account → a statement;
// gift → gift letter; purchase → purchase agreement). Reconcile each loan's documents to the derived
// set once, lazily, so the seed's placeholder docs are replaced by the rules output.
const docsReconciled = new WeakSet<Application>();
function ensureChecklist(app: Application): void {
  if (docsReconciled.has(app)) return;
  app.documents = requiredDocuments(app);
  docsReconciled.add(app);
}

const DOC_TONE = {
  requested: 'neutral', uploaded: 'info', accepted: 'positive', rejected: 'critical',
} as const;

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Phase S4 (#388): save-and-resume drafts + last-writer-wins co-edit. PLATFORM-GAP: #648 — WE has no
// durable-persistence runtime (per #011 it's an unbuilt facet of webstates), so this is a thin hand-rolled
// localStorage adapter per that future contract. Each tab gets a stable editor token; the loan's working
// state autosaves on every render and resumes on open; a concurrent tab is detected via the storage event.
const EDITOR_TOKEN = Math.random().toString(36).slice(2, 10);
const DRAFT_KEY = (loanNumber: string) => `lo-draft:${loanNumber}`;
function loadDraft(loanNumber: string): DraftSnapshot | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(loanNumber));
    return raw ? (JSON.parse(raw) as DraftSnapshot) : undefined;
  } catch {
    return undefined;
  }
}
function saveDraft(snap: DraftSnapshot): void {
  try {
    localStorage.setItem(DRAFT_KEY(snap.loanNumber), JSON.stringify(snap));
  } catch {
    /* storage quota / disabled — a demo concern only */
  }
}
const draftResumed = new WeakSet<Application>();

/** The rules-driven document checklist panel: per-item state chip, blocking flag, upload, accept/reject. */
function renderDocumentChecklist(app: Application): string {
  const gaps = openGaps(app.documents);
  const rows = app.documents
    .map(
      (d) => `
    <div class="doc-row" data-doc="${d.id}">
      <div class="doc-meta">
        <span class="doc-label">${escHtml(d.label)}</span>
        <span class="doc-flag doc-flag--${d.blocking ? 'blocking' : 'optional'}">${d.blocking ? 'blocking' : 'optional'}</span>
        ${statusIndicatorHTML({ label: d.state, tone: DOC_TONE[d.state], shape: 'pill' })}
        ${d.fileNames.length ? `<span class="doc-files">${d.fileNames.map(escHtml).join(', ')}</span>` : ''}
        ${d.rejectionReason ? `<span class="doc-reason">${escHtml(d.rejectionReason)}</span>` : ''}
      </div>
      <div class="doc-actions">
        ${
          d.state === 'requested' || d.state === 'rejected'
            ? `<label class="doc-upload-btn">Upload…<input type="file" multiple hidden class="doc-file-input" data-doc="${d.id}"></label>`
            : ''
        }
        ${
          d.state === 'uploaded'
            ? `<button type="button" class="doc-accept" data-doc="${d.id}">Accept</button><button type="button" class="doc-reject" data-doc="${d.id}">Reject</button>`
            : ''
        }
      </div>
    </div>`,
    )
    .join('');
  // PLATFORM-GAP: #647 — the WE data-transfer intent (clipboard/DnD/files) has no active runtime block,
  // so this drop-zone hand-rolls the native DataTransfer dragover/drop/paste handlers (wired in the panel
  // listeners below) per the intent's accepts/payload contract. The WE work this S5 phase drives.
  const accept = DEFAULT_UPLOAD_CONSTRAINTS.accept?.join(', ');
  const maxMb = (DEFAULT_UPLOAD_CONSTRAINTS.maxBytes! / 1024 / 1024).toFixed(0);
  const dropzone = `<div class="doc-dropzone" tabindex="0" aria-label="Upload documents — drag and drop, or paste from clipboard">
      Drag &amp; drop files here, or focus this zone and paste from clipboard, to upload to the first open item
      <span class="muted">accepts ${accept} · ≤ ${maxMb} MB</span>
    </div>`;
  return `<div class="panel-hd" style="border-radius:3px 3px 0 0">Document checklist (rules-driven) · ${gaps.blocking} blocking · ${gaps.nonBlocking} optional gaps</div>
    <div class="doc-checklist">${rows}${dropzone}</div>`;
}

// Phase S8 (#385): the underwriter workbench — condition management + formal decisioning, consuming the
// active status-indicator / decision-trace / audit-trail standards (no new gap).
const COND_TONE = { open: 'caution', submitted: 'info', cleared: 'positive', waived: 'neutral' } as const;
const DECISION_TONE = { 'approve-with-conditions': 'positive', suspend: 'caution', decline: 'critical' } as const;
const DECISION_LABEL: Record<'approve-with-conditions' | 'suspend' | 'decline', string> = {
  'approve-with-conditions': 'Approve w/ conditions', suspend: 'Suspend', decline: 'Decline',
};

function renderUnderwriterWorkbench(app: Application, result: EvaluationResult): string {
  const counts = openConditionCounts(app.conditions);
  const openSummary = Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(' · ') || 'none open';
  const condRows = app.conditions.length
    ? app.conditions
        .map(
          (c) => `
      <div class="cond-row" data-cond="${c.id}">
        <span class="cond-type">${c.type}</span>
        <span class="cond-desc">${escHtml(c.description)}</span>
        ${statusIndicatorHTML({ label: c.status, tone: COND_TONE[c.status], shape: 'pill' })}
        ${
          c.status === 'open' || c.status === 'submitted'
            ? `<span class="cond-actions"><button type="button" class="cond-clear" data-cond="${c.id}">Clear</button><button type="button" class="cond-waive" data-cond="${c.id}">Waive</button></span>`
            : ''
        }
      </div>`,
        )
        .join('')
    : '<div class="muted" style="padding:8px 12px">No conditions added.</div>';

  const decided = app.decision;
  const decisionPanel = decided
    ? `<div class="uw-decided">
        ${statusIndicatorHTML({ label: DECISION_LABEL[decided.outcome], tone: DECISION_TONE[decided.outcome], shape: 'badge' })}
        <span class="muted">by ${escHtml(decided.decidedBy)} · ${decided.decidedAt.slice(0, 10)} · rule set ${decided.ruleSetVersion}</span>
        ${decided.reasonCodes.length ? `<div class="uw-reasons">Reason codes: ${decided.reasonCodes.map(escHtml).join(', ')}</div>` : ''}
      </div>`
    : `<form class="uw-decide">
        <label>Decision <select name="outcome" class="uw-outcome">${DECISION_OUTCOMES.map((o) => `<option value="${o}">${DECISION_LABEL[o]}</option>`).join('')}</select></label>
        <label>Reason codes <input name="reasons" placeholder="auto from finding for suspend/decline"></label>
        <button type="submit" class="uw-issue">Issue decision</button>
      </form>`;

  return `<div class="panel-hd" style="border-radius:3px 3px 0 0">Underwriter workbench · finding ${FINDING_LABEL[result.finding]} · conditions: ${openSummary}</div>
    <div class="uw-body">
      <div class="cond-list">${condRows}</div>
      <div class="uw-decision">${decisionPanel}</div>
    </div>`;
}

function renderTrace(
  app: Application,
  result: EvaluationResult,
  available: Move[] = [],
  historyHTML = '',
): string {
  ensureChecklist(app);
  const facts = deriveFacts(app);
  const b = app.borrowers[0];
  // The proof-of-compliance trace is now the decision-trace block (active): the rules-engine result is
  // mapped to the standard DecisionRecord and rendered by renderDecisionTrace (which composes the
  // status-indicator block for the outcome). We no longer hand-roll the trace table.
  const decisionHTML = decisionTraceHTML(toDecisionRecord(app, result, formatFact), { layout: 'table' });
  const cell = (k: string, v: string) => `<div class="cell"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const stateMeta = loanLifecycle.meta(app.state);
  const stateChip = statusIndicatorHTML({ label: stateMeta.label ?? app.state, tone: stateMeta.tone, shape: 'badge' });
  // The available next moves, each labelled with the role the lifecycle permits to fire it (role-scoped,
  // status-indicator `affordance`). Firing one calls loanLifecycle.transition() AS that role; the audit
  // provider (subscribed via auditLifecycle) auto-logs it. Guarded edges only appear when their guard passes.
  const advanceActions = available.length
    ? `<div class="lc-actions"><span class="muted">Advance:</span> ${available
        .map((m) => `<button type="button" class="lc-advance" data-to="${m.to}" data-actor="${m.actor}">${loanLifecycle.meta(m.to).label ?? m.to} <span class="lc-role">(${m.actor})</span></button>`).join(' ')}</div>`
    : '';
  // Phase S11 (#387): events that raise a notification to the relevant actor (condition → assignee,
  // doc rejection → borrower), each also written to the immutable audit trail with before/after.
  const eventActions = `<div class="lc-actions"><span class="muted">Raise event:</span>
    <button type="button" class="act-add-condition">Add PTD condition</button>
    <button type="button" class="act-reject-doc">Reject a document</button></div>`;
  const nextActions = `${advanceActions}${eventActions}`;
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
    ${renderDocumentChecklist(app)}
    ${renderUnderwriterWorkbench(app, result)}
    <div class="panel-hd" style="border-radius:3px 3px 0 0">Audit trail</div>
    ${historyHTML}
    ${renderDisclosures(app)}
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
  { path: '/pricing', label: 'Product & Pricing' },
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
  lookupApp = (id) => byLoan.get(id);                             // S2: let the lifecycle guards read the live entity
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
    // Phase S4 (#388): resume once — restore the exact saved working state (documents / conditions /
    // decision) from a prior session, overriding the freshly-derived checklist. Then autosave below.
    let resumedFrom = '';
    if (!draftResumed.has(app)) {
      ensureChecklist(app); // derive the rules-driven checklist first…
      const saved = loadDraft(app.loanNumber);
      if (saved) { applyDraft(app, saved); resumedFrom = saved.savedAt; } // …a saved draft then overrides
      draftResumed.add(app);
    }
    // Phase S9 (#386): the initial disclosure package is owed on submit. We materialize it the first
    // time the file is inspected (idempotent) and log the generation to the shipping audit trail, so
    // the TRID clock + e-sign gate have something to render against.
    if (!app.disclosures.some((d) => d.type === 'initial-package')) {
      generateInitialDisclosures(app, new Date());
      await loanAudit.append({
        target: { type: 'loan', id: app.loanNumber },
        action: 'disclosures.generated — initial package + Loan Estimate (TRID 3-day clock)',
        actor: { role: 'loan-officer' },
        at: new Date().toISOString(),
      });
    }
    const next = await availableMoves(app);
    const history = await loanAudit.queryByEntity(app.loanNumber);
    const timeline = auditTimelineHTML(history, { density: 'compact', detail: 'expanded' });
    // Phase S4 (#388): the draft banner — a "resumed from…" note and/or an "X also editing" co-edit warning
    // (computed from the stored draft vs this tab's editor token, last-writer-wins).
    const stored = loadDraft(app.loanNumber);
    const here = snapshotDraft(app, EDITOR_TOKEN, new Date().toISOString());
    const coEdit = coEditMessage(here, stored);
    const banner = `${resumedFrom ? `<div class="draft-resumed">Resumed your saved draft (${resumedFrom.slice(0, 16).replace('T', ' ')}).</div>` : ''}${coEdit ? `<div class="draft-coedit">${escHtml(coEdit)}</div>` : ''}`;
    panel.innerHTML = banner + renderTrace(app, evaluate(app), next, timeline);
    // Autosave the current working state — this tab becomes the last writer (last-writer-wins).
    saveDraft(here);
  };

  // Entry-URL normalization is handled by the route-view's `entry` attribute (#365) — no hand-rolled
  // `history.replaceState` shim here. Routes are authored logical; `base` qualifies them at match time.
  const templates = [
    `<template route="/pipeline">${pipelineSkeleton(pipeline.length)}</template>`,
    `<template route="/application">${applicationWizardSkeleton()}</template>`,
    `<template route="/pricing">${productConfiguratorSkeleton()}</template>`,
    `<template route="/processing">${stubView('Processing')}</template>`,
    `<template route="/underwriting">${stubView('Underwriting')}</template>`,
    `<template route="/admin">${stubView('Admin')}</template>`,
  ].join('');

  root.innerHTML = `
    <div class="lo-topbar">
      <div class="brand"><b>MERIDIAN</b><span>Loan Origination System</span></div>
      <div class="right">
        <span id="notif-host"></span>
        <span class="env-badge">DEMO</span>
        <span id="identity-host"></span>
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

  // Phase S11 (#387): mount the notification region and keep it in sync. The store re-renders the bell
  // (badge count) whenever a notification lands; opening the dropdown marks all read.
  const refreshNotifications = () => {
    const host = document.getElementById('notif-host');
    if (host) host.innerHTML = renderNotifications();
  };
  loanNotifications.subscribe(refreshNotifications);
  refreshNotifications();
  document.querySelector('.lo-topbar')?.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.notif-bell')) return;
    notifOpen = !notifOpen;
    if (notifOpen) loanNotifications.markAllRead(); // also triggers refresh
    refreshNotifications();
  });

  // S1a (#686): mount the identity chip + act-as switcher and keep it in sync with the signal.
  const refreshIdentity = () => {
    const host = document.getElementById('identity-host');
    if (host) host.innerHTML = renderIdentityChip();
  };
  identitySignal.subscribe(refreshIdentity);
  refreshIdentity();
  document.querySelector('.lo-topbar')?.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('#act-as');
    if (!sel) return;
    identitySignal.setActiveRole(sel.value as LoanRole); // emits → refreshIdentity + re-scope moves
  });

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

      // S1a (#686): when the act-as role switches, re-paint the open loan's trace so its available
      // moves re-scope to the new role (the demoable — moves change to match who you're acting as).
      identitySignal.subscribe(() => { if (current) void showTrace(current, panel); });

      // Phase S4 (#388): live co-edit — another tab saving this loan's draft fires a `storage` event here.
      // Reconcile last-writer-wins: if the incoming snapshot is newer than ours, adopt it and re-render
      // (the "X also editing" banner shows on the next render). PLATFORM-GAP: #648 (no webstates runtime).
      window.addEventListener('storage', (e) => {
        if (!current || e.key !== DRAFT_KEY(current.loanNumber) || !e.newValue) return;
        const incoming = (() => { try { return JSON.parse(e.newValue!) as DraftSnapshot; } catch { return undefined; } })();
        if (!incoming) return;
        const local = snapshotDraft(current, EDITOR_TOKEN, new Date().toISOString());
        if (reconcile(local, incoming).action === 'adopt') {
          applyDraft(current, incoming);
          void showTrace(current, panel);
        }
      });
      panel.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (!current) return;

        const advance = target.closest<HTMLButtonElement>('button.lc-advance');
        if (advance) {
          const entity = { id: current.loanNumber, state: current.state };
          // Fire AS the role the lifecycle permits for this edge (role-scoped); the provider re-checks
          // both the actor and the guard before applying — the button only existed because both passed.
          await loanLifecycle.transition(entity, advance.dataset.to as ApplicationState, { role: advance.dataset.actor ?? identitySignal.activeRole });
          current.state = entity.state; // reflect the applied move back onto the pipeline entity
          // Phase S11 (#387): the state change raises a notification to the actor who owns the next move
          // (the transition itself is already auto-audited with before/after via auditLifecycle).
          loanNotifications.push(current.loanNumber, stateChangeNotification(current.loanNumber, current.state), new Date().toISOString());
          await showTrace(current, panel);
          return;
        }

        // Phase S11 (#387): add an underwriting condition → notify the assignee + audit (before/after).
        if (target.closest('button.act-add-condition')) {
          const n = current.conditions.length + 1;
          const condition: Condition = { id: `c${n}`, type: 'PTD', description: `Verify updated income docs (#${n})`, assignedTo: 'processor', status: 'open' };
          current.conditions.push(condition);
          const at = new Date().toISOString();
          await loanAudit.append({
            target: { type: 'loan', id: current.loanNumber }, action: `condition.added — ${condition.type}`, actor: currentActor(), at,
            after: [{ path: `/conditions/${condition.id}`, op: 'add', newValue: condition.description }],
          });
          loanNotifications.push(current.loanNumber, conditionAddedNotification(current.loanNumber, condition), at);
          await showTrace(current, panel);
          return;
        }

        // Phase S11 (#387): reject a document → notify the borrower to re-upload + audit (before/after).
        if (target.closest('button.act-reject-doc')) {
          const doc = current.documents.find((d) => d.state !== 'rejected');
          if (!doc) return;
          const before = doc.state;
          doc.state = 'rejected';
          doc.rejectionReason = 'Illegible scan — please re-upload a clear copy';
          const at = new Date().toISOString();
          await loanAudit.append({
            target: { type: 'loan', id: current.loanNumber }, action: `document.rejected — ${doc.label}`, actor: currentActor(), at,
            before: [{ path: `/documents/${doc.id}/state`, op: 'replace', oldValue: before }],
            after: [{ path: `/documents/${doc.id}/state`, op: 'replace', newValue: 'rejected' }],
          });
          loanNotifications.push(current.loanNumber, docRejectedNotification(current.loanNumber, doc), at);
          await showTrace(current, panel);
          return;
        }

        // Phase S5 (#383): accept a checklist document → clears its gap.
        const acceptBtn = target.closest<HTMLButtonElement>('button.doc-accept');
        if (acceptBtn) {
          current.documents = acceptDocument(current.documents, acceptBtn.dataset.doc!);
          await showTrace(current, panel);
          return;
        }

        // Phase S5 (#383): reject a checklist document with a reason → re-opens the request + audits + notifies.
        const rejectBtn = target.closest<HTMLButtonElement>('button.doc-reject');
        if (rejectBtn) {
          const docId = rejectBtn.dataset.doc!;
          current.documents = rejectDocument(current.documents, docId, 'Illegible or incomplete — please re-upload');
          const rd = current.documents.find((d) => d.id === docId);
          if (rd) {
            const at = new Date().toISOString();
            await loanAudit.append({
              target: { type: 'loan', id: current.loanNumber }, action: `document.rejected — ${rd.label}`, actor: currentActor(), at,
              after: [{ path: `/documents/${rd.id}/state`, op: 'replace', newValue: 'rejected' }],
            });
            loanNotifications.push(current.loanNumber, docRejectedNotification(current.loanNumber, rd), at);
          }
          await showTrace(current, panel);
          return;
        }

        // Phase S8 (#385): clear / waive an underwriting condition → audit (before/after).
        const condBtn = target.closest<HTMLButtonElement>('button.cond-clear, button.cond-waive');
        if (condBtn) {
          const condId = condBtn.dataset.cond!;
          const waive = condBtn.classList.contains('cond-waive');
          const before = current.conditions.find((c) => c.id === condId)?.status;
          current.conditions = waive ? waiveCondition(current.conditions, condId) : clearCondition(current.conditions, condId);
          const after = waive ? 'waived' : 'cleared';
          await loanAudit.append({
            target: { type: 'loan', id: current.loanNumber }, action: `condition.${after} — ${condId}`, actor: currentActor(),
            at: new Date().toISOString(),
            before: [{ path: `/conditions/${condId}/status`, op: 'replace', oldValue: before }],
            after: [{ path: `/conditions/${condId}/status`, op: 'replace', newValue: after }],
          });
          await showTrace(current, panel);
          return;
        }
      });

      // Phase S5 (#383): the document upload surface. PLATFORM-GAP: #647 — the WE data-transfer intent
      // (clipboard/DnD/files) has no active runtime block yet, so we hand-roll the native DataTransfer
      // handlers (file-input change, drag-and-drop, clipboard paste) per the intent's accepts/payload
      // contract. validateUpload() enforces the `acceptance` dimension (type/size) client-side.
      const ingestFiles = async (docId: string, files: ReadonlyArray<{ name: string; size: number }>) => {
        if (!current) return;
        const { accepted, rejected } = validateUpload(files);
        if (accepted.length) current.documents = uploadDocument(current.documents, docId, accepted);
        if (rejected.length) {
          current.documents = current.documents.map((d) =>
            d.id === docId && d.state !== 'uploaded'
              ? { ...d, rejectionReason: rejected.map((r) => `${r.fileName}: ${r.reason}`).join('; ') }
              : d);
        }
        await showTrace(current, panel);
      };
      const firstOpenDocId = (): string | undefined =>
        current?.documents.find((d) => d.state === 'requested' || d.state === 'rejected')?.id;

      panel.addEventListener('change', async (e) => {
        const input = (e.target as HTMLElement).closest<HTMLInputElement>('input.doc-file-input');
        if (!input || !input.files) return;
        await ingestFiles(input.dataset.doc!, [...input.files]);
      });
      panel.addEventListener('dragover', (e) => {
        if (!(e.target as HTMLElement).closest('.doc-dropzone')) return;
        e.preventDefault();
        const dt = (e as DragEvent).dataTransfer;
        if (dt) dt.dropEffect = 'copy';
      });
      panel.addEventListener('drop', async (e) => {
        if (!(e.target as HTMLElement).closest('.doc-dropzone')) return;
        e.preventDefault();
        const docId = firstOpenDocId();
        const dt = (e as DragEvent).dataTransfer;
        if (dt && docId) await ingestFiles(docId, [...dt.files]);
      });
      panel.addEventListener('paste', async (e) => {
        if (!(e.target as HTMLElement).closest('.doc-dropzone')) return;
        const data = (e as ClipboardEvent).clipboardData;
        const docId = firstOpenDocId();
        if (data && data.files.length && docId) {
          e.preventDefault();
          await ingestFiles(docId, [...data.files]);
        }
      });

      // Phase S9 (#386): the borrower e-signs the initial disclosure package. On submit we stamp the
      // signature + timestamp on every unsigned disclosure and write an actor-attributed AuditEvent to
      // the shipping audit trail (the timestamped record the TRID flow requires), then re-render so the
      // clock chip flips to "TRID satisfied" and the lifecycle gate opens.
      panel.addEventListener('submit', async (e) => {
        if (!current) return;

        // Phase S8 (#385): the underwriter issues a formal decision → set app.decision (normalized to the
        // active decision-trace standard's record), audit it, and notify. Reason codes auto-seed from the
        // rules-engine finding for a suspend/decline; the underwriter may override in the field.
        const decideForm = (e.target as HTMLElement).closest<HTMLFormElement>('form.uw-decide');
        if (decideForm) {
          e.preventDefault();
          const fd = new FormData(decideForm);
          const outcome = fd.get('outcome')?.toString() as (typeof DECISION_OUTCOMES)[number];
          const result = evaluate(current);
          const typed = (fd.get('reasons')?.toString() ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          const reasonCodes = typed.length ? typed : suggestedReasonCodes(outcome, result);
          const at = new Date();
          current.decision = issueDecision({
            outcome, finding: result.finding, reasonCodes,
            ruleSetVersion: result.ruleSetVersion, decidedBy: currentActor().id, decidedAt: at.toISOString(),
          });
          await loanAudit.append({
            target: { type: 'loan', id: current.loanNumber },
            action: `decision.issued — ${outcome}${current.decision.reasonCodes.length ? ` (${current.decision.reasonCodes.join(', ')})` : ''}`,
            actor: currentActor(), at: at.toISOString(),
            after: [{ path: '/decision/outcome', op: 'add', newValue: outcome }],
          });
          loanNotifications.push(current.loanNumber, stateChangeNotification(current.loanNumber, current.state), at.toISOString());
          await showTrace(current, panel);
          return;
        }

        const form = (e.target as HTMLElement).closest<HTMLFormElement>('form.disc-esign');
        if (!form) return;
        e.preventDefault();
        const signer = new FormData(form).get('signer')?.toString().trim();
        if (!signer) return;
        const at = new Date();
        for (const d of current.disclosures) if (!d.signedAt) signDisclosure(d, signer, at);
        await loanAudit.append({
          target: { type: 'loan', id: current.loanNumber },
          action: 'disclosure.e-signed — initial package (borrower e-signature captured)',
          actor: { role: 'borrower', id: signer },
          at: at.toISOString(),
        });
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
    // Phase S3 (#381): the 1003 application wizard — mount on entry (the route-view re-stamps the
    // template each navigation, so the StepperBehavior + field bindings re-wire here).
    if (path === routePath('/application')) {
      requestAnimationFrame(() => {
        const ws = document.querySelector<HTMLElement>('.lo-workspace');
        if (ws) mountApplicationWizard(ws);
      });
    }
    // Phase S6 (#384): the product & rate configurator — price a representative application from the book.
    if (path === routePath('/pricing')) {
      requestAnimationFrame(() => {
        const ws = document.querySelector<HTMLElement>('.lo-workspace');
        if (ws && pipeline[0]) mountProductConfigurator(ws, pipeline[0]);
      });
    }
  };
  routeView?.addEventListener('route-change', (e) => onRoute((e as CustomEvent).detail?.to?.path ?? location.pathname));
  // Initial fill — the route-view stamps the current route on connect; route-change may not fire for it.
  onRoute(location.pathname);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
