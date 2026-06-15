/**
 * Phase S3 wizard — the DOM view + `StepperBehavior` wiring (#381).
 *
 * Renders the URLA sections as `[data-step]` panels (one rendered list of native fields per section),
 * binds inputs to the {@link WizardState} via event delegation, and drives the flow with the WE stepper
 * block. The stepper's `canAdvance` gate runs both layers of validation — native `checkValidity()` on the
 * step's controls + the cross-field {@link validateStep} rules — and blocks advancing while errors remain,
 * surfacing them in a `role="alert"` region (the validation intent's `context: form` display).
 */
import { StepperBehavior } from '../../../blocks/stepper/StepperBehavior';
import type { Application, Declaration } from '../domain/types';
import {
  initialWizardState,
  validateStep,
  ownsOtherRealEstate,
  buildDraftApplication,
  STEP_IDS,
  type StepId,
  type WizardState,
  type ValidationMessage,
} from './applicationWizard';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const STEP_LABEL: Record<StepId, string> = {
  loan: 'Loan & Property',
  borrower: 'Borrower',
  employment: 'Employment & Income',
  finances: 'Assets & Liabilities',
  declarations: 'Declarations',
  demographic: 'Demographic (HMDA)',
};

/** The static shell — the stepper host, indicators, the step panels, and the nav controls. */
export function applicationWizardSkeleton(): string {
  return `<div class="lo-workspace">
    <div class="page-row"><div>
      <h1>Application Intake — Form 1003</h1>
      <div class="sub">Multi-step URLA wizard · Web Everything stepper block · phase S3 (#381)</div>
    </div></div>
    <div class="panel wiz" id="app-wizard">
      <ol class="wiz-steps" aria-label="Application sections">
        ${STEP_IDS.map(
          (id, i) =>
            `<li data-step-indicator class="wiz-step-ind" aria-current="${i === 0 ? 'step' : 'false'}">
              <span class="wiz-step-n">${i + 1}</span>${esc(STEP_LABEL[id])}</li>`,
        ).join('')}
      </ol>
      <div class="wiz-body">
        ${STEP_IDS.map((id, i) => `<section data-step data-step-id="${id}" ${i === 0 ? '' : 'hidden'}></section>`).join('')}
      </div>
      <div class="wiz-msgs" role="alert" aria-live="assertive"></div>
      <div class="wiz-nav">
        <button type="button" class="btn" data-step-prev>← Back</button>
        <button type="button" class="btn primary" data-step-next>Next →</button>
      </div>
    </div>
  </div>`;
}

/**
 * Mount the wizard into `host` (already containing {@link applicationWizardSkeleton}). Wires the field
 * bindings + the stepper, and calls `onComplete` with the assembled draft Application on `flow-complete`.
 */
export function mountApplicationWizard(
  host: HTMLElement,
  onComplete: (app: Application) => void = () => {},
  now: () => Date = () => new Date(),
): StepperBehavior | undefined {
  const wizard = host.querySelector<HTMLElement>('#app-wizard');
  if (!wizard) return undefined;
  const state = initialWizardState();
  const panels = Array.from(wizard.querySelectorAll<HTMLElement>('[data-step]'));
  const msgs = wizard.querySelector<HTMLElement>('.wiz-msgs')!;
  const stepIndexOf = (id: StepId) => STEP_IDS.indexOf(id);

  const renderPanel = (id: StepId) => {
    const el = panels[stepIndexOf(id)];
    if (el) el.innerHTML = panelHtml(id, state);
  };
  STEP_IDS.forEach(renderPanel);

  // Field binding: every control carries data-bind="path"; input/change writes back into state.
  wizard.addEventListener('input', (e) => bindInput(e, state));
  wizard.addEventListener('change', (e) => {
    bindInput(e, state);
    // Re-render conditional/repeating panels whose visibility depends on a just-changed value.
    const t = e.target as HTMLElement;
    if (t.closest('[data-step-id="declarations"]')) renderPanel('declarations');
  });

  // Repeating-section add/remove (employment, assets, liabilities).
  wizard.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-repeat-add],[data-repeat-remove]');
    if (!btn) return;
    const addId = btn.getAttribute('data-repeat-add') as StepId | null;
    if (addId) {
      addRow(state, btn.getAttribute('data-row-kind')!);
      renderPanel(addId);
    } else {
      const stepId = btn.getAttribute('data-step-id') as StepId;
      removeRow(state, btn.getAttribute('data-row-kind')!, Number(btn.getAttribute('data-row-index')));
      renderPanel(stepId);
    }
  });

  const stepper = new StepperBehavior(wizard, {
    stepSelector: '[data-step]',
    indicatorSelector: '[data-step-indicator]',
    progression: 'locked',
    stepLabel: (i) => STEP_LABEL[STEP_IDS[i]],
    canAdvance: (fromIndex) => {
      const id = STEP_IDS[fromIndex];
      const errors = collectErrors(panels[fromIndex], validateStep(id, state));
      msgs.innerHTML = errors.length
        ? `<ul class="wiz-errs">${errors.map((m) => `<li class="wiz-err">${esc(m)}</li>`).join('')}</ul>`
        : '';
      return errors.length === 0;
    },
  });

  // Clear the message banner when a step actually changes; refresh the REO note on entry.
  wizard.addEventListener('step-change', () => {
    msgs.innerHTML = '';
  });
  wizard.addEventListener('flow-complete', () => {
    const app = buildDraftApplication(state, now());
    msgs.innerHTML = '';
    wizard.querySelector('.wiz-body')!.innerHTML = summaryHtml(app, state);
    wizard.querySelector('.wiz-nav')?.setAttribute('hidden', '');
    onComplete(app);
  });

  return stepper;
}

/** Native-validity + cross-field errors for one step, as flat strings (native messages first). */
function collectErrors(panel: HTMLElement | undefined, crossField: ValidationMessage[]): string[] {
  const out: string[] = [];
  if (panel) {
    for (const c of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select, textarea')) {
      if (typeof c.checkValidity === 'function' && !c.checkValidity()) {
        c.setAttribute('aria-invalid', 'true');
        out.push(c.validationMessage || `${c.getAttribute('name') ?? 'A field'} is invalid.`);
      } else {
        c.removeAttribute('aria-invalid');
      }
    }
  }
  for (const m of crossField) if (m.level === 'error') out.push(m.message);
  return out;
}

// ── Field binding ────────────────────────────────────────────────────────────────────────────────

function bindInput(e: Event, state: WizardState): void {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  const path = t.getAttribute?.('data-bind');
  if (!path) return;
  const value =
    t instanceof HTMLInputElement && t.type === 'checkbox'
      ? t.checked
      : t.getAttribute('data-number') !== null
        ? Number(t.value)
        : t.value;
  setByPath(state as unknown as Record<string, unknown>, path, value);
}

/** Set `obj` at a dotted/indexed `path` (e.g. `borrower.addresses.0.city`, `declarations.1.answer`). */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]] as Record<string, unknown>;
    if (cur == null) return;
  }
  cur[parts[parts.length - 1]] = value;
}

function addRow(state: WizardState, kind: string): void {
  if (kind === 'employment')
    state.employment.push({ employerName: '', position: '', monthsOnJob: 0, selfEmployed: false, monthlyIncome: 0 });
  else if (kind === 'asset') state.assets.push({ institution: '', balance: 0 });
  else if (kind === 'liability') state.liabilities.push({ creditor: '', monthlyPayment: 0 });
  else if (kind === 'address')
    state.borrower.addresses.push({ street: '', city: '', state: '', zip: '', monthsAtAddress: 0 });
}

function removeRow(state: WizardState, kind: string, index: number): void {
  if (kind === 'employment' && state.employment.length > 1) state.employment.splice(index, 1);
  else if (kind === 'asset' && state.assets.length > 1) state.assets.splice(index, 1);
  else if (kind === 'liability') state.liabilities.splice(index, 1);
  else if (kind === 'address' && state.borrower.addresses.length > 1) state.borrower.addresses.splice(index, 1);
}

// ── Per-step field rendering ───────────────────────────────────────────────────────────────────────

const field = (label: string, control: string) => `<label class="wiz-f"><span>${esc(label)}</span>${control}</label>`;
const text = (path: string, value: string, attrs = '') =>
  `<input type="text" data-bind="${path}" value="${esc(value)}" ${attrs}>`;
const num = (path: string, value: number, attrs = '') =>
  `<input type="number" data-bind="${path}" data-number value="${value || ''}" ${attrs}>`;

function panelHtml(id: StepId, s: WizardState): string {
  switch (id) {
    case 'loan':
      return `<h3>Loan & Property</h3>
        ${field('Purpose', `<select data-bind="loan.purpose"><option value="purchase"${s.loan.purpose === 'purchase' ? ' selected' : ''}>Purchase</option><option value="refinance"${s.loan.purpose === 'refinance' ? ' selected' : ''}>Refinance</option></select>`)}
        ${field('Loan amount', num('loan.loanAmount', s.loan.loanAmount, 'min="1" required'))}
        ${field('Purchase price', num('loan.purchasePrice', s.loan.purchasePrice, 'min="0"'))}
        ${field('Down payment', num('loan.downPayment', s.loan.downPayment, 'min="0"'))}
        ${field('Property state', text('loan.propertyState', s.loan.propertyState, 'maxlength="2" pattern="[A-Za-z]{2}" placeholder="CA"'))}`;

    case 'borrower':
      return `<h3>Borrower</h3>
        ${field('First name', text('borrower.firstName', s.borrower.firstName, 'required'))}
        ${field('Last name', text('borrower.lastName', s.borrower.lastName, 'required'))}
        ${field('Email', `<input type="email" data-bind="borrower.email" value="${esc(s.borrower.email)}" required>`)}
        ${field('SSN (last 4)', text('borrower.ssnLast4', s.borrower.ssnLast4, 'pattern="\\\\d{4}" maxlength="4" required'))}
        <h4>Address history <span class="wiz-hint">(must cover ≥ 24 months)</span></h4>
        ${s.borrower.addresses
          .map(
            (a, i) => `<fieldset class="wiz-row"><legend>${i === 0 ? 'Current' : `Former ${i}`}</legend>
            ${field('Street', text(`borrower.addresses.${i}.street`, a.street))}
            ${field('City', text(`borrower.addresses.${i}.city`, a.city))}
            ${field('State', text(`borrower.addresses.${i}.state`, a.state, 'maxlength="2"'))}
            ${field('Months here', num(`borrower.addresses.${i}.monthsAtAddress`, a.monthsAtAddress, 'min="0"'))}
            ${i > 0 ? rmBtn('borrower', 'address', i) : ''}</fieldset>`,
          )
          .join('')}
        ${addBtn('borrower', 'address', 'Add former address')}`;

    case 'employment':
      return `<h3>Employment & Income</h3>
        ${s.employment
          .map(
            (e, i) => `<fieldset class="wiz-row"><legend>Employer ${i + 1}</legend>
            ${field('Employer', text(`employment.${i}.employerName`, e.employerName, 'required'))}
            ${field('Position', text(`employment.${i}.position`, e.position))}
            ${field('Months on job', num(`employment.${i}.monthsOnJob`, e.monthsOnJob, 'min="0"'))}
            ${field('Monthly income', num(`employment.${i}.monthlyIncome`, e.monthlyIncome, 'min="0"'))}
            ${field('Self-employed', `<input type="checkbox" data-bind="employment.${i}.selfEmployed"${e.selfEmployed ? ' checked' : ''}>`)}
            ${i > 0 ? rmBtn('employment', 'employment', i) : ''}</fieldset>`,
          )
          .join('')}
        ${addBtn('employment', 'employment', 'Add employer')}`;

    case 'finances':
      return `<h3>Assets & Liabilities</h3>
        <h4>Assets</h4>
        ${s.assets
          .map(
            (a, i) => `<fieldset class="wiz-row"><legend>Account ${i + 1}</legend>
            ${field('Institution', text(`assets.${i}.institution`, a.institution))}
            ${field('Balance', num(`assets.${i}.balance`, a.balance, 'min="0"'))}
            ${i > 0 ? rmBtn('finances', 'asset', i) : ''}</fieldset>`,
          )
          .join('')}
        ${addBtn('finances', 'asset', 'Add account')}
        <h4>Liabilities</h4>
        ${s.liabilities
          .map(
            (l, i) => `<fieldset class="wiz-row"><legend>Liability ${i + 1}</legend>
            ${field('Creditor', text(`liabilities.${i}.creditor`, l.creditor))}
            ${field('Monthly payment', num(`liabilities.${i}.monthlyPayment`, l.monthlyPayment, 'min="0"'))}
            ${rmBtn('finances', 'liability', i)}</fieldset>`,
          )
          .join('')}
        ${addBtn('finances', 'liability', 'Add liability')}`;

    case 'declarations':
      return `<h3>Declarations</h3>
        ${s.declarations.map((d) => declarationHtml(d)).join('')}
        ${ownsOtherRealEstate(s) ? `<p class="wiz-note">You indicated other real estate — the REO schedule will be collected at processing.</p>` : ''}`;

    case 'demographic':
      return `<h3>Demographic information (HMDA)</h3>
        <p class="wiz-hint">Collected for fair-lending monitoring. Optional — never a decisioning input.</p>
        ${field('Decline to provide', `<input type="checkbox" data-bind="demographic.declinedToProvide"${s.demographic.declinedToProvide ? ' checked' : ''}>`)}
        ${field('Sex', `<select data-bind="demographic.sex"><option value="">—</option><option value="female">Female</option><option value="male">Male</option></select>`)}`;

    default:
      return '';
  }
}

function declarationHtml(d: Declaration): string {
  return `<fieldset class="wiz-row"><legend>${esc(d.code)}. ${esc(d.question)}</legend>
    <label class="wiz-f"><span>Yes</span><input type="checkbox" data-bind="declarations.${declIndex(d.code)}.answer"${d.answer ? ' checked' : ''}></label>
    ${d.answer ? field('Explanation', `<textarea data-bind="declarations.${declIndex(d.code)}.explanation">${esc(d.explanation ?? '')}</textarea>`) : ''}</fieldset>`;
}
// Declaration codes are A/B/C in order — index = charCode offset.
const declIndex = (code: string) => code.charCodeAt(0) - 'A'.charCodeAt(0);

const addBtn = (step: StepId, kind: string, label: string) =>
  `<button type="button" class="btn sm" data-repeat-add="${step}" data-row-kind="${kind}">+ ${esc(label)}</button>`;
const rmBtn = (step: StepId, kind: string, index: number) =>
  `<button type="button" class="btn sm ghost" data-repeat-remove data-step-id="${step}" data-row-kind="${kind}" data-row-index="${index}">Remove</button>`;

function summaryHtml(app: Application, s: WizardState): string {
  const b = app.borrowers[0];
  const income = s.employment.reduce((t, e) => t + (Number(e.monthlyIncome) || 0), 0);
  return `<div class="wiz-summary">
    <h3>Application captured ✓</h3>
    <p>A <b>draft</b> 1003 was assembled for <b>${esc(b.firstName)} ${esc(b.lastName)}</b>.</p>
    <dl class="wiz-sum">
      <div><dt>Purpose</dt><dd>${esc(app.loan.purpose)}</dd></div>
      <div><dt>Loan amount</dt><dd>$${app.loan.loanAmount.toLocaleString()}</dd></div>
      <div><dt>Down payment</dt><dd>$${app.loan.downPayment.toLocaleString()}</dd></div>
      <div><dt>Employers</dt><dd>${app.borrowers[0].employment.length}</dd></div>
      <div><dt>Monthly income</dt><dd>$${income.toLocaleString()}</dd></div>
      <div><dt>State</dt><dd>draft (not yet submitted)</dd></div>
    </dl>
  </div>`;
}
