/**
 * @file blocks/__tests__/unit/wizard/wizard-element.test.ts
 * @description Render test for the reference Flow-Progress Block (#691). Drives a real
 * 3-step linear graph through the native engine and asserts the wizard renders the
 * current position (`aria-current="step"` + "Step N of M"), maps the engine's transitions
 * to per-step status (wait/process/finish/error), and supports back/undo via the
 * instance's `back()` — the demoable claim, proven headlessly under happy-dom.
 */
import { describe, it, expect } from 'vitest';
import { WizardElement, registerWizard } from '../../../wizard/WizardElement';
import type { WorkflowGraph, WorkflowContext } from '../../../workflow-engine/types';

registerWizard();

function signupGraph(context?: WorkflowContext): WorkflowGraph {
  return {
    id: 'signup',
    initial: 'account',
    context,
    steps: {
      account: { on: { NEXT: { target: 'profile' } } },
      profile: { on: { NEXT: { target: 'review' } } },
      review: { type: 'final' },
    },
  };
}

function mount(graph: WorkflowGraph): WizardElement {
  const el = document.createElement('wizard-flow') as WizardElement;
  document.body.append(el);
  el.graph = graph; // set after connect → initializes
  return el;
}

const statusAttrs = (el: WizardElement) =>
  Array.from(el.querySelectorAll('[data-step-indicator]')).map((n) => n.getAttribute('data-step-status'));
const click = (el: WizardElement, sel: string) => el.querySelector<HTMLButtonElement>(sel)!.click();

describe('WizardElement — Flow-Progress Block (#691)', () => {
  it('renders the initial position with aria-current and "Step N of M"', () => {
    const el = mount(signupGraph());
    expect(el.position).toBe('account');
    expect(el.statuses).toEqual(['process', 'wait', 'wait']);
    expect(statusAttrs(el)).toEqual(['process', 'wait', 'wait']);

    const indicators = el.querySelectorAll('[data-step-indicator]');
    expect(indicators[0].getAttribute('aria-current')).toBe('step');
    expect(indicators[1].hasAttribute('aria-current')).toBe(false);

    const panels = el.querySelectorAll<HTMLElement>('[data-step]');
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
    expect(panels[0].getAttribute('aria-current')).toBe('step');

    expect(el.querySelector('.wizard-live')!.textContent).toContain('Step 1 of 3');
  });

  it('advances through the engine: Next maps transitions to per-step status', () => {
    const el = mount(signupGraph());

    click(el, '.wizard-next');
    expect(el.position).toBe('profile');
    expect(el.statuses).toEqual(['finish', 'process', 'wait']);
    expect(el.querySelectorAll('[data-step-indicator]')[1].getAttribute('aria-current')).toBe('step');
    expect(el.querySelector('.wizard-live')!.textContent).toContain('Step 2 of 3');

    click(el, '.wizard-next');
    expect(el.position).toBe('review');
    expect(el.statuses).toEqual(['finish', 'finish', 'process']);
    expect(el.instance!.done).toBe(true);
    // Next is disabled once the flow is complete.
    expect(el.querySelector<HTMLButtonElement>('.wizard-next')!.disabled).toBe(true);
  });

  it('supports back/undo via the engine instance', () => {
    const el = mount(signupGraph());
    // Back is disabled at the first step.
    expect(el.querySelector<HTMLButtonElement>('.wizard-back')!.disabled).toBe(true);

    click(el, '.wizard-next'); // → profile
    expect(el.querySelector<HTMLButtonElement>('.wizard-back')!.disabled).toBe(false);

    click(el, '.wizard-back'); // ← account (instance.back())
    expect(el.position).toBe('account');
    expect(el.statuses).toEqual(['process', 'wait', 'wait']);
    expect(el.querySelector<HTMLButtonElement>('.wizard-back')!.disabled).toBe(true);
  });

  it('surfaces a per-step error from the threaded context', () => {
    const el = mount(signupGraph({ errors: { profile: true } }));
    // `error` overrides the index-based status (profile is ahead but flagged).
    expect(el.statuses).toEqual(['process', 'error', 'wait']);
    expect(statusAttrs(el)[1]).toBe('error');
  });

  it('uses author-supplied labels and per-step template content', () => {
    const el = document.createElement('wizard-flow') as WizardElement;
    el.innerHTML = `<template data-step-id="account"><p class="custom">Your account</p></template>`;
    document.body.append(el);
    el.options = { labels: { account: 'Account', profile: 'Profile', review: 'Review' } };
    el.graph = signupGraph();

    expect(el.querySelector('[data-step-indicator]')!.textContent).toBe('Account');
    expect(el.querySelector('section[data-step-id="account"] .custom')!.textContent).toBe('Your account');
  });
});
