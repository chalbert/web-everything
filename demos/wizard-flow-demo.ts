/**
 * Wizard / Flow Progress Playground (#692, slice B of #651).
 *
 * Mounts the reference wizard Block (`<wizard-flow>`, #691) against a REAL CustomWorkflowEngine graph in
 * the browser — proving the Web Workflows protocol + Flow Progress intent + the Block compose end-to-end.
 * The engine is the source of truth for position/history/completion; the Block renders where you are and
 * each step's status. Native APIs only — no JSX. The same Block + graph are exercised headlessly by the
 * wizard unit suite and the `wizard-flow-demo.spec.ts` e2e, so this demo and CI can't drift.
 */
import { registerWizard, type WizardElement } from '/blocks/wizard/WizardElement';
import type { WorkflowGraph } from '/blocks/workflow-engine/types';
import { setPlaygroundReady } from '/demos/playground-harness';

registerWizard();

// A real 4-step checkout flow: a linear sequence the native engine orchestrates. `review` is the final
// step (no outgoing transition) — reaching it completes the flow and disables Next.
const checkoutGraph: WorkflowGraph = {
  id: 'checkout',
  initial: 'cart',
  steps: {
    cart: { on: { NEXT: { target: 'shipping' } } },
    shipping: { on: { NEXT: { target: 'payment' } } },
    payment: { on: { NEXT: { target: 'review' } } },
    review: { type: 'final' },
  },
};

const LABELS: Record<string, string> = {
  cart: 'Cart',
  shipping: 'Shipping',
  payment: 'Payment',
  review: 'Review',
};

const STEP_CONTENT: Record<string, string> = {
  cart: '<h3>Your cart</h3><p>2 items · $48.00. Review your items before checking out.</p>',
  shipping: '<h3>Shipping address</h3><p>Where should we send it? Standard delivery, 3–5 days.</p>',
  payment: '<h3>Payment</h3><p>Enter your card details. Charged only when the order is placed.</p>',
  review: '<h3>Review &amp; place order</h3><p>Everything look right? Place your order to finish.</p>',
};

function mountWizard(host: HTMLElement): WizardElement {
  const el = document.createElement('wizard-flow') as WizardElement;

  // Author per-step content via <template data-step-id> children — read by the Block on graph init.
  for (const [id, html] of Object.entries(STEP_CONTENT)) {
    const tpl = document.createElement('template');
    tpl.setAttribute('data-step-id', id);
    tpl.innerHTML = html;
    el.append(tpl);
  }

  host.replaceChildren(el);
  el.options = { labels: LABELS };
  el.graph = checkoutGraph; // set after connect → initializes against the engine
  return el;
}

const host = document.getElementById('wizard-host');
if (host) {
  mountWizard(host);
  // One mounted, working wizard rendered live — the demoable claim.
  setPlaygroundReady(1);
}
