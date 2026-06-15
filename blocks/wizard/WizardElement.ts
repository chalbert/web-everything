/**
 * WizardElement — the reference Flow-Progress Block (#691, slice A of #651).
 *
 * A `<wizard-flow>` custom element that wires a portable {@link WorkflowGraph} through the
 * swappable `customWorkflowEngine` (#634/#650) into the Flow-Progress UX (intent
 * `flow-progress`, register `wizard`). It owns no orchestration — transitions, guards,
 * and completion live on the engine; the element renders **where you are** and **each
 * step's status**, the UX member of the Web Workflows protocol.
 *
 * Composition (reuse, don't reinvent — per the flow-progress intent):
 *  - {@link StepperBehavior} provides the linear-presentation mechanics it already owns:
 *    `aria-current="step"`, the "Step N of M" live announcement, and one-panel-at-a-time
 *    switching. It runs in `free` progression here because the **engine** is the source of
 *    truth for position — the stepper reflects the engine, it does not gate it.
 *  - The engine's `onTransition` is mapped to per-step status (`wait` / `process` / `finish`
 *    / `error`) — the flow-progress `stepStatus` axis.
 *  - Back/undo uses the running instance's `back()` (the engine's history), the
 *    `movement: back-allowed` default.
 *
 * Droppable on any page: set `.graph` (and optionally `.options`); author per-step content
 * with `<template data-step-id="…">` children. Proven by its unit/render test.
 */
import { StepperBehavior } from '../stepper/StepperBehavior';
import { customWorkflowEngine } from '../workflow-engine/registry';
import type {
  WorkflowGraph,
  WorkflowInstance,
  WorkflowContext,
  StepTransitionDetail,
} from '../workflow-engine/types';

/** The flow-progress `stepStatus` enum. */
export type StepStatus = 'wait' | 'process' | 'finish' | 'error';

export interface WizardOptions {
  /** Named engine to resolve from `customWorkflowEngine`; omitted = native-first default. */
  engine?: string;
  /** Event type sent to the engine when Next is pressed (default `NEXT`). */
  nextEvent?: string;
  /** Human label per step id (falls back to the step id). */
  labels?: Record<string, string>;
}

/** Read `context.errors[stepId]` (truthy → that step is in `error`). */
function stepHasError(context: WorkflowContext | undefined, stepId: string): boolean {
  const errors = context?.errors as Record<string, unknown> | undefined;
  return !!(errors && errors[stepId]);
}

export class WizardElement extends HTMLElement {
  #graph: WorkflowGraph | null = null;
  #options: WizardOptions = {};
  #connected = false;

  #instance: WorkflowInstance | null = null;
  #stepper: StepperBehavior | null = null;
  #order: string[] = [];
  #disposers: Array<() => void> = [];

  /** The orchestration graph. Setting it (re)initializes the wizard. */
  set graph(graph: WorkflowGraph | null) {
    this.#graph = graph;
    this.#init();
  }
  get graph(): WorkflowGraph | null {
    return this.#graph;
  }

  set options(options: WizardOptions) {
    this.#options = options ?? {};
    this.#init();
  }
  get options(): WizardOptions {
    return this.#options;
  }

  /** The running engine instance (read-only access for hosts/tests). */
  get instance(): WorkflowInstance | null {
    return this.#instance;
  }

  /** The active step id (engine position). */
  get position(): string {
    return this.#instance?.position ?? '';
  }

  /** Per-step status in graph order — the flow-progress `stepStatus` projection. */
  get statuses(): StepStatus[] {
    const currentIndex = this.#order.indexOf(this.position);
    const ctx = this.#instance?.context;
    return this.#order.map((id, i) => {
      if (stepHasError(ctx, id)) return 'error';
      if (i < currentIndex) return 'finish';
      if (i === currentIndex) return 'process';
      return 'wait';
    });
  }

  connectedCallback(): void {
    this.#connected = true;
    this.#init();
  }

  disconnectedCallback(): void {
    this.#teardown();
    this.#connected = false;
  }

  // --- Lifecycle ------------------------------------------------------------

  #init(): void {
    if (!this.#connected || !this.#graph) return;
    this.#teardown();

    const graph = this.#graph;
    this.#order = Object.keys(graph.steps);

    // Capture any author-supplied per-step content before we render the scaffold.
    const authored = new Map<string, DocumentFragment>();
    this.querySelectorAll<HTMLTemplateElement>('template[data-step-id]').forEach((tpl) => {
      const id = tpl.getAttribute('data-step-id');
      if (id) authored.set(id, tpl.content.cloneNode(true) as DocumentFragment);
    });

    this.#renderScaffold(authored);

    // The engine is the source of truth; the stepper reflects it (free progression).
    const engine = customWorkflowEngine.resolve(this.#options.engine);
    this.#instance = engine.start(graph);

    const liveRegion = this.querySelector<HTMLElement>('.wizard-live') ?? undefined;
    this.#stepper = new StepperBehavior(this, {
      stepSelector: '[data-step]',
      indicatorSelector: '[data-step-indicator]',
      progression: 'free',
      liveRegion,
      stepLabel: (i) => this.#labelFor(this.#order[i]),
    });

    // Drive the engine from the controls (NOT the stepper — it only presents).
    const next = this.querySelector<HTMLButtonElement>('.wizard-next');
    const back = this.querySelector<HTMLButtonElement>('.wizard-back');
    const onNext = () => this.#instance?.send(this.#options.nextEvent ?? 'NEXT');
    const onBack = () => this.#instance?.back();
    next?.addEventListener('click', onNext);
    back?.addEventListener('click', onBack);
    this.#disposers.push(() => next?.removeEventListener('click', onNext));
    this.#disposers.push(() => back?.removeEventListener('click', onBack));

    // Reflect every engine move into the presentation + status.
    this.#disposers.push(
      this.#instance.onTransition((d) => this.#onMove(d)),
      this.#instance.onComplete(() => this.#refreshControls()),
    );

    // Land on the engine's initial position and paint the first status pass.
    this.#stepper.goTo(this.#order.indexOf(this.#instance.position));
    this.#refreshStatuses();
    this.#refreshControls();
  }

  #onMove(detail: StepTransitionDetail): void {
    this.#stepper?.goTo(this.#order.indexOf(detail.to));
    this.#refreshStatuses();
    this.#refreshControls();
  }

  #teardown(): void {
    this.#disposers.forEach((d) => d());
    this.#disposers = [];
    this.#instance = null;
    this.#stepper = null;
  }

  // --- Rendering ------------------------------------------------------------

  #labelFor(id: string): string {
    return this.#options.labels?.[id] ?? id;
  }

  #renderScaffold(authored: Map<string, DocumentFragment>): void {
    const indicators = this.#order
      .map(
        (id) =>
          `<li data-step-indicator data-step-id="${id}" data-step-status="wait">${this.#escape(this.#labelFor(id))}</li>`,
      )
      .join('');

    const wrap = document.createElement('div');
    wrap.className = 'wizard';
    wrap.setAttribute('role', 'group');
    wrap.innerHTML = `
      <ol class="wizard-steps">${indicators}</ol>
      <div class="wizard-panels">
        ${this.#order
          .map((id) => `<section data-step data-step-id="${id}" hidden></section>`)
          .join('')}
      </div>
      <div class="wizard-controls">
        <button type="button" class="wizard-back">Back</button>
        <button type="button" class="wizard-next">Next</button>
      </div>
      <p class="wizard-live" aria-live="polite" role="status"></p>`;

    this.replaceChildren(wrap);

    // Fill each panel with authored content (or a default label heading).
    this.#order.forEach((id) => {
      const panel = this.querySelector<HTMLElement>(`section[data-step][data-step-id="${id}"]`);
      if (!panel) return;
      const content = authored.get(id);
      if (content) panel.append(content);
      else {
        const h = document.createElement('h3');
        h.textContent = this.#labelFor(id);
        panel.append(h);
      }
    });
  }

  #refreshStatuses(): void {
    const statuses = this.statuses;
    this.#order.forEach((id, i) => {
      const ind = this.querySelector<HTMLElement>(`li[data-step-indicator][data-step-id="${id}"]`);
      ind?.setAttribute('data-step-status', statuses[i]);
    });
  }

  #refreshControls(): void {
    const next = this.querySelector<HTMLButtonElement>('.wizard-next');
    const back = this.querySelector<HTMLButtonElement>('.wizard-back');
    const atStart = this.#order.indexOf(this.position) <= 0;
    if (back) back.disabled = atStart;
    if (next) next.disabled = !!this.#instance?.done;
  }

  #escape(s: string): string {
    return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
  }
}

/** Register the `<wizard-flow>` custom element (idempotent). */
export function registerWizard(tag = 'wizard-flow'): void {
  if (!customElements.get(tag)) customElements.define(tag, WizardElement);
}
