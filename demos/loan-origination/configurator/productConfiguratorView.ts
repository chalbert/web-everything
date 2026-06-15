/**
 * Phase S6 — product & rate configurator view (#384).
 *
 * Renders the constraint graph: eligible products as selectable cards, ineligible products dimmed with the
 * exact constraint(s) that excluded them (the "why-not" that makes this a Technical-Configurator decision
 * surface, not a dropdown). Selecting an eligible product + a lock period derives the quote
 * (rate / payment / APR / cash-to-close) and re-renders. Status chips reuse the active **status-indicator**
 * block (platform-first), so eligibility presents in the same vocabulary as the rest of the app.
 */
import { statusIndicatorHTML } from '../../../blocks/renderers/status-indicator/renderStatusIndicator';
import type { Application } from '../domain/types';
import {
  evaluateCatalog,
  configureQuote,
  type LockDays,
  type ProductEligibility,
} from './productConfigurator';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const ratePct = (n: number) => `${(n * 100).toFixed(3)}%`;
const LOCKS: LockDays[] = [30, 45, 60];

interface ConfiguratorState {
  selectedProductId: string | null;
  lockDays: LockDays;
}

export function productConfiguratorSkeleton(): string {
  return `<div class="lo-workspace">
    <div class="page-row"><div>
      <h1>Product & Rate Configurator</h1>
      <div class="sub">Eligibility-filtered catalog · rate-sheet pricing · phase S6 (#384)</div>
    </div></div>
    <div class="lo-grid">
      <div class="panel"><div class="panel-hd">Products (constraint-filtered)</div>
        <div id="cfg-products" class="cfg-products"></div>
      </div>
      <aside class="panel"><div class="panel-hd">Quote</div>
        <div id="cfg-quote" class="cfg-quote"></div>
      </aside>
    </div>
  </div>`;
}

/** Mount the configurator into `host`, pricing against the supplied working `app`. */
export function mountProductConfigurator(host: HTMLElement, app: Application): void {
  const productsEl = host.querySelector<HTMLElement>('#cfg-products');
  const quoteEl = host.querySelector<HTMLElement>('#cfg-quote');
  if (!productsEl || !quoteEl) return;
  const catalog = evaluateCatalog(app);
  const firstEligible = catalog.find((c) => c.eligible)?.product.id ?? null;
  const state: ConfiguratorState = { selectedProductId: firstEligible, lockDays: 30 };

  const render = () => {
    productsEl.innerHTML = catalog.map((c) => productCard(c, state.selectedProductId)).join('');
    quoteEl.innerHTML = quoteHtml(app, state);
  };

  host.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.cfg-card[data-product]:not(.is-ineligible)');
    if (card) {
      state.selectedProductId = card.getAttribute('data-product');
      render();
    }
  });
  host.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('#cfg-lock');
    if (sel) {
      state.lockDays = Number(sel.value) as LockDays;
      render();
    }
  });

  render();
}

function productCard(c: ProductEligibility, selectedId: string | null): string {
  const chip = c.eligible
    ? statusIndicatorHTML({ tone: 'positive', label: 'Eligible' })
    : statusIndicatorHTML({ tone: 'critical', label: 'Ineligible' });
  const why = c.eligible
    ? ''
    : `<ul class="cfg-why">${c.failed.map((f) => `<li>${esc(f.label)}: ${esc(f.detail)}</li>`).join('')}</ul>`;
  return `<div class="cfg-card${c.eligible ? '' : ' is-ineligible'}${c.product.id === selectedId ? ' is-selected' : ''}"
      data-product="${c.product.id}" ${c.eligible ? 'role="button" tabindex="0"' : ''}>
    <div class="cfg-card-hd"><span class="cfg-card-name">${esc(c.product.name)}</span>${chip}</div>
    <div class="cfg-card-meta">${c.product.category.toUpperCase()} · ${c.product.termMonths.map((t) => `${t / 12}yr`).join('/')}</div>
    ${why}
  </div>`;
}

function quoteHtml(app: Application, state: ConfiguratorState): string {
  if (!state.selectedProductId) {
    return `<p class="muted">No eligible product selected. Adjust the application or pick an eligible product.</p>`;
  }
  const q = configureQuote(app, state.selectedProductId, state.lockDays);
  if (!q) return `<p class="muted">Selected product is not priceable.</p>`;
  const lockOpts = LOCKS.map((d) => `<option value="${d}"${d === state.lockDays ? ' selected' : ''}>${d}-day lock</option>`).join('');
  const row = (label: string, value: string, strong = false) =>
    `<div class="cfg-row${strong ? ' strong' : ''}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  return `<label class="wiz-f"><span>Rate lock</span><select id="cfg-lock">${lockOpts}</select></label>
    <dl class="cfg-quote-dl">
      ${row('Note rate', ratePct(q.noteRate), true)}
      ${row('  · LLPA adjustment', `+${ratePct(q.llpaAdjustment)}`)}
      ${row('  · Lock adjustment', `+${ratePct(q.lockAdjustment)}`)}
      ${row('Monthly P&I', money(q.monthlyPrincipalInterest))}
      ${row('Monthly payment (PITI est.)', money(q.monthlyPayment), true)}
      ${row('APR (est.)', ratePct(q.apr))}
      ${row('Cash to close', money(q.cashToClose), true)}
    </dl>
    <p class="cfg-note muted">Rate = base + LLPA (credit/LTV band) + lock. APR & PITI are illustrative — the exercise app drives the standard, it is not a compliant LOS.</p>`;
}
